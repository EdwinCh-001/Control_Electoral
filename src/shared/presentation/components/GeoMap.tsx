import {
  Component,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Platform, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { WebView } from "@expo/dom-webview";

import { colors } from "../theme";
import { RelativeMap, type RelativeMapMarker } from "./RelativeMap";

type Props = ComponentProps<typeof RelativeMap>;

class WebViewBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function forScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildMapUri(markers: RelativeMapMarker[]): string {
  const payload = forScript({
    markers,
    palette: {
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      accentDeep: colors.accentDeep,
      accentSoft: colors.accentSoft,
      background: colors.background,
      border: colors.border,
      inkMuted: colors.inkMuted,
    },
  });

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
html, body, #map { height: 100%; margin: 0; }
#map { background: ${colors.surface}; }
.pin-icon { background: transparent; border: 0; }
.pin-dot {
  align-items: center;
  background: ${colors.primary};
  border: 2px solid ${colors.background};
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  color: ${colors.background};
  display: flex;
  font: 700 12px sans-serif;
  height: 22px;
  justify-content: center;
  width: 22px;
}
.pin-icon.reference .pin-dot {
  background: ${colors.background};
  border-color: ${colors.primary};
  border-style: dashed;
  color: ${colors.primary};
}
.pin-icon.warning .pin-dot { background: ${colors.accentDeep}; }
.pin-icon.selected .pin-dot {
  box-shadow: 0 0 0 6px ${colors.accentSoft};
  height: 26px;
  margin: -2px 0 0 -2px;
  width: 26px;
}
.map-label {
  background: ${colors.background};
  border: 1px solid ${colors.border};
  border-radius: 6px;
  color: ${colors.primaryDark};
  font-family: sans-serif;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 5px;
}
.leaflet-container { font-family: sans-serif; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  var data = ${payload};
  function post(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }
  function escapeHtml(value) {
    var escaped = String(value == null ? '' : value);
    return escaped.replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }
  var tileLoaded = false;
  try {
    if (!window.L) {
      throw new Error('Leaflet no disponible');
    }
    var map = L.map('map', { scrollWheelZoom: false, zoomControl: false }).setView([0, 0], 2);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      crossOrigin: true,
      maxZoom: 19,
    }).on('tileload', function () { tileLoaded = true; }).addTo(map);

    var bounds = [];
    data.markers.forEach(function (marker, index) {
      var coordinates = [marker.latitude, marker.longitude];
      var classes = ['pin-icon'];
      if (marker.kind === 'reference') { classes.push('reference'); }
      if (marker.warning) { classes.push('warning'); }
      if (marker.selected) { classes.push('selected'); }
      var icon = L.divIcon({
        className: classes.join(' '),
        html: '<span class="pin-dot">' + (marker.warning ? '!' : '') + '</span>',
        iconAnchor: [11, 11],
        iconSize: [22, 22],
      });
      var point = L.marker(coordinates, { icon: icon }).addTo(map);
      point.bindPopup('<strong>' + escapeHtml(marker.title) + '</strong>' + (marker.details ? '<br />' + escapeHtml(marker.details) : ''));
      if (marker.selected) {
        point.bindTooltip(escapeHtml(marker.title), {
          className: 'map-label',
          direction: 'top',
          offset: [0, -12],
          permanent: true,
        });
      }
      point.on('click', function () { post({ type: 'select', index: index }); });
      bounds.push(coordinates);
    });

    var reference = data.markers.find(function (marker) { return marker.kind === 'reference'; });
    var capture = data.markers.find(function (marker) { return marker.kind !== 'reference'; });
    if (reference && capture) {
      L.polyline(
        [[reference.latitude, reference.longitude], [capture.latitude, capture.longitude]],
        { color: data.palette.accentDeep, dashArray: '4 3', weight: 2 },
      ).addTo(map);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { maxZoom: 16, padding: [28, 28] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    }

    setTimeout(function () {
      if (!tileLoaded) { post({ type: 'unavailable' }); }
    }, 12000);
    post({ type: 'ready' });
  } catch (error) {
    post({ type: 'unavailable' });
  }
})();
</script>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Mapa geográfico con Leaflet/OpenStreetMap (ADR-05). Mantiene RelativeMap
 * como respaldo cuando no hay red o el proveedor de mosaicos no carga.
 */
export function GeoMap({ markers, onSelectMarker, ...relativeProps }: Props) {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const markersKey = JSON.stringify(markers);
  const mapUri = useMemo(
    () => buildMapUri(JSON.parse(markersKey) as RelativeMapMarker[]),
    [markersKey],
  );

  useEffect(() => {
    let active = true;
    const resolve = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      if (active) {
        setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
      }
    };
    void NetInfo.fetch().then(resolve).catch(() => resolve({ isConnected: false, isInternetReachable: false }));
    const unsubscribe = NetInfo.addEventListener(resolve);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const fallback = (
    <RelativeMap
      {...relativeProps}
      markers={markers}
      onSelectMarker={onSelectMarker}
    />
  );

  if (
    Platform.OS === "web" ||
    !isOnline ||
    failedKey === markersKey ||
    markers.length === 0
  ) {
    return fallback;
  }

  return (
    <WebViewBoundary
      fallback={fallback}
      onError={() => setFailedKey(markersKey)}
    >
      <View className={classes.wrapper}>
        <WebView
          accessibilityLabel={relativeProps.accessibilityLabel}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data) as {
                type?: string;
                index?: number;
              };
              if (message.type === "unavailable") {
                setFailedKey(markersKey);
                return;
              }
              if (
                message.type === "select" &&
                typeof message.index === "number" &&
                message.index >= 0 &&
                message.index < markers.length
              ) {
                onSelectMarker?.(markers[message.index], message.index);
              }
            } catch {
              setFailedKey(markersKey);
            }
          }}
          source={{ uri: mapUri }}
          style={{
            backgroundColor: colors.surface,
            height: relativeProps.height ?? 196,
            width: "100%",
          }}
        />
        <View className={classes.attribution} pointerEvents="none">
          <Text className={classes.attributionText}>© OpenStreetMap contributors</Text>
        </View>
      </View>
    </WebViewBoundary>
  );
}

const classes = {
  wrapper: "relative overflow-hidden rounded-lg",
  attribution:
    "absolute right-1 top-1 rounded-sm border border-border bg-background px-1 py-[2px]",
  attributionText: "font-body text-[10px] text-ink-muted",
} as const;
