import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronRight, MapPinned } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
import {
  AuthPage,
  EmptyState,
  Feedback,
  LoadingBlock,
  Metric,
  PageTitle,
  ProgressBar,
  SectionTitle,
  SegmentedTabs,
  StatusChip,
} from "../../access/presentation/components/AuthUi";
import { monitoringRepository } from "../data";
import type {
  OfficeScopeTotals,
  PrecinctProgress,
  ProvincialDashboard,
} from "../domain/dashboard";

type Props = NativeStackScreenProps<RootStackParamList, "ProvincialDashboard">;

const officeLabels = { mayor: "Alcaldía", prefect: "Prefectura" } as const;

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "Todavía no hay actas subidas.";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? `Último cambio: ${value}`
    : `Último cambio: ${parsed.toLocaleString()}`;
}

function TotalsBlock({ totals }: { totals: OfficeScopeTotals[] }) {
  if (totals.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay votos acumulados"
        message="Los acumulados aparecerán cuando lleguen las primeras actas."
      />
    );
  }

  return (
    <View style={styles.totalsBlock}>
      {totals.map((group) => (
        <View
          key={`${group.scope}-${group.office}-${group.precinctId ?? "all"}`}
          style={styles.totalGroup}
        >
          <View style={styles.totalGroupHeader}>
            <Text style={styles.totalGroupTitle}>
              {officeLabels[group.office]}
            </Text>
            <StatusChip
              label={group.scope === "canton" ? "Cantón" : "Recinto"}
              tone="neutral"
            />
          </View>
          {group.candidates.length === 0 ? (
            <Text style={styles.muted}>Sin candidaturas registradas.</Text>
          ) : null}
          {group.candidates.map((candidate) => (
            <View key={candidate.candidateId} style={styles.totalRow}>
              <View style={styles.totalCandidateCopy}>
                <Text style={styles.totalCandidate}>
                  {candidate.candidateName}
                </Text>
                <Text style={styles.totalOrganization}>
                  {candidate.organizationName}
                </Text>
              </View>
              <Text style={styles.totalVotes}>{candidate.votes}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ProvincialDashboardScreen({ navigation }: Props) {
  const [dashboard, setDashboard] = useState<ProvincialDashboard | null>(null);
  const [activeTab, setActiveTab] = useState<"precincts" | "totals">(
    "precincts",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrecinctId, setSelectedPrecinctId] = useState<string | null>(
    null,
  );
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      setDashboard(await monitoringRepository.loadDashboard());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el tablero.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    return monitoringRepository.subscribe(() => {
      void Promise.resolve().then(load);
    });
  }, [load]);

  const selectedPrecinct: PrecinctProgress | undefined =
    dashboard?.precincts.find(
      (precinct) => precinct.precinctId === selectedPrecinctId,
    );
  const selectedTotals = dashboard?.totals.filter(
    (group) =>
      group.scope === "precinct" && group.precinctId === selectedPrecinctId,
  );
  const cantonTotals = dashboard?.totals.filter(
    (group) => group.scope === "canton",
  );
  const overallPercent = dashboard?.totalStations
    ? Math.round(
        (dashboard.reportedStations / dashboard.totalStations) * 100,
      )
    : 0;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.72}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <AuthPage
      headerRight={
        <Pressable
          accessibilityLabel="Ver mapa de ubicaciones"
          accessibilityRole="button"
          onPress={() => navigation.navigate("ProvincialLocationReview")}
          style={styles.mapButton}
        >
          <MapPinned color={colors.primaryDark} size={18} strokeWidth={2.2} />
        </Pressable>
      }
      onBack={() => navigation.goBack()}
      onRefresh={() => {
        setIsRefreshing(true);
        setError(null);
        void load();
      }}
      refreshing={isRefreshing}
      overlay={
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={["72%"]}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
          onClose={() => setSelectedPrecinctId(null)}
        >
          <BottomSheetScrollView
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: spacing.xxxl + insets.bottom },
            ]}
          >
            {selectedPrecinct ? (
              <>
                <Text style={styles.sheetEyebrow}>Detalle del recinto</Text>
                <Text style={styles.sheetTitle}>
                  {selectedPrecinct.precinctName}
                </Text>
                <Text style={styles.muted}>
                  {selectedPrecinct.cantonName} ·{" "}
                  {selectedPrecinct.reportedStations} de{" "}
                  {selectedPrecinct.totalStations} mesas reportadas
                </Text>
                <SectionTitle>Votos por candidatura</SectionTitle>
                <TotalsBlock totals={selectedTotals ?? []} />
                <SectionTitle>Actas recibidas</SectionTitle>
                {selectedPrecinct.actas.length === 0 ? (
                  <EmptyState
                    title="Sin actas todavía"
                    message="Este recinto todavía no tiene actas recibidas."
                  />
                ) : null}
                {selectedPrecinct.actas.map((acta) => (
                  <Pressable
                    key={acta.id}
                    accessibilityLabel={`Revisar acta de la mesa ${acta.stationNumber}`}
                    accessibilityRole="button"
                    onPress={() => {
                      sheetRef.current?.close();
                      navigation.navigate("ProvincialActaDetail", {
                        actaId: acta.id,
                      });
                    }}
                    style={styles.actaRow}
                  >
                    <View style={styles.actaCopy}>
                      <Text style={styles.actaLabel}>
                        Mesa {acta.stationNumber}
                        {acta.sex
                          ? ` · ${acta.sex === "female" ? "Femenina" : "Masculina"}`
                          : ""}
                      </Text>
                      <Text style={styles.muted}>
                        {officeLabels[acta.office]}
                      </Text>
                    </View>
                    <StatusChip label="Recibida" tone="success" />
                  </Pressable>
                ))}
              </>
            ) : null}
          </BottomSheetScrollView>
        </BottomSheet>
      }
    >
      <PageTitle
        eyebrow="Seguimiento provincial"
        title="Tablero provincial"
        description="Avance por recinto."
      />

      {isLoading && !dashboard ? (
        <LoadingBlock message="Cargando el tablero provincial…" />
      ) : null}
      {error ? <Feedback kind="error" message={error} /> : null}

      {dashboard ? (
        <>
          <View style={styles.heroStrip}>
            <View style={styles.heroHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Escrutinio en vivo</Text>
                <Text style={styles.heroTitle}>
                  {dashboard.reportedStations} de {dashboard.totalStations}{" "}
                  mesas reportadas
                </Text>
              </View>
              <StatusChip
                label={
                  dashboard.reportedStations === dashboard.totalStations
                    ? "Completo"
                    : dashboard.reportedStations > 0
                      ? "En avance"
                      : "Sin actas"
                }
                tone={
                  dashboard.reportedStations === dashboard.totalStations
                    ? "success"
                    : dashboard.reportedStations > 0
                      ? "warning"
                      : "muted"
                }
              />
            </View>
            <Text style={styles.muted}>
              {formatUpdatedAt(dashboard.lastUpdatedAt)}
            </Text>
            <ProgressBar
              value={overallPercent}
              tone={
                overallPercent === 100
                  ? "success"
                  : overallPercent > 0
                    ? "warning"
                    : "danger"
              }
            />
            <View style={styles.metricsRow}>
              <Metric
                value={dashboard.reportedStations}
                label="reportadas"
                tone="success"
              />
              <View style={styles.metricDivider} />
              <Metric
                value={dashboard.missingStations}
                label="faltantes"
                tone={dashboard.missingStations > 0 ? "warning" : "success"}
              />
              <View style={styles.metricDivider} />
              <Metric value={dashboard.totalStations} label="totales" />
            </View>
          </View>

          <SegmentedTabs
            onChange={setActiveTab}
            options={[
              {
                key: "precincts",
                label: "Recintos",
                badge: dashboard.precincts.length,
              },
              { key: "totals", label: "Acumulados" },
            ]}
            value={activeTab}
          />

          {activeTab === "totals" ? (
            <TotalsBlock totals={cantonTotals ?? []} />
          ) : dashboard.precincts.length === 0 ? (
            <EmptyState
              title="Aún no hay recintos"
              message="Cuando se asignen recintos a esta provincia, aparecerán aquí."
            />
          ) : (
            <View style={styles.precinctList}>
              {dashboard.precincts.map((precinct, index) => {
                const percent = precinct.totalStations
                  ? Math.round(
                      (precinct.reportedStations / precinct.totalStations) *
                        100,
                    )
                  : 0;
                return (
                  <Animated.View
                    key={precinct.precinctId}
                    entering={FadeInDown.duration(200).delay(
                      Math.min(index * 20, 200),
                    )}
                  >
                    <Pressable
                      accessibilityLabel={`Abrir detalle de ${precinct.precinctName}`}
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedPrecinctId(precinct.precinctId);
                        sheetRef.current?.expand();
                      }}
                      style={styles.precinctRow}
                    >
                      <View style={styles.precinctHeader}>
                        <View style={styles.precinctCopy}>
                          <Text style={styles.precinctName}>
                            {precinct.precinctName}
                          </Text>
                          <Text style={styles.muted}>
                            {precinct.cantonName} · {precinct.reportedStations}/
                            {precinct.totalStations} mesas
                          </Text>
                        </View>
                        <View style={styles.precinctRight}>
                          <Text
                            style={[
                              styles.percent,
                              {
                                color:
                                  percent === 100
                                    ? colors.primary
                                    : percent > 0
                                      ? colors.accentDeep
                                      : colors.inkMuted,
                              },
                            ]}
                          >
                            {percent}%
                          </Text>
                          <ChevronRight color={colors.inkMuted} size={18} />
                        </View>
                      </View>
                      <ProgressBar
                        value={percent}
                        tone={
                          percent === 100
                            ? "success"
                            : percent > 0
                              ? "warning"
                              : "danger"
                        }
                      />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  mapButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  heroStrip: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderLeftColor: colors.accent,
    borderLeftWidth: 4,
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingLeft: spacing.md,
  },
  heroHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 23,
  },
  metricsRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.md,
  },
  metricDivider: {
    backgroundColor: colors.navyBorder,
    width: 1,
  },
  note: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  muted: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  totalsBlock: {
    gap: spacing.sm,
  },
  totalGroup: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  totalGroupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  totalGroupTitle: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  totalRow: {
    alignItems: "center",
    borderTopColor: colors.navyBorder,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  totalCandidateCopy: {
    flex: 1,
    gap: 1,
  },
  totalCandidate: {
    color: colors.bone,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  totalOrganization: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 15,
  },
  totalVotes: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 21,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    lineHeight: 25,
  },
  precinctList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  precinctRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  precinctRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  precinctHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  precinctCopy: {
    flex: 1,
    gap: 1,
  },
  precinctName: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  percent: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 26,
  },
  progressCaption: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  sheetBackground: {
    backgroundColor: colors.navyDeep,
  },
  sheetHandle: {
    backgroundColor: colors.boneMuted,
  },
  sheetContent: {
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  sheetEyebrow: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  sheetTitle: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 25,
    fontWeight: "700",
    lineHeight: 29,
  },
  actaRow: {
    alignItems: "center",
    borderBottomColor: colors.navyBorder,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  actaCopy: {
    flex: 1,
    gap: 1,
  },
  actaLabel: {
    color: colors.white,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
});
