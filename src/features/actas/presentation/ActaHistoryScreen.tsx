import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
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
        <View style={styles.timeline}>
          {entries.map((entry, index) => {
            const presentation = operationPresentation[entry.operation];
            const isLast = index === entries.length - 1;
            return (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: presentation.color },
                    ]}
                  />
                  {!isLast ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={[styles.entry, !isLast ? styles.entryBorder : null]}>
                  <View style={styles.entryHeader}>
                    <View style={styles.entryCopy}>
                      <Text style={styles.title}>{presentation.title}</Text>
                      <Text style={styles.meta}>
                        {entry.entityName === "actas" ? "Acta" : "Votación"} ·{" "}
                        {entry.actorName}
                      </Text>
                    </View>
                    <StatusChip
                      label={presentation.label}
                      tone={presentation.tone}
                    />
                  </View>
                  <Text style={styles.metaValue}>
                    Dispositivo: {formatTimestamp(entry.deviceModifiedAt)}
                  </Text>
                  <Text style={styles.metaValue}>
                    Sistema: {formatTimestamp(entry.serverReceivedAt)}
                  </Text>
                  {entry.changes.map((change, changeIndex) => (
                    <View
                      key={`${entry.id}-${changeIndex}`}
                      style={styles.change}
                    >
                      <Text style={styles.changeLabel}>{change.label}</Text>
                      <View style={styles.changeValues}>
                        <View style={styles.changeSide}>
                          <Text style={styles.changeCaption}>Antes</Text>
                          <Text style={styles.changePrevious}>
                            {formatAuditValue(change.previousValue)}
                          </Text>
                        </View>
                        <Text style={styles.changeArrow}>→</Text>
                        <View style={styles.changeSide}>
                          <Text style={styles.changeCaption}>Ahora</Text>
                          <Text style={styles.changeNew}>
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

const styles = StyleSheet.create({
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    gap: spacing.md,
  },
  timelineRail: {
    alignItems: "center",
    paddingTop: spacing.lg,
    width: 12,
  },
  timelineDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  timelineLine: {
    backgroundColor: colors.navyBorder,
    flex: 1,
    marginTop: 4,
    width: 1,
  },
  entry: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  entryBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  entryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  entryCopy: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 21,
  },
  meta: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  metaBlock: {
    borderTopColor: colors.navyBorder,
    borderTopWidth: 1,
    gap: 1,
    paddingTop: spacing.sm,
  },
  metaLabel: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 14,
  },
  metaValue: {
    color: colors.bone,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  change: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
    padding: spacing.sm,
  },
  changeLabel: {
    color: colors.bone,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  changeValues: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  changeSide: {
    flex: 1,
    gap: 1,
  },
  changeCaption: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 14,
  },
  changePrevious: {
    color: colors.boneMuted,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    textDecorationLine: "line-through",
  },
  changeNew: {
    color: colors.emerald,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
  },
  changeArrow: {
    color: colors.boneMuted,
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 20,
  },
});
