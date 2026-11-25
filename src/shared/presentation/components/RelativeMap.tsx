import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Circle, Line, Rect, Svg, Text as SvgText } from "react-native-svg";

import { colors, fonts } from "../theme";

export interface RelativeMapMarker {
  id?: string;
  latitude: number;
  longitude: number;
  title: string;
  details?: string;
  selected?: boolean;
  warning?: boolean;
  kind?: "reference" | "capture";
}

interface Props {
  markers: RelativeMapMarker[];
  accessibilityLabel: string;
  height?: number;
  onSelectMarker?: (marker: RelativeMapMarker, index: number) => void;
  showLegend?: boolean;
}

interface ProjectedMarker extends RelativeMapMarker {
  x: number;
  y: number;
  originalIndex: number;
}

function projectMarkers(
  markers: RelativeMapMarker[],
  width: number,
  height: number,
): ProjectedMarker[] {
  const valid = markers
    .map((marker, originalIndex) => ({ marker, originalIndex }))
    .filter(
      ({ marker }) =>
        Number.isFinite(marker.latitude) &&
        marker.latitude >= -90 &&
        marker.latitude <= 90 &&
        Number.isFinite(marker.longitude) &&
        marker.longitude >= -180 &&
        marker.longitude <= 180,
    );

  if (!valid.length) {
    return [];
  }

  if (valid.length === 1) {
    return [{ ...valid[0].marker, originalIndex: valid[0].originalIndex, x: width / 2, y: height / 2 }];
  }

  const latitudes = valid.map(({ marker }) => marker.latitude);
  const longitudes = valid.map(({ marker }) => marker.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.0004);
  const lngSpan = Math.max(maxLng - minLng, 0.0004);
  const innerWidth = width * 0.72;
  const innerHeight = height * 0.64;
  const lngBase = minLng - lngSpan * 0.14;
  const latBase = minLat - latSpan * 0.14;

  return valid.map(({ marker, originalIndex }) => ({
    ...marker,
    originalIndex,
    x: width * 0.14 + ((marker.longitude - lngBase) / (lngSpan * 1.28)) * innerWidth,
    y:
      height * 0.82 -
      ((marker.latitude - latBase) / (latSpan * 1.28)) * innerHeight,
  }));
}

/**
 * Mapa relativo sin proveedor externo. Evita WebView en Expo Go y funciona
 * con las coordenadas GPS propias del acta (ADR-05). No muestra mosaicos:
 * dibuja una rejilla de referencia y la posición relativa de cada punto.
 */
export function RelativeMap({
  markers,
  accessibilityLabel,
  height = 196,
  onSelectMarker,
  showLegend = false,
}: Props) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const viewWidth = containerSize.width || 320;
  const viewHeight = containerSize.height || height;
  const projected = projectMarkers(markers, viewWidth, viewHeight);
  const reference = projected.find((marker) => marker.kind === "reference");
  const capture = projected.find((marker) => marker.kind !== "reference");

  if (!projected.length) {
    return (
      <View
        className={`${classes.container} ${classes.empty}`}
        style={{ height }}
      >
        <Text className={classes.emptyText}>Sin ubicaciones disponibles en el mapa.</Text>
      </View>
    );
  }

  return (
    <View className={classes.wrapper}>
      <View
        onLayout={(event) => {
          const { width, height: measuredHeight } = event.nativeEvent.layout;
          if (width > 0 && measuredHeight > 0) {
            setContainerSize({ width, height: measuredHeight });
          }
        }}
        className={classes.container}
        style={{ height }}
      >
        <Svg
          accessibilityLabel={accessibilityLabel}
          height={viewHeight}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          width={viewWidth}
        >
          <Rect fill={colors.surface} height={viewHeight} width={viewWidth} x="0" y="0" />

          <Rect
            fill={colors.primarySoftBg}
            height={viewHeight * 0.22}
            rx={6}
            width={viewWidth * 0.24}
            x={viewWidth * 0.05}
            y={viewHeight * 0.08}
          />
          <Rect
            fill={colors.accentSoft}
            height={viewHeight * 0.18}
            rx={6}
            width={viewWidth * 0.2}
            x={viewWidth * 0.72}
            y={viewHeight * 0.12}
          />
          <Rect
            fill={colors.primarySoftBg}
            height={viewHeight * 0.2}
            rx={6}
            width={viewWidth * 0.18}
            x={viewWidth * 0.4}
            y={viewHeight * 0.58}
          />

          {[0.25, 0.5, 0.75].map((fraction) => (
            <Line
              key={`v-${fraction}`}
              x1={viewWidth * fraction}
              x2={viewWidth * fraction}
              y1="0"
              y2={viewHeight}
              stroke={colors.primarySoft}
              strokeOpacity={0.22}
              strokeWidth={1}
            />
          ))}
          {[0.25, 0.5, 0.75].map((fraction) => (
            <Line
              key={`h-${fraction}`}
              x1="0"
              x2={viewWidth}
              y1={viewHeight * fraction}
              y2={viewHeight * fraction}
              stroke={colors.primarySoft}
              strokeOpacity={0.22}
              strokeWidth={1}
            />
          ))}

          {reference && capture ? (
            <Line
              x1={reference.x}
              x2={capture.x}
              y1={reference.y}
              y2={capture.y}
              stroke={colors.accentDeep}
              strokeDasharray="4 3"
              strokeOpacity={0.75}
              strokeWidth={1.5}
            />
          ) : null}

          {projected.map((marker) => {
            if (!marker.selected) {
              return null;
            }
            return (
              <Circle
                cx={marker.x}
                cy={marker.y}
                fill={colors.accentSoft}
                key={`halo-${marker.id ?? marker.title}-${marker.originalIndex}`}
                r={13}
                stroke={colors.accentDeep}
                strokeWidth={1.4}
              />
            );
          })}

          {projected.map((marker) => {
            const isReference = marker.kind === "reference";
            const fill = isReference
              ? colors.background
              : marker.warning
                ? colors.accentDeep
                : colors.primary;
            return (
              <Circle
                cx={marker.x}
                cy={marker.y}
                fill={fill}
                key={`pin-${marker.id ?? marker.title}-${marker.originalIndex}`}
                r={isReference ? 7 : 6}
                stroke={isReference ? colors.primary : colors.background}
                strokeDasharray={isReference ? "3 2" : undefined}
                strokeWidth={2}
              />
            );
          })}

          {projected.map((marker) => (
            <SvgText
              fill={colors.primaryDark}
              fontFamily={fonts.bodyMedium}
              fontSize={11}
              key={`label-${marker.id ?? marker.title}-${marker.originalIndex}`}
              textAnchor="middle"
              x={marker.x}
              y={marker.y - 14}
            >
              {marker.title}
            </SvgText>
          ))}

          <Circle
            cx={viewWidth - 20}
            cy={22}
            fill={colors.background}
            r={13}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Line
            stroke={colors.primary}
            strokeWidth={1.6}
            x1={viewWidth - 20}
            x2={viewWidth - 20}
            y1={28}
            y2={15}
          />
          <SvgText
            fill={colors.primaryDark}
            fontFamily={fonts.bodyBold}
            fontSize={9}
            textAnchor="middle"
            x={viewWidth - 20}
            y={36}
          >
            N
          </SvgText>
        </Svg>

        {onSelectMarker
          ? projected.map((marker) => (
              <Pressable
                accessibilityLabel={`Seleccionar ${marker.title}`}
                accessibilityRole="button"
                key={`hit-${marker.id ?? marker.title}-${marker.originalIndex}`}
                onPress={() => onSelectMarker(marker, marker.originalIndex)}
                className={classes.hitTarget}
                style={{ left: marker.x, top: marker.y }}
              />
            ))
          : null}
      </View>

      {showLegend ? (
        <View className={classes.legend}>
          <View className={classes.legendItem}>
            <View
              className={classes.legendDot}
              style={{ backgroundColor: colors.primarySoft }}
            />
            <Text className={classes.legendText}>Normal</Text>
          </View>
          <View className={classes.legendItem}>
            <View
              className={classes.legendDot}
              style={{ backgroundColor: colors.accentDeep }}
            />
            <Text className={classes.legendText}>Con aviso</Text>
          </View>
          <View className={classes.legendItem}>
            <View
              className={classes.legendDot}
              style={{ backgroundColor: colors.primary }}
            />
            <Text className={classes.legendText}>Activa</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const classes = {
  wrapper: "gap-1",
  container: "relative overflow-hidden rounded-lg border border-border bg-surface",
  empty: "items-center justify-center p-4",
  emptyText: "text-center font-body text-small text-ink-muted",
  hitTarget: "absolute -ml-[18px] -mt-[18px] h-9 w-9",
  legend: "flex-row flex-wrap gap-3 px-1",
  legendItem: "flex-row items-center gap-[5px]",
  legendDot: "h-2 w-2 rounded-[4px]",
  legendText: "font-body text-[12px] text-ink-muted",
} as const;
