import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { useAppSelector } from "../../../app/store";
import { AuthPage, Feedback, PageTitle, PrimaryButton, SecondaryButton } from "../../access/presentation/components/AuthUi";
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

const statusLabels: Record<ActaStatus, string> = {
  draft: "Borrador sin fotografía",
  pending: "Pendiente de OCR",
  processing_ocr: "Procesando imagen",
  ready: "Pendiente de revisión",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Requiere atención",
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
  const [isLoading, setIsLoading] = useState(true);
  const [busyStation, setBusyStation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastStatusByActa = useRef(new Map<string, ActaStatus>());

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
          : "No se pudo procesar la cola pendiente.",
      );
    }
  }, []);

  const load = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      if (session.profile.role === "provincial_coordinator") {
        throw new Error(
          "El seguimiento provincial de actas corresponde a la siguiente feature.",
        );
      }
      const assignedStations = await actaRepository.loadActaStations(
        session.userId,
        session.profile.role,
      );
      setError(null);
      const actaSummaries = await actaRepository.listSummaries(
        session.userId,
        assignedStations,
      );
      setStations(assignedStations);
      setSummaries(actaSummaries);
      void processQueue(session.userId);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las actas asignadas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [processQueue, session]);

  useEffect(() => {
    void Promise.resolve().then(load);
    const unsubscribe = actaRepository.subscribe((actaId, status) => {
      const previousStatus = lastStatusByActa.current.get(actaId);
      lastStatusByActa.current.set(actaId, status);
      if (previousStatus !== status) {
        if (status === "ready") {
          setNotice("Un acta está lista para revisión.");
        } else if (status === "sent") {
          setNotice("El servidor confirmó el envío de un acta.");
        } else if (status === "failed") {
          setNotice("Un proceso falló. El acta se conserva para reintentar.");
        }
      }
      void load();
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void load();
        if (session) {
          void processQueue(session.userId);
        }
      }
    });
    return () => {
      unsubscribe();
      unsubscribeNetwork();
    };
  }, [load, processQueue, session]);

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
          "Esta acta no tiene una revisión local pendiente ni está disponible para corregir.",
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

  return (
    <AuthPage>
      <PageTitle
        title={
          session?.profile.role === "precinct_coordinator"
            ? "Actas del recinto"
            : "Captura de actas"
        }
        description={
          session?.profile.role === "precinct_coordinator"
            ? "Consulta y corrige actas enviadas en tu recinto."
            : "Mesas asignadas y borradores disponibles en este dispositivo."
        }
      />
      {error ? <Feedback message={error} /> : null}
      {notice ? <Feedback kind="success" message={notice} /> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Cargando mesas asignadas" />
          <Text style={styles.muted}>Cargando tus mesas…</Text>
        </View>
      ) : stations.length === 0 ? (
        <Feedback
          kind="info"
          message="No hay mesas asignadas guardadas. Conéctate para cargar tus asignaciones."
        />
      ) : (
        <View style={styles.stationList}>
          {stations.map((station) => (
            <View key={station.id} style={styles.stationCard}>
              <Text style={styles.stationTitle}>
                {station.precinctName} · Mesa {station.stationNumber}
              </Text>
              {(["mayor", "prefect"] as const).map((office) => {
                const summary = getSummary(summaries, station.id, office);
                const busyKey = `${station.id}-${office}`;
                const canCreate =
                  session?.profile.role === "observer" && !summary;
                const canContinue =
                  Boolean(summary?.localDraft) && summary?.status !== "sent";
                const canCorrect = summary?.status === "sent";
                const canOpen = canCreate || canContinue || canCorrect;

                return (
                  <View key={office} style={styles.officeRow}>
                    <View style={styles.officeDetails}>
                      <Text style={styles.officeTitle}>{officeLabels[office]}</Text>
                      {summary ? (
                        <Text style={styles.status}>
                          {statusLabels[summary.status]}
                        </Text>
                      ) : (
                        <Text style={styles.muted}>Sin captura</Text>
                      )}
                    </View>
                    {canOpen ? (
                      <SecondaryButton
                        disabled={busyStation !== null}
                        label={
                          busyStation === busyKey
                            ? "Abriendo…"
                            : canCorrect
                              ? "Corregir"
                              : canContinue
                                ? "Continuar"
                                : "Capturar"
                        }
                        onPress={() => void openActa(station, office)}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <PrimaryButton
        disabled={isLoading}
        label="Actualizar asignaciones e historial"
        onPress={() => void load()}
      />
      <SecondaryButton
        label="Volver"
        onPress={() => navigation.goBack()}
      />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 28,
  },
  stationList: {
    gap: 12,
  },
  stationCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    gap: 12,
    padding: 16,
  },
  stationTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  officeRow: {
    alignItems: "center",
    borderTopColor: "#D1D5DB",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 10,
  },
  officeDetails: {
    flex: 1,
    gap: 3,
  },
  officeTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
  status: {
    color: "#4B5563",
    fontSize: 13,
  },
  muted: {
    color: "#6B7280",
    fontSize: 14,
  },
});
