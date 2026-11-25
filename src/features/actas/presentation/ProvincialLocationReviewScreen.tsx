import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { GeoMap } from "../../../shared/presentation/components/GeoMap";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
import {
  AuthPage,
  EmptyState,
  Feedback,
  LoadingBlock,
  PageTitle,
  SegmentedTabs,
  StatusChip,
} from "../../access/presentation/components/AuthUi";
import { actaRepository } from "../data";
import type { ProvincialActaLocation } from "../domain/acta";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "ProvincialLocationReview"
>;

const officeLabels = {
  mayor: "Alcaldía",
  prefect: "Prefectura",
} as const;

function formatCapturedAt(value: string | null): string {
  if (!value) {
    return "Sin hora registrada";
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : timestamp.toLocaleString();
}

export function ProvincialLocationReviewScreen({ navigation }: Props) {
  const [actas, setActas] = useState<ProvincialActaLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "warning" | "normal">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const items = await actaRepository.loadProvincialActaLocations();
      setActas(items);
      setSelectedId((current) =>
        current && items.some((item) => item.id === current)
          ? current
          : (items[0]?.id ?? null),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las ubicaciones de las actas.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const filteredActas = actas.filter((acta) => {
    if (filter === "warning") {
      return acta.warningMeters !== null;
    }
    if (filter === "normal") {
      return acta.warningMeters === null;
    }
    return true;
  });

  const selectedActa =
    filteredActas.find((item) => item.id === selectedId) ??
    filteredActas[0] ??
    null;

  return (
    <AuthPage
      onBack={() => navigation.goBack()}
      onRefresh={() => {
        setIsRefreshing(true);
        void load();
      }}
      refreshing={isRefreshing}
    >
      <PageTitle
        eyebrow="Mapa operativo"
        title="Ubicaciones de actas"
        description="Toca un marcador en el mapa o una mesa."
      />
      {error ? <Feedback message={error} /> : null}
      {isLoading ? (
        <LoadingBlock message="Cargando ubicaciones…" />
      ) : actas.length === 0 ? (
        <EmptyState
          title="Todavía no hay actas con ubicación"
          message="Cuando se envíen actas de tu provincia, aparecerán en el mapa."
        />
      ) : (
        <>
          <SegmentedTabs
            onChange={setFilter}
            options={[
              { key: "all", label: "Todas", badge: actas.length },
              {
                key: "warning",
                label: "Con aviso",
                badge: actas.filter((a) => a.warningMeters !== null).length,
              },
              { key: "normal", label: "Normales" },
            ]}
            value={filter}
          />

          <GeoMap
            accessibilityLabel="Mapa provincial de ubicaciones de actas"
            height={240}
            markers={filteredActas.map((acta) => ({
              id: acta.id,
              latitude: acta.latitude,
              longitude: acta.longitude,
              title: `M${acta.stationNumber}`,
              selected: selectedActa?.id === acta.id,
              warning: acta.warningMeters !== null,
            }))}
            onSelectMarker={(marker) => {
              if (marker.id) {
                setSelectedId(marker.id);
              }
            }}
            showLegend
          />

          {selectedActa ? (
            <View style={styles.selectedStrip}>
              <MapPin color={colors.primary} size={18} strokeWidth={2.2} />
              <View style={styles.selectedCopy}>
                <Text style={styles.selectedTitle}>
                  {selectedActa.precinctName} · Mesa {selectedActa.stationNumber}
                </Text>
                <Text style={styles.meta}>
                  {officeLabels[selectedActa.office]} ·{" "}
                  {formatCapturedAt(selectedActa.capturedAtDevice)}
                  {selectedActa.warningMeters !== null
                    ? ` · A ${Math.round(selectedActa.warningMeters)} m del recinto`
                    : ""}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.list}>
            {filteredActas.map((acta) => {
              const isSelected = selectedActa?.id === acta.id;
              return (
                <Pressable
                  accessibilityLabel={`${acta.precinctName} mesa ${acta.stationNumber}`}
                  accessibilityRole="button"
                  key={acta.id}
                  onPress={() => setSelectedId(acta.id)}
                  style={[styles.row, isSelected ? styles.rowSelected : null]}
                >
                  <View
                    style={[
                      styles.rowMark,
                      {
                        backgroundColor:
                          acta.warningMeters !== null
                            ? colors.accentDeep
                            : colors.primary,
                      },
                    ]}
                  />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>
                      {acta.precinctName} · Mesa {acta.stationNumber}
                    </Text>
                    <Text style={styles.meta}>
                      {officeLabels[acta.office]}
                      {acta.stationSex
                        ? ` · ${acta.stationSex === "female" ? "Mujeres" : "Hombres"}`
                        : ""}{" "}
                      · {formatCapturedAt(acta.capturedAtDevice)}
                    </Text>
                  </View>
                  <StatusChip
                    label={
                      acta.warningMeters !== null
                        ? `${Math.round(acta.warningMeters)} m`
                        : "En recinto"
                    }
                    tone={acta.warningMeters !== null ? "warning" : "success"}
                  />
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  selectedStrip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftColor: colors.accent,
    borderLeftWidth: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  selectedCopy: {
    flex: 1,
    gap: 2,
  },
  selectedTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 19,
  },
  list: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowSelected: {
    backgroundColor: colors.primarySoftBg,
    paddingHorizontal: spacing.sm,
  },
  rowMark: {
    borderRadius: 2,
    height: 28,
    width: 3,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  meta: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
});
