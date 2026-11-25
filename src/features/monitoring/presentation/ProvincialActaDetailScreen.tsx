import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin, TriangleAlert } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { colors } from "../../../shared/presentation/theme";
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
          <View className={classes.headerStrip}>
            <View className={classes.headerTop}>
              <View className={classes.headerCopy}>
                <Text className={classes.headerEyebrow}>{acta.cantonName}</Text>
                <Text className={classes.headerTitle}>{acta.precinctName}</Text>
                <Text className={classes.muted}>
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
            <View className={classes.resultsList}>
              <View className={classes.resultRow}>
                <Text className={classes.resultLabel}>Sufragantes</Text>
                <VoteValue value={acta.totalVoters} />
              </View>
              <View className={classes.resultRow}>
                <Text className={classes.resultLabel}>Votos en blanco</Text>
                <VoteValue value={acta.blankVotes} />
              </View>
              <View className={classes.resultRow}>
                <Text className={classes.resultLabel}>Votos nulos</Text>
                <VoteValue value={acta.nullVotes} />
              </View>
              {acta.candidateVotes.map((vote) => (
                <View key={vote.candidateId} className={classes.candidateRow}>
                  <View className={classes.candidateCopy}>
                    <Text className={classes.candidateName}>
                      {vote.candidateName}
                    </Text>
                    <Text className={classes.organization}>
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
                style={{
                  aspectRatio: 3 / 4,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: 16,
                  borderWidth: 1,
                  width: "100%",
                }}
              />
            ) : (
              <Feedback
                kind="warning"
                message="La foto no está disponible en este momento. Puedes revisar los números y la ubicación."
              />
            )
          ) : null}

          {activeTab === "map" ? (
            <View className={classes.mapSection}>
              <View className={classes.mapMetaRow}>
                <MapPin color={colors.primary} size={17} strokeWidth={2.2} />
                <Text className={classes.muted}>
                  Captura: {formatCapturedAt(acta.capturedAtDevice)}
                </Text>
              </View>
              <ProvincialActaMap points={acta.mapPoints} />
              {acta.warningMeters !== null ? (
                <View className={classes.warningBanner}>
                  <TriangleAlert
                    color={colors.accentDeep}
                    size={16}
                    strokeWidth={2.2}
                  />
                  <Text className={classes.warningText}>
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

const classes = {
  headerStrip: "border-b border-b-border border-l-[4px] border-l-primary pb-3 pl-3",
  headerTop: "flex-row items-start justify-between gap-2",
  headerCopy: "flex-1 gap-[2px]",
  headerEyebrow:
    "font-body-medium text-[12px] tracking-[0.4px] text-ink-muted",
  headerTitle: "font-body-bold text-[18px] leading-[23px] text-ink",
  muted: "font-body text-[13px] leading-[18px] text-ink-muted",
  resultsList: "border-t border-border",
  resultRow:
    "flex-row items-center justify-between border-b border-border py-4",
  resultLabel: "font-body-medium text-[15px] leading-[20px] text-ink",
  candidateRow:
    "flex-row items-center justify-between gap-2 border-b border-border py-4",
  candidateCopy: "flex-1 gap-[2px]",
  candidateName: "font-body-medium text-[14px] leading-[19px] text-ink",
  organization: "font-body text-[12px] leading-4 text-ink-muted",
  mapSection: "gap-2",
  mapMetaRow: "flex-row items-center gap-1",
  warningBanner:
    "flex-row items-center gap-2 rounded-md border border-accent-deep bg-accent-soft px-3 py-2",
  warningText: "flex-1 font-body-medium text-[13px] leading-[18px] text-ink",
} as const;
