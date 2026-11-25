import { Text, View } from "react-native";
import { MapPin, TriangleAlert } from "lucide-react-native";

import { StatusChip } from "../../../shared/presentation/components/AppUi";
import { GeoMap } from "../../../shared/presentation/components/GeoMap";
import type { RelativeMapMarker } from "../../../shared/presentation/components/RelativeMap";
import { colors } from "../../../shared/presentation/theme";
import type { Location } from "../domain/acta";

interface Props {
  location: Location | null;
  capturedAt: string | null;
  warningMeters?: number | null;
  reference?: Location | null;
  title?: string;
}

function formatCapturedAt(value: string | null): string {
  if (!value) {
    return "Sin hora registrada";
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : timestamp.toLocaleString();
}

export function ActaLocationCard({
  location,
  capturedAt,
  warningMeters = null,
  reference = null,
  title = "Ubicación de captura",
}: Props) {
  const hasSeparateReference = Boolean(
    reference &&
      location &&
      (reference.latitude !== location.latitude ||
        reference.longitude !== location.longitude),
  );

  const markers: RelativeMapMarker[] = location
    ? [
        ...(hasSeparateReference && reference
          ? [
              {
                latitude: reference.latitude,
                longitude: reference.longitude,
                title: "Referencia",
                kind: "reference" as const,
              },
            ]
          : []),
        {
          latitude: location.latitude,
          longitude: location.longitude,
          title: "Captura",
          kind: "capture" as const,
          selected: true,
          warning: warningMeters !== null,
        },
      ]
    : [];

  return (
    <View className={classes.container}>
      <View className={classes.header}>
        <View className={classes.headerTitleRow}>
          <MapPin
            color={location ? colors.primary : colors.accentDeep}
            size={18}
            strokeWidth={2.2}
          />
          <View className={classes.headerCopy}>
            <Text className={classes.title}>
              {location ? title : "Sin ubicación registrada"}
            </Text>
            <Text className={classes.meta}>{formatCapturedAt(capturedAt)}</Text>
          </View>
        </View>
        <StatusChip
          label={
            !location
              ? "Falta GPS"
              : warningMeters !== null
                ? "Con aviso"
                : "En recinto"
          }
          tone={
            !location || warningMeters !== null ? "warning" : "success"
          }
        />
      </View>

      {location ? (
        <>
          <GeoMap
            accessibilityLabel="Mapa de la captura frente a la referencia del recinto"
            height={156}
            markers={markers}
          />
          <View className={classes.mapLegend}>
            <View className={classes.legendItem}>
              <View
                className={classes.legendDot}
                style={{
                  backgroundColor:
                    warningMeters !== null
                      ? colors.accentDeep
                      : colors.primary,
                }}
              />
              <Text className={classes.legendText}>Captura</Text>
            </View>
            {hasSeparateReference ? (
              <View className={classes.legendItem}>
                <View className={`${classes.legendDot} ${classes.legendHollow}`} />
                <Text className={classes.legendText}>Referencia del recinto</Text>
              </View>
            ) : null}
          </View>
          <Text className={classes.mapNote}>
            Mapa de OpenStreetMap. Sin conexión se muestra una vista relativa
            sin calles.
          </Text>
        </>
      ) : (
        <Text className={classes.empty}>
          No se registró la ubicación en el mapa para esta acta.
        </Text>
      )}

      {warningMeters !== null ? (
        <View className={classes.warning}>
          <TriangleAlert color={colors.accentDeep} size={16} strokeWidth={2.2} />
          <Text className={classes.warningText}>
            Tomada a {Math.round(warningMeters)} m de la referencia del recinto.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const classes = {
  container: "gap-2",
  header: "flex-row items-center justify-between gap-2",
  headerTitleRow: "flex-1 flex-row items-center gap-2",
  headerCopy: "flex-1 gap-[1px]",
  title: "font-body-bold text-[15px] leading-5 text-ink",
  meta: "font-body text-[12px] leading-4 text-ink-muted",
  mapLegend: "flex-row flex-wrap gap-3",
  legendItem: "flex-row items-center gap-[6px]",
  legendDot: "h-[9px] w-[9px] rounded-[4px]",
  legendHollow: "border-2 border-primary bg-background",
  legendText: "font-body-medium text-[12px] text-ink-muted",
  mapNote: "font-body text-[12px] leading-[17px] text-ink-muted",
  empty: "font-body text-[14px] leading-5 text-ink-muted",
  warning: "flex-row items-center gap-2 rounded-md border border-accent-deep bg-accent-soft px-3 py-2",
  warningText: "flex-1 font-body-medium text-small text-ink",
} as const;
