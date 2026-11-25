import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin, TriangleAlert } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
import {
  AuthPage,
  Feedback,
  LoadingBlock,
  PageTitle,
  SegmentedTabs,
  StatusChip,
  VoteValue,
} from "../../access/presentation/components/AuthUi";
import { monitoringRepository } from "../data";
import type { ProvincialActaDetail } from "../domain/monitoringRepository";
import { ProvincialActaMap } from "./ProvincialActaMap";

type Props = NativeStackScreenProps<RootStackParamList, "ProvincialActaDetail">;

const officeLabels = { mayor: "Alcaldía", prefect: "Prefectura" } as const;

function formatCapturedAt(value: string | null): string {
  if (!value) {
    return "Sin hora registrada";
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? value
    : timestamp.toLocaleString();
}

export function ProvincialActaDetailScreen({ route, navigation }: Props) {
  const [acta, setActa] = useState<ProvincialActaDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"votes" | "photo" | "map">(
    "votes",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await monitoringRepository.loadActaDetail(
        route.params.actaId,
      );
      setActa(detail);
      if (!detail) {
        setError("El acta ya no está disponible.");
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el acta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [route.params.actaId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <AuthPage onBack={() => navigation.goBack()}>
      <PageTitle
        eyebrow="Acta recibida"
        title="Detalle del acta"
        description="Votos, foto y ubicación en el mapa."
      />
      {isLoading ? <LoadingBlock message="Cargando el acta…" /> : null}
      {error ? <Feedback kind="error" message={error} /> : null}

      {acta ? (
        <>
          <View style={styles.headerStrip}>
            <View style={styles.headerTop}>
              <View style={styles.headerCopy}>
                <Text style={styles.headerEyebrow}>{acta.cantonName}</Text>
                <Text style={styles.headerTitle}>{acta.precinctName}</Text>
                <Text style={styles.muted}>
                  Mesa {acta.stationNumber}
                  {acta.stationSex
                    ? ` · ${acta.stationSex === "female" ? "Femenina" : "Masculina"}`
                    : ""}{" "}
                  · {officeLabels[acta.office]}
                </Text>
              </View>
              <StatusChip label="Recibida" tone="success" />
            </View>
          </View>

          <SegmentedTabs
            onChange={setActiveTab}
            options={[
              { key: "votes", label: "Votos" },
              { key: "photo", label: "Foto" },
              { key: "map", label: "Mapa" },
            ]}
            value={activeTab}
          />

          {activeTab === "votes" ? (
            <View style={styles.resultsList}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Sufragantes</Text>
                <VoteValue value={acta.totalVoters} />
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Votos en blanco</Text>
                <VoteValue value={acta.blankVotes} />
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Votos nulos</Text>
                <VoteValue value={acta.nullVotes} />
              </View>
              {acta.candidateVotes.map((vote) => (
                <View key={vote.candidateId} style={styles.candidateRow}>
                  <View style={styles.candidateCopy}>
                    <Text style={styles.candidateName}>
                      {vote.candidateName}
                    </Text>
                    <Text style={styles.organization}>
                      {vote.organizationName}
                    </Text>
                  </View>
                  <VoteValue value={vote.votes} size="sm" />
                </View>
              ))}
            </View>
          ) : null}

          {activeTab === "photo" ? (
            acta.photoUri ? (
              <Image
                accessibilityLabel="Fotografía del acta electoral"
                contentFit="contain"
                source={{ uri: acta.photoUri }}
                style={styles.photo}
              />
            ) : (
              <Feedback
                kind="warning"
                message="La foto no está disponible en este momento. Puedes revisar los números y la ubicación."
              />
            )
          ) : null}

          {activeTab === "map" ? (
            <View style={styles.mapSection}>
              <View style={styles.mapMetaRow}>
                <MapPin color={colors.primary} size={17} strokeWidth={2.2} />
                <Text style={styles.muted}>
                  Captura: {formatCapturedAt(acta.capturedAtDevice)}
                </Text>
              </View>
              <ProvincialActaMap points={acta.mapPoints} />
              {acta.warningMeters !== null ? (
                <View style={styles.warningBanner}>
                  <TriangleAlert
                    color={colors.accentDeep}
                    size={16}
                    strokeWidth={2.2}
                  />
                  <Text style={styles.warningText}>
                    La foto se tomó a {Math.round(acta.warningMeters)} m del
                    recinto. Queda registrado como aviso.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  headerStrip: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    paddingBottom: spacing.md,
    paddingLeft: spacing.md,
  },
  headerTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    color: colors.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 23,
  },
  muted: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  photo: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    width: "100%",
  },
  resultsList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  resultRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  resultLabel: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  candidateRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  candidateCopy: {
    flex: 1,
    gap: 2,
  },
  candidateName: {
    color: colors.ink,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  organization: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  mapSection: {
    gap: spacing.sm,
  },
  mapMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  warningBanner: {
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
