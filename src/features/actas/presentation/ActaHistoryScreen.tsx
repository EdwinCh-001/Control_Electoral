import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { colors } from "../../../shared/presentation/theme";
import {
  AuthPage,
  EmptyState,
  Feedback,
  LoadingBlock,
  PageTitle,
  StatusChip,
  type StatusTone,
} from "../../access/presentation/components/AuthUi";
import { actaRepository } from "../data";
import type { ActaAuditEntry } from "../domain/acta";

type Props = NativeStackScreenProps<RootStackParamList, "ActaHistory">;

const operationPresentation: Record<
  ActaAuditEntry["operation"],
  { label: string; title: string; tone: StatusTone; color: string }
> = {
  INSERT: {
    label: "Creación",
    title: "Acta creada",
    tone: "success",
    color: colors.emerald,
  },
  UPDATE: {
    label: "Actualización",
    title: "Acta actualizada",
    tone: "warning",
    color: colors.amber,
  },
  DELETE: {
    label: "Eliminación",
    title: "Acta eliminada",
    tone: "danger",
    color: colors.red,
  },
};

const auditValueLabels: Record<string, string> = {
  draft: "Falta foto",
  pending: "Foto guardada",
  processing_ocr: "Leyendo foto",
  ready: "Lista para revisar",
  sending: "Subiendo acta",
  sent: "Acta subida",
  failed: "Requiere atención",
  ocr: "Lectura de la foto",
  submission: "Envío",
};

function formatAuditValue(value: string): string {
  return auditValueLabels[value] ?? value;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Sin hora registrada";
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : timestamp.toLocaleString();
}

export function ActaHistoryScreen({ navigation, route }: Props) {
  const { actaId } = route.params;
  const [entries, setEntries] = useState<ActaAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await actaRepository.loadAuditHistory(actaId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el historial de cambios.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [actaId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

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
        eyebrow="Trazabilidad"
        title="Historial de cambios"
        description="Quién editó y cuándo."
      />
      {error ? <Feedback message={error} /> : null}
      {isLoading ? (
        <LoadingBlock message="Cargando el historial…" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Todavía no hay cambios"
          message="El sistema aún no registra movimientos para esta acta."
        />
      ) : (
        <View className={classes.timeline}>
          {entries.map((entry, index) => {
            const presentation = operationPresentation[entry.operation];
            const isLast = index === entries.length - 1;
            return (
              <View key={entry.id} className={classes.timelineItem}>
                <View className={classes.timelineRail}>
                  <View
                    className={classes.timelineDot}
                    style={{ backgroundColor: presentation.color }}
                  />
                  {!isLast ? <View className={classes.timelineLine} /> : null}
                </View>
                <View
                  className={
                    !isLast
                      ? `${classes.entry} ${classes.entryBorder}`
                      : classes.entry
                  }
                >
                  <View className={classes.entryHeader}>
                    <View className={classes.entryCopy}>
                      <Text className={classes.title}>{presentation.title}</Text>
                      <Text className={classes.meta}>
                        {entry.entityName === "actas" ? "Acta" : "Votación"} ·{" "}
                        {entry.actorName}
                      </Text>
                    </View>
                    <StatusChip
                      label={presentation.label}
                      tone={presentation.tone}
                    />
                  </View>
                  <Text className={classes.metaValue}>
                    Dispositivo: {formatTimestamp(entry.deviceModifiedAt)}
                  </Text>
                  <Text className={classes.metaValue}>
                    Sistema: {formatTimestamp(entry.serverReceivedAt)}
                  </Text>
                  {entry.changes.map((change, changeIndex) => (
                    <View
                      key={`${entry.id}-${changeIndex}`}
                      className={classes.change}
                    >
                      <Text className={classes.changeLabel}>{change.label}</Text>
                      <View className={classes.changeValues}>
                        <View className={classes.changeSide}>
                          <Text className={classes.changeCaption}>Antes</Text>
                          <Text className={classes.changePrevious}>
                            {formatAuditValue(change.previousValue)}
                          </Text>
                        </View>
                        <Text className={classes.changeArrow}>→</Text>
                        <View className={classes.changeSide}>
                          <Text className={classes.changeCaption}>Ahora</Text>
                          <Text className={classes.changeNew}>
                            {formatAuditValue(change.newValue)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </AuthPage>
  );
}

const classes = {
  timeline: "gap-0",
  timelineItem: "flex-row gap-3",
  timelineRail: "w-[12px] items-center pt-4",
  timelineDot: "h-[10px] w-[10px] rounded-[5px]",
  timelineLine: "mt-1 w-[1px] flex-1 bg-border",
  entry: "flex-1 gap-1 pb-4",
  entryBorder: "mb-3 border-b border-border",
  entryHeader: "flex-row items-start justify-between gap-2",
  entryCopy: "flex-1 gap-[1px]",
  title: "font-body-bold text-[16px] leading-[21px] text-ink",
  meta: "font-body text-[12px] leading-[17px] text-ink-muted",
  metaValue: "font-body text-[12px] leading-[17px] text-ink",
  change: "mt-1 gap-1 rounded-sm border border-border bg-surface p-2",
  changeLabel: "font-body-medium text-[12px] leading-4 text-ink",
  changeValues: "flex-row items-center gap-2",
  changeSide: "flex-1 gap-[1px]",
  changeCaption: "font-body text-[12px] leading-[14px] text-ink-muted",
  changePrevious: "font-mono text-[12px] leading-[17px] text-ink-muted line-through",
  changeNew: "font-mono text-[12px] leading-[17px] text-primary",
  changeArrow: "font-display text-[18px] leading-[20px] text-ink-muted",
} as const;
