import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../app/navigationTypes";
import {
  AuthPage,
  Feedback,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../../access/presentation/components/AuthUi";
import { actaRepository } from "../data";
import type { ActaAuditEntry } from "../domain/acta";

type Props = NativeStackScreenProps<RootStackParamList, "ActaHistory">;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "No disponible";
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEntries(await actaRepository.loadAuditHistory(actaId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el historial de auditoría.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [actaId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <AuthPage>
      <PageTitle
        title="Historial de auditoría"
        description="Cambios registrados por el servidor para esta acta."
      />
      {error ? <Feedback message={error} /> : null}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Cargando historial" />
          <Text style={styles.muted}>Cargando historial…</Text>
        </View>
      ) : entries.length === 0 ? (
        <Feedback
          kind="info"
          message="El servidor todavía no registra cambios auditables para esta acta."
        />
      ) : (
        <View style={styles.entries}>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.title}>
                {entry.operation === "INSERT"
                  ? "Creación"
                  : entry.operation === "DELETE"
                    ? "Eliminación"
                    : "Actualización"}
                {" · "}
                {entry.entityName === "actas" ? "Acta" : "Votación"}
              </Text>
              <Text style={styles.meta}>Actor: {entry.actorName}</Text>
              <Text style={styles.meta}>
                Hora del dispositivo: {formatTimestamp(entry.deviceModifiedAt)}
              </Text>
              <Text style={styles.meta}>
                Recepción del servidor: {formatTimestamp(entry.serverReceivedAt)}
              </Text>
              {entry.changes.map((change, index) => (
                <View key={`${entry.id}-${index}`} style={styles.change}>
                  <Text style={styles.label}>{change.label}</Text>
                  <Text style={styles.value}>
                    Anterior: {change.previousValue}
                  </Text>
                  <Text style={styles.value}>Nuevo: {change.newValue}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
      <PrimaryButton
        disabled={isLoading}
        label="Actualizar historial"
        onPress={() => void load()}
      />
      <SecondaryButton
        label="Volver al acta"
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
  entries: {
    gap: 12,
  },
  entry: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    gap: 6,
    padding: 16,
  },
  title: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: "#4B5563",
    fontSize: 13,
  },
  change: {
    borderTopColor: "#D1D5DB",
    borderTopWidth: 1,
    gap: 3,
    marginTop: 6,
    paddingTop: 8,
  },
  label: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    color: "#4B5563",
    fontSize: 13,
  },
  muted: {
    color: "#6B7280",
    fontSize: 14,
  },
});
