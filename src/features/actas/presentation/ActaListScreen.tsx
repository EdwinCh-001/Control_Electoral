import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronRight } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { useAppSelector } from "../../../app/store";
import type { NoticeKind } from "../../../shared/presentation/messages";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
import {
  AuthPage,
  EmptyState,
  Feedback,
  LoadingBlock,
  Metric,
  PageTitle,
  SegmentedTabs,
  StatusChip,
  type StatusTone,
} from "../../access/presentation/components/AuthUi";
import { actaRepository } from "../data";
import type {
  ActaDraft,
  ActaStatus,
  ActaSummary,
  AssignedStation,
  ElectoralOffice,
} from "../domain/acta";

type Props = NativeStackScreenProps<RootStackParamList, "ActaList">;

const officeLabels: Record<ElectoralOffice, string> = {
  mayor: "Alcaldía",
  prefect: "Prefectura",
};

const statusPresentation: Record<
  ActaStatus,
  { label: string; tone: StatusTone }
> = {
  draft: { label: "Falta foto", tone: "muted" },
  pending: { label: "Foto guardada", tone: "warning" },
  processing_ocr: { label: "Leyendo foto", tone: "warning" },
  ready: { label: "Lista para revisar", tone: "action" },
  sending: { label: "Subiendo acta", tone: "warning" },
  sent: { label: "Acta subida", tone: "success" },
  failed: { label: "Requiere atención", tone: "danger" },
};

function getSummary(
  summaries: ActaSummary[],
  stationId: string,
  office: ElectoralOffice,
): ActaSummary | undefined {
  return summaries.find(
    (summary) =>
      summary.pollingStationId === stationId && summary.office === office,
  );
}

export function ActaListScreen({ navigation }: Props) {
  const session = useAppSelector((state) => state.auth.session);
  const [stations, setStations] = useState<AssignedStation[]>([]);
  const [summaries, setSummaries] = useState<ActaSummary[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "sent">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyStation, setBusyStation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: NoticeKind;
    message: string;
  } | null>(null);
  const userId = session?.userId ?? null;
  const role = session?.profile.role ?? null;
  const lastStatusByActa = useRef(new Map<string, ActaStatus>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUserId = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const hasNetworkStateRef = useRef(false);
  const wasOnlineRef = useRef(false);

  const processQueue = useCallback(async (userId: string) => {
    try {
      const outcomes = await Promise.all([
        actaRepository.processPendingOCR(userId),
        actaRepository.processPendingSubmissions(userId),
      ]);
      const failedItem = outcomes
        .flat()
        .find((outcome) => !outcome.succeeded);
      if (failedItem?.message) {
        setError(failedItem.message);
      }
    } catch (queueError) {
      setError(
        queueError instanceof Error
          ? queueError.message
          : "No se pudieron terminar las tareas pendientes. Vuelve a intentar.",
      );
    }
  }, []);

  const load = useCallback(async () => {
    if (!userId || !role) {
      return;
    }
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;
    try {
      if (role === "provincial_coordinator") {
        throw new Error(
          "El tablero provincial se abre desde el inicio. Vuelve y elige Tablero provincial.",
        );
      }
      const cachedStations = await actaRepository.getCachedStations(userId);
      if (cachedStations.length) {
        setStations(cachedStations);
        setIsLoading(false);
      }
      const assignedStations = await actaRepository.loadActaStations(
        userId,
        role,
      );
      setError(null);
      const actaSummaries = await actaRepository.listSummaries(
        userId,
        assignedStations,
      );
      setStations(assignedStations);
      setSummaries(actaSummaries);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las actas asignadas.",
      );
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId, role]);

  const scheduleReload = useCallback(() => {
    if (!userId) {
      return;
    }
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }
    const attempt = () => {
      if (isLoadingRef.current) {
        refreshTimer.current = setTimeout(attempt, 160);
        return;
      }
      refreshTimer.current = null;
      void load();
    };
    refreshTimer.current = setTimeout(attempt, 160);
  }, [load, userId]);

  useEffect(() => {
    if (!userId || !role) {
      return;
    }
    if (initialUserId.current !== userId) {
      initialUserId.current = userId;
      void Promise.resolve()
        .then(load)
        .then(() => processQueue(userId));
    } else {
      void load();
    }

    const unsubscribe = actaRepository.subscribe((actaId, status) => {
      const previousStatus = lastStatusByActa.current.get(actaId);
      lastStatusByActa.current.set(actaId, status);
      if (previousStatus !== status) {
        if (status === "ready") {
          setNotice({
            kind: "info",
            message: "Ya puedes revisar un acta. Abre la mesa para continuar.",
          });
        } else if (status === "sent") {
          setNotice({
            kind: "success",
            message: "Acta subida correctamente.",
          });
        } else if (status === "failed") {
          setNotice({
            kind: "warning",
            message:
              "No pudimos subir un acta. Quedó guardada en este dispositivo para reintentar.",
          });
        }
      }
      scheduleReload();
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true && state.isInternetReachable !== false;
      if (online && hasNetworkStateRef.current && !wasOnlineRef.current) {
        scheduleReload();
        void processQueue(userId);
      }
      hasNetworkStateRef.current = true;
      wasOnlineRef.current = online;
    });
    return () => {
      unsubscribe();
      unsubscribeNetwork();
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      refreshTimer.current = null;
    };
  }, [userId, role, load, processQueue, scheduleReload]);

  const openActa = async (
    station: AssignedStation,
    office: ElectoralOffice,
  ) => {
    if (!session) {
      return;
    }
    setError(null);
    const busyKey = `${station.id}-${office}`;
    setBusyStation(busyKey);
    try {
      const summary = getSummary(summaries, station.id, office);
      let draft: ActaDraft | null;
      if (summary?.status === "sent") {
        draft = await actaRepository.beginCorrection(
          session.userId,
          summary.id,
        );
      } else if (summary?.localDraft) {
        draft = await actaRepository.getDraft(summary.id, session.userId);
      } else if (!summary && session.profile.role === "observer") {
        draft = await actaRepository.createDraft(
          session.userId,
          station.id,
          office,
        );
      } else {
        throw new Error(
          "Esta acta no está lista para corregir en este dispositivo. Actualiza las mesas e intenta de nuevo.",
        );
      }
      if (!draft) {
        throw new Error("No se encontró el borrador local de esta acta.");
      }
      navigation.navigate("ActaEditor", {
        actaId: draft.id,
      });
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "No se pudo abrir la captura del acta.",
      );
    } finally {
      setBusyStation(null);
    }
  };

  const readyCount = summaries.filter(
    (summary) => summary.status === "ready",
  ).length;
  const sentCount = summaries.filter(
    (summary) => summary.status === "sent",
  ).length;
  const pendingCount = summaries.filter(
    (summary) =>
      summary.status === "draft" ||
      summary.status === "pending" ||
      summary.status === "processing_ocr" ||
      summary.status === "sending",
  ).length;
  const failedCount = summaries.filter(
    (summary) => summary.status === "failed",
  ).length;

  const filteredStations = stations.filter((station) => {
    if (filter === "all") {
      return true;
    }
    const mayor = getSummary(summaries, station.id, "mayor");
    const prefect = getSummary(summaries, station.id, "prefect");
    const bothSent = mayor?.status === "sent" && prefect?.status === "sent";
    return filter === "sent" ? bothSent : !bothSent;
  });

  return (
    <AuthPage
      onBack={() => navigation.goBack()}
      onRefresh={() => {
        setIsRefreshing(true);
        scheduleReload();
      }}
      refreshing={isRefreshing}
    >
      <PageTitle
        eyebrow="Trabajo de campo"
        title={
          session?.profile.role === "precinct_coordinator"
            ? "Actas del recinto"
            : "Captura de actas"
        }
        description={
          session?.profile.role === "precinct_coordinator"
            ? "Consulta y corrige."
            : "Foto, números y envío."
        }
      />

      {error ? <Feedback message={error} /> : null}
      {notice ? (
        <Feedback kind={notice.kind} message={notice.message} />
      ) : null}

      {isLoading ? (
        <LoadingBlock message="Cargando tus mesas asignadas…" />
      ) : stations.length === 0 ? (
        <EmptyState
          title="Aún no tienes mesas asignadas"
          message="Desliza hacia abajo cuando tengas conexión para cargar tus asignaciones."
        />
      ) : (
        <>
          <View style={styles.summaryStrip}>
            <View style={styles.metricsRow}>
              <Metric value={stations.length} label="mesas" />
              <View style={styles.metricDivider} />
              <Metric
                value={readyCount}
                label="por revisar"
                tone={readyCount > 0 ? "warning" : "default"}
              />
              <View style={styles.metricDivider} />
              <Metric value={sentCount} label="subidas" tone="success" />
            </View>
            <Text style={styles.summaryHint}>
              {failedCount > 0
                ? `${failedCount} acta${failedCount === 1 ? "" : "s"} necesita${failedCount === 1 ? "" : "n"} atención.`
                : pendingCount > 0
                  ? `${pendingCount} captura${pendingCount === 1 ? "" : "s"} guardada${pendingCount === 1 ? "" : "s"} en este dispositivo.`
                  : "Desliza hacia abajo para actualizar."}
            </Text>
          </View>

          <SegmentedTabs
            onChange={setFilter}
            options={[
              { key: "all", label: "Todas", badge: stations.length },
              { key: "pending", label: "Pendientes" },
              { key: "sent", label: "Subidas" },
            ]}
            value={filter}
          />

          {filteredStations.length === 0 ? (
            <EmptyState
              title="Sin mesas en este filtro"
              message="Cambia de pestaña para ver el resto de tus mesas."
            />
          ) : (
            <View style={styles.stationList}>
              {filteredStations.map((station) => (
                <View key={station.id} style={styles.stationBlock}>
                  <View style={styles.stationHeader}>
                    <View style={styles.stationMark} />
                    <View style={styles.stationCopy}>
                      <Text style={styles.stationTitle}>
                        {station.precinctName}
                      </Text>
                      <Text style={styles.stationMeta}>
                        Mesa {station.stationNumber}
                        {station.sex
                          ? ` · ${station.sex === "female" ? "Mujeres" : "Hombres"}`
                          : ""}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.officesWrap}>
                    {(["mayor", "prefect"] as const).map((office) => {
                      const summary = getSummary(summaries, station.id, office);
                      const busyKey = `${station.id}-${office}`;
                      const canCreate =
                        session?.profile.role === "observer" && !summary;
                      const canContinue =
                        Boolean(summary?.localDraft) && summary?.status !== "sent";
                      const canCorrect = summary?.status === "sent";
                      const canOpen = canCreate || canContinue || canCorrect;
                      const presentation = summary
                        ? statusPresentation[summary.status]
                        : { label: "Sin captura", tone: "muted" as StatusTone };

                      return (
                        <Pressable
                          accessibilityLabel={`${officeLabels[office]} · ${presentation.label}`}
                          accessibilityRole={canOpen ? "button" : undefined}
                          disabled={!canOpen || busyStation !== null}
                          key={office}
                          onPress={() => {
                            if (canOpen) {
                              void openActa(station, office);
                            }
                          }}
                          style={styles.officeRow}
                        >
                          <View style={styles.officeDetails}>
                            <Text style={styles.officeTitle}>
                              {officeLabels[office]}
                            </Text>
                            <StatusChip
                              label={presentation.label}
                              tone={presentation.tone}
                            />
                          </View>
                          {canOpen ? (
                            <View style={styles.inlinePill}>
                              <Text style={styles.inlinePillText}>
                                {busyStation === busyKey
                                  ? "Abriendo…"
                                  : canCorrect
                                    ? "Corregir"
                                    : canContinue
                                      ? "Continuar"
                                      : "Capturar"}
                              </Text>
                              <ChevronRight
                                color={colors.primary}
                                size={16}
                                strokeWidth={2.4}
                              />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  summaryStrip: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderLeftColor: colors.accent,
    borderLeftWidth: 4,
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingLeft: spacing.md,
  },
  metricsRow: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing.md,
  },
  metricDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  summaryHint: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  stationList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  stationBlock: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  stationMark: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    height: 28,
    width: 3,
  },
  stationCopy: {
    flex: 1,
    gap: 1,
  },
  stationTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 21,
  },
  stationMeta: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  officesWrap: {
    gap: spacing.xs,
    paddingLeft: spacing.md,
  },
  officeRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  officeDetails: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  officeTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  inlinePill: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  inlinePillText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
});
