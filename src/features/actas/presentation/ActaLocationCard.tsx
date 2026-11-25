import { StyleSheet, Text, View } from "react-native";
import { MapPin, TriangleAlert } from "lucide-react-native";

import { StatusChip } from "../../../shared/presentation/components/AppUi";
import { GeoMap } from "../../../shared/presentation/components/GeoMap";
import type { RelativeMapMarker } from "../../../shared/presentation/components/RelativeMap";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MapPin
            color={location ? colors.primary : colors.accentDeep}
            size={18}
            strokeWidth={2.2}
          />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              {location ? title : "Sin ubicación registrada"}
            </Text>
            <Text style={styles.meta}>{formatCapturedAt(capturedAt)}</Text>
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
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      warningMeters !== null
                        ? colors.accentDeep
                        : colors.primary,
                  },
                ]}
              />
              <Text style={styles.legendText}>Captura</Text>
            </View>
            {hasSeparateReference ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendHollow]} />
                <Text style={styles.legendText}>Referencia del recinto</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.mapNote}>
            Mapa de OpenStreetMap. Sin conexión se muestra una vista relativa
            sin calles.
          </Text>
        </>
      ) : (
        <Text style={styles.empty}>
          No se registró la ubicación en el mapa para esta acta.
        </Text>
      )}

      {warningMeters !== null ? (
        <View style={styles.warning}>
          <TriangleAlert color={colors.accentDeep} size={16} strokeWidth={2.2} />
          <Text style={styles.warningText}>
            Tomada a {Math.round(warningMeters)} m de la referencia del recinto.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  headerTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  mapLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendDot: {
    borderRadius: 4,
    height: 9,
    width: 9,
  },
  legendHollow: {
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  legendText: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  mapNote: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  empty: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  warning: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentDeep,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  warningText: {
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
});
