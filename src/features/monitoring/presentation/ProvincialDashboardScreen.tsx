import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
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
import { colors, spacing } from "../../../shared/presentation/theme";
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
    <View className={classes.totalsBlock}>
      {totals.map((group) => (
        <View
          key={`${group.scope}-${group.office}-${group.precinctId ?? "all"}`}
          className={classes.totalGroup}
        >
          <View className={classes.totalGroupHeader}>
            <Text className={classes.totalGroupTitle}>
              {officeLabels[group.office]}
            </Text>
            <StatusChip
              label={group.scope === "canton" ? "Cantón" : "Recinto"}
              tone="neutral"
            />
          </View>
          {group.candidates.length === 0 ? (
            <Text className={classes.muted}>Sin candidaturas registradas.</Text>
          ) : null}
          {group.candidates.map((candidate) => (
            <View key={candidate.candidateId} className={classes.totalRow}>
              <View className={classes.totalCandidateCopy}>
                <Text className={classes.totalCandidate}>
                  {candidate.candidateName}
                </Text>
                <Text className={classes.totalOrganization}>
                  {candidate.organizationName}
                </Text>
              </View>
              <Text className={classes.totalVotes} style={{ fontVariant: ["tabular-nums"] }}>
                {candidate.votes}
              </Text>
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
          className={classes.mapButton}
          onPress={() => navigation.navigate("ProvincialLocationReview")}
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
          backgroundStyle={{ backgroundColor: colors.surface }}
          handleIndicatorStyle={{ backgroundColor: colors.inkMuted }}
          onClose={() => setSelectedPrecinctId(null)}
        >
          <BottomSheetScrollView
            contentContainerClassName={classes.sheetContent}
            contentContainerStyle={{ paddingBottom: spacing.xxxl + insets.bottom }}
          >
            {selectedPrecinct ? (
              <>
                <Text className={classes.sheetEyebrow}>Detalle del recinto</Text>
                <Text className={classes.sheetTitle}>
                  {selectedPrecinct.precinctName}
                </Text>
                <Text className={classes.muted}>
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
                    className={classes.actaRow}
                    onPress={() => {
                      sheetRef.current?.close();
                      navigation.navigate("ProvincialActaDetail", {
                        actaId: acta.id,
                      });
                    }}
                  >
                    <View className={classes.actaCopy}>
                      <Text className={classes.actaLabel}>
                        Mesa {acta.stationNumber}
                        {acta.sex
                          ? ` · ${acta.sex === "female" ? "Femenina" : "Masculina"}`
                          : ""}
                      </Text>
                      <Text className={classes.muted}>
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
          <View className={classes.heroStrip}>
            <View className={classes.heroHeader}>
              <View className={classes.heroCopy}>
                <Text className={classes.heroEyebrow}>Escrutinio en vivo</Text>
                <Text className={classes.heroTitle}>
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
            <Text className={classes.muted}>
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
            <View className={classes.metricsRow}>
              <Metric
                value={dashboard.reportedStations}
                label="reportadas"
                tone="success"
              />
              <View className={classes.metricDivider} />
              <Metric
                value={dashboard.missingStations}
                label="faltantes"
                tone={dashboard.missingStations > 0 ? "warning" : "success"}
              />
              <View className={classes.metricDivider} />
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
            <View className={classes.precinctList}>
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
                      className={classes.precinctRow}
                      onPress={() => {
                        setSelectedPrecinctId(precinct.precinctId);
                        sheetRef.current?.expand();
                      }}
                    >
                      <View className={classes.precinctHeader}>
                        <View className={classes.precinctCopy}>
                          <Text className={classes.precinctName}>
                            {precinct.precinctName}
                          </Text>
                          <Text className={classes.muted}>
                            {precinct.cantonName} · {precinct.reportedStations}/
                            {precinct.totalStations} mesas
                          </Text>
                        </View>
                        <View className={classes.precinctRight}>
                          <Text
                            className={classes.percent}
                            style={{
                              color:
                                percent === 100
                                  ? colors.primary
                                  : percent > 0
                                    ? colors.accentDeep
                                    : colors.inkMuted,
                            }}
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

const classes = {
  mapButton:
    "h-[38px] w-[38px] items-center justify-center rounded-md border border-border bg-surface",
  heroStrip:
    "gap-2 border-b border-b-border border-l-[4px] border-l-accent pb-3 pl-3",
  heroHeader: "flex-row items-start justify-between gap-2",
  heroCopy: "flex-1 gap-[2px]",
  heroEyebrow: "font-body-medium text-[12px] tracking-[0.5px] text-ink-muted",
  heroTitle: "font-body-bold text-[18px] leading-[23px] text-ink",
  metricsRow: "flex-row items-stretch gap-3",
  metricDivider: "w-px bg-border",
  muted: "font-body text-[13px] leading-[18px] text-ink-muted",
  totalsBlock: "gap-2",
  totalGroup: "gap-2 border-b border-border pb-3",
  totalGroupHeader: "flex-row items-center justify-between gap-2",
  totalGroupTitle: "font-body-bold text-[15px] leading-[20px] text-ink",
  totalRow:
    "flex-row items-center justify-between gap-3 border-t border-border pt-2",
  totalCandidateCopy: "flex-1 gap-[1px]",
  totalCandidate: "font-body-medium text-[13px] leading-[18px] text-ink",
  totalOrganization: "font-body text-[12px] leading-[15px] text-ink-muted",
  totalVotes: "font-display text-[21px] font-bold leading-[25px] text-ink",
  precinctList: "border-t border-border",
  precinctRow: "gap-2 border-b border-border py-3",
  precinctRight: "flex-row items-center gap-1",
  precinctHeader: "flex-row items-start justify-between gap-2",
  precinctCopy: "flex-1 gap-[1px]",
  precinctName: "font-body-bold text-[15px] leading-[20px] text-ink",
  percent: "font-display text-[22px] font-bold leading-[26px]",
  sheetContent: "gap-2 px-5 pb-8 pt-3",
  sheetEyebrow: "font-body-medium text-[12px] tracking-[0.5px] text-ink-muted",
  sheetTitle: "font-display text-title font-bold text-ink",
  actaRow:
    "flex-row items-center justify-between gap-2 border-b border-border py-3",
  actaCopy: "flex-1 gap-[1px]",
  actaLabel: "font-body-medium text-[14px] leading-[19px] text-ink",
} as const;
