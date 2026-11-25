import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { zodResolver } from "@hookform/resolvers/zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useForm, useWatch, type Path } from "react-hook-form";
import { z } from "zod";
import { History } from "lucide-react-native";

import type { RootStackParamList } from "../../../app/navigationTypes";
import { useAppSelector } from "../../../app/store";
import type { NoticeKind } from "../../../shared/presentation/messages";
import { colors, fonts, radii, spacing } from "../../../shared/presentation/theme";
import {
  AuthPage,
  Feedback,
  FormField,
  LoadingBlock,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  SegmentedTabs,
  StatusChip,
  WorkflowStrip,
  type StatusTone,
} from "../../access/presentation/components/AuthUi";
import { actaRepository } from "../data";
import type { ActaDraft, Location as ActaCoordinates } from "../domain/acta";
import { validateActaTally } from "../domain/actaRules";
import { ActaLocationCard } from "./ActaLocationCard";

type Props = NativeStackScreenProps<RootStackParamList, "ActaEditor">;

const countText = z.string().regex(/^\d*$/, "Ingresa un número entero no negativo.");
const formSchema = z.object({
  totalVoters: countText,
  blankVotes: countText,
  nullVotes: countText,
  candidateVotes: z.record(z.string(), countText),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(draft: ActaDraft): FormValues {
  return {
    totalVoters: draft.totalVoters?.toString() ?? "",
    blankVotes: draft.blankVotes?.toString() ?? "",
    nullVotes: draft.nullVotes?.toString() ?? "",
    candidateVotes: Object.fromEntries(
      draft.candidateVotes.map((candidate) => [
        candidate.candidateId,
        candidate.votes?.toString() ?? "",
      ]),
    ),
  };
}

function parseCount(value: string): number | null {
  return value === "" ? null : Number(value);
}

function applyFormValues(draft: ActaDraft, values: FormValues): ActaDraft {
  return {
    ...draft,
    totalVoters: parseCount(values.totalVoters),
    blankVotes: parseCount(values.blankVotes),
    nullVotes: parseCount(values.nullVotes),
    candidateVotes: draft.candidateVotes.map((candidate) => ({
      ...candidate,
      votes: parseCount(values.candidateVotes[candidate.candidateId] ?? ""),
    })),
  };
}

const statusMessages: Record<ActaDraft["status"], string> = {
  draft: "Primero toma una foto clara del acta. Después podrás revisar los números.",
  pending:
    "La foto está guardada. Cuando haya conexión, intentaremos leerla; también puedes escribir los números.",
  processing_ocr:
    "Estamos leyendo la foto. Puedes esperar o escribir los datos manualmente.",
  ready:
    "Revisa que cada número coincida con la foto. Nada se envía sin tu autorización.",
  sending:
    "Estamos subiendo el acta. Si no hay conexión, se enviará sola después.",
  sent: "Acta subida correctamente.",
  failed:
    "No pudimos completar un paso. El acta sigue guardada; puedes reintentar o escribir los datos.",
};

const statusPresentation: Record<
  ActaDraft["status"],
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

type NoticeState = {
  kind: NoticeKind;
  message: string;
  technicalDetails?: string;
};

export function ActaEditorScreen({ navigation, route }: Props) {
  const { actaId } = route.params;
  const session = useAppSelector((state) => state.auth.session);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const draftRef = useRef<ActaDraft | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState<ActaDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [editorTab, setEditorTab] = useState<"votes" | "evidence">("votes");
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const [submissionValidationError, setSubmissionValidationError] = useState<
    string | null
  >(null);
  const [sharpnessScore, setSharpnessScore] = useState<number | null>(null);
  const [sharpnessThreshold, setSharpnessThreshold] = useState<number | null>(
    null,
  );
  const [locationReferenceState, setLocationReferenceState] = useState<{
    precinctId: string;
    location: ActaCoordinates | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      totalVoters: "",
      blankVotes: "",
      nullVotes: "",
      candidateVotes: {},
    },
  });
  const watchedValues = useWatch({ control });

  const setCurrentDraft = useCallback((value: ActaDraft) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  const processQueue = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const outcomes = await Promise.all([
        actaRepository.processPendingOCR(session.userId),
        actaRepository.processPendingSubmissions(session.userId),
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
          : "No pudimos empezar a leer la foto. Puedes escribir los datos manualmente.",
      );
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }
    let active = true;
    const loadDraft = async () => {
      try {
        const found = await actaRepository.getDraft(actaId, session.userId);
        if (!found) {
          throw new Error("No se encontró el borrador local del acta.");
        }
        if (active) {
          setCurrentDraft(found);
          reset(toFormValues(found));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo abrir el borrador.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadDraft();
    const unsubscribeActa = actaRepository.subscribe((changedId) => {
      if (changedId !== actaId) {
        return;
      }
      void actaRepository
        .getDraft(actaId, session.userId)
        .then((updated) => {
          if (!active || !updated) {
            return;
          }
          const previous = draftRef.current;
          if (updated.status === "ready" && previous?.status !== "ready") {
            if (persistTimer.current) {
              clearTimeout(persistTimer.current);
              persistTimer.current = null;
            }
            reset(toFormValues(updated));
          }
          setCurrentDraft(updated);
        })
        .catch((readError: unknown) => {
          if (active) {
            setError(
              readError instanceof Error
                ? readError.message
                : "No se pudo actualizar el estado del acta.",
            );
          }
        });
    });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void processQueue();
      }
    });
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void processQueue();
      }
    });
    void NetInfo.fetch().then((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void processQueue();
      }
    }).catch((networkError: unknown) => {
      if (active) {
        setError(
          networkError instanceof Error
            ? networkError.message
            : "No se pudo comprobar la conectividad.",
        );
      }
    });
    return () => {
      active = false;
      unsubscribeActa();
      unsubscribeNetwork();
      appStateSubscription.remove();
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
      }
    };
  }, [actaId, processQueue, reset, session, setCurrentDraft]);

  useEffect(() => {
    const precinctId = draft?.precinctId;
    if (!precinctId || !session) {
      return;
    }
    let active = true;
    void actaRepository
      .getLocationReference(precinctId)
      .then((location) => {
        if (active) {
          setLocationReferenceState({ precinctId, location });
        }
      })
      .catch(() => {
        if (active) {
          setLocationReferenceState({ precinctId, location: null });
        }
      });
    return () => {
      active = false;
    };
  }, [draft?.precinctId, session]);

  const canEditResults =
    draft?.status === "ready" ||
    (draft?.status === "failed" && draft.failureStage === "submission");
  useEffect(() => {
    if (!canEditResults || isLoading || !draftRef.current) {
      return;
    }
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    persistTimer.current = setTimeout(() => {
      const current = draftRef.current;
      if (!current) {
        return;
      }
      void actaRepository
        .saveDraft(applyFormValues(current, getValues()))
        .catch((saveError: unknown) => {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "No se pudieron guardar localmente los resultados.",
          );
        });
    }, 350);
    return () => {
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        persistTimer.current = null;
      }
    };
  }, [canEditResults, getValues, isLoading, watchedValues]);

  const takePhoto = async () => {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (!permission.granted) {
          throw new Error("Se necesita permiso de cámara para fotografiar el acta.");
        }
      }
      const locationPermission =
        await Location.requestForegroundPermissionsAsync();
      if (!locationPermission.granted) {
        throw new Error(
          "Se necesita permiso de ubicación para asociar el lugar de captura al acta.",
        );
      }
      let locationTimeout: ReturnType<typeof setTimeout> | undefined;
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_resolve, reject) => {
          locationTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  "No pudimos obtener la ubicación después de 20 segundos. Verifica el GPS y vuelve a intentarlo.",
                ),
              ),
            20_000,
          );
        }),
      ]).finally(() => {
        if (locationTimeout !== undefined) {
          clearTimeout(locationTimeout);
        }
      });
      const picture = await cameraRef.current?.takePictureAsync({
        quality: 0.9,
      });
      if (!picture?.uri) {
        throw new Error("La cámara no devolvió una fotografía.");
      }
      const current = draftRef.current;
      if (!current) {
        throw new Error("El borrador todavía no está disponible.");
      }
      const capturedAt = new Date().toISOString();
      const result = await actaRepository.acceptCameraPhoto(
        current,
        picture.uri,
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        capturedAt,
      );
      setSharpnessScore(result.sharpnessScore);
      setSharpnessThreshold(result.threshold);
      if (!result.draft) {
        setNotice(
          result.threshold === null
            ? {
                kind: "warning",
                message:
                  "No pudimos revisar la nitidez de la foto. Toma otra con más luz y sin mover el teléfono.",
                technicalDetails:
                  "Falta configurar EXPO_PUBLIC_IMAGE_SHARPNESS_THRESHOLD. Mide imágenes de prueba antes de exigir este control.",
              }
            : {
                kind: "warning",
                message:
                  "La foto no se ve clara. Toma otra con más luz y sin mover el teléfono.",
              },
        );
        return;
      }
      setCurrentDraft(result.draft);
      setShowCamera(false);
      if (result.warningMeters !== null) {
        setNotice({
          kind: "warning",
          message: `La foto se tomó a ${Math.round(result.warningMeters)} m del punto esperado. Queda como aviso; puedes continuar.`,
        });
      } else if (result.cleanupWarning) {
        setNotice({
          kind: "warning",
          message:
            "La foto se guardó, pero hubo un aviso al ordenar los archivos temporales. No afecta el acta.",
          technicalDetails: result.cleanupWarning,
        });
      } else {
        setNotice({
          kind: "success",
          message:
            "Foto guardada en este dispositivo. Revisa que los números se lean bien.",
        });
      }
      void processQueue();
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "No se pudo tomar la fotografía.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const saveManualResults = async (values: FormValues) => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const ready = await actaRepository.enterResultsManually(current);
      const updated = applyFormValues(ready, values);
      await actaRepository.saveDraft(updated);
      setCurrentDraft(updated);
      setNotice({
        kind: "success",
        message:
          "Resultados guardados en este dispositivo. Revisa que los números coincidan antes de enviar.",
      });
    } catch (manualError) {
      setError(
        manualError instanceof Error
          ? manualError.message
          : "No se pudieron guardar los resultados manuales.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const retryOCR = async () => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    setIsBusy(true);
    setError(null);
    setNotice({
      kind: "info",
      message:
        "Vamos a intentar leer la foto otra vez. También puedes escribir los datos manualmente.",
    });
    try {
      await actaRepository.retryOCR(current);
      void processQueue();
    } catch (ocrError) {
      setError(
        ocrError instanceof Error
          ? ocrError.message
          : "No pudimos intentar leer la foto otra vez.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const submitActa = async (values: FormValues) => {
    const current = draftRef.current;
    if (!current) {
      return;
    }
    setIsBusy(true);
    setError(null);
    setNotice(null);
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    try {
      const reviewed = applyFormValues(current, values);
      await actaRepository.saveDraft(reviewed);
      const submitted = await actaRepository.submitReviewedActa(reviewed);
      setCurrentDraft(submitted);
      setNotice(
        submitted.status === "sent"
          ? {
              kind: "success",
              message: "Acta subida correctamente.",
            }
          : {
              kind: "info",
              message:
                "El acta quedó lista para subir. Se enviará sola cuando vuelva la conexión.",
            },
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar el acta. El borrador permanece guardado.",
      );
      try {
        const latest = await actaRepository.getDraft(
          actaId,
          current.ownerId,
        );
        if (latest) {
          setCurrentDraft(latest);
        }
      } catch (readError) {
        setError((message) =>
          [
            message,
            readError instanceof Error
              ? `No se pudo actualizar el estado local: ${readError.message}`
              : "No se pudo actualizar el estado local del acta.",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const requestSubmit = (values: FormValues) => {
    setSubmissionValidationError(null);
    const current = draftRef.current;
    if (!current) {
      return;
    }
    const tallyErrors = validateActaTally(applyFormValues(current, values));
    if (tallyErrors.length > 0) {
      setNotice(null);
      setSubmissionValidationError(tallyErrors.join(" "));
      return;
    }
    setError(null);
    setShowSubmitConfirmation(true);
  };

  const enterReview = async () => {
    if (!draftRef.current) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const ready = await actaRepository.enterResultsManually(draftRef.current);
      setCurrentDraft(ready);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "No se pudo abrir la revisión manual.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const field = (
    name: Path<FormValues>,
    label: string,
  ) => (
    <FormField<FormValues>
      control={control}
      keyboardType="number-pad"
      label={label}
      name={name}
      numeric
      placeholder="Sin dato"
    />
  );

  if (isLoading) {
    return (
      <AuthPage>
        <PageTitle
          eyebrow="Acta"
          title="Abriendo el acta"
          description="Estamos recuperando la foto y los datos guardados en este dispositivo."
        />
        <LoadingBlock message="Cargando el acta…" />
      </AuthPage>
    );
  }

  if (!draft) {
    return (
      <AuthPage>
        <PageTitle
          eyebrow="Acta"
          title="No encontramos esta acta"
          description="El borrador no está disponible en este dispositivo. Vuelve a la lista y ábrela de nuevo."
        />
        {error ? <Feedback message={error} /> : null}
        <SecondaryButton
          label="Volver a mis actas"
          onPress={() => navigation.goBack()}
        />
      </AuthPage>
    );
  }

  const canCapture =
    draft.status === "draft" ||
    draft.status === "ready" ||
    (draft.status === "failed" && draft.failureStage === "submission");
  const status = statusPresentation[draft.status];
  const statusKind: NoticeKind =
    draft.status === "failed"
      ? "error"
      : draft.status === "sent"
        ? "success"
        : "info";
  const workflowSteps: {
    label: string;
    state: "done" | "current" | "todo" | "error";
  }[] = [
    {
      label: "Foto",
      state: draft.photoUri ? "done" : "current",
    },
    {
      label: "Revisión",
      state: canEditResults
        ? "current"
        : draft.status === "sent" ||
            draft.status === "sending" ||
            (draft.status === "failed" &&
              draft.failureStage === "submission")
          ? "done"
          : draft.status === "failed"
            ? "error"
            : "todo",
    },
    {
      label: "Envío",
      state:
        draft.status === "sent"
          ? "done"
          : draft.status === "sending"
            ? "current"
            : draft.status === "failed" &&
                draft.failureStage === "submission"
              ? "error"
              : "todo",
    },
  ];

  return (
    <AuthPage
      headerRight={
        <Pressable
          accessibilityLabel="Ver historial de cambios"
          accessibilityRole="button"
          onPress={() => navigation.navigate("ActaHistory", { actaId })}
          style={styles.historyButton}
        >
          <History color={colors.primaryDark} size={18} strokeWidth={2.2} />
        </Pressable>
      }
      onBack={() => navigation.goBack()}
      overlay={
        <Modal
          animationType="fade"
          onRequestClose={() => setShowSubmitConfirmation(false)}
          transparent
          visible={showSubmitConfirmation}
        >
          <View style={styles.confirmationBackdrop}>
            <View style={styles.confirmationCard}>
              <Feedback
                kind="warning"
                title={
                  draft.correctionMode
                    ? "Confirmar corrección"
                    : "Confirmar envío"
                }
                message="Verifica los datos del acta. Al confirmar, quedará autorizada para su envío."
              />
              <View style={styles.confirmationSummary}>
                <View style={styles.confirmationRow}>
                  <Text style={styles.confirmationLabel}>Recinto</Text>
                  <Text style={styles.confirmationValue}>
                    {draft.precinctName}
                  </Text>
                </View>
                <View style={styles.confirmationRow}>
                  <Text style={styles.confirmationLabel}>Mesa</Text>
                  <Text style={styles.confirmationValue}>
                    {draft.stationNumber}
                  </Text>
                </View>
                <View style={styles.confirmationRow}>
                  <Text style={styles.confirmationLabel}>Acta</Text>
                  <Text style={styles.confirmationValue}>
                    {draft.office === "mayor" ? "Alcaldía" : "Prefectura"}
                  </Text>
                </View>
              </View>
              <PrimaryButton
                disabled={isBusy}
                label={
                  draft.correctionMode
                    ? "Sí, enviar corrección"
                    : "Sí, enviar acta"
                }
                onPress={() => {
                  setShowSubmitConfirmation(false);
                  void handleSubmit(submitActa)();
                }}
              />
              <SecondaryButton
                disabled={isBusy}
                label="Seguir revisando"
                onPress={() => setShowSubmitConfirmation(false)}
              />
            </View>
          </View>
        </Modal>
      }
    >
      <PageTitle
        eyebrow={
          draft.correctionMode ? "Corrección de acta" : "Acta en tu dispositivo"
        }
        title={`${draft.precinctName} · Mesa ${draft.stationNumber}`}
        description={`${draft.office === "mayor" ? "Alcaldía" : "Prefectura"}${draft.stationSex ? ` · ${draft.stationSex === "female" ? "Mujeres" : "Hombres"}` : ""}${draft.correctionMode ? " · Corrección" : ""}.`}
      />

      <View style={styles.statusRow}>
        <StatusChip label={status.label} tone={status.tone} />
        <Text style={styles.statusMeta}>
          {draft.correctionMode ? "Corrección" : "Captura"} ·{" "}
          {draft.office === "mayor" ? "Alcaldía" : "Prefectura"}
        </Text>
      </View>
      <WorkflowStrip steps={workflowSteps} />
      <Feedback kind={statusKind} message={statusMessages[draft.status]} />
      {error ? <Feedback message={error} /> : null}
      {notice ? (
        <Feedback
          kind={notice.kind}
          message={notice.message}
          technicalDetails={notice.technicalDetails}
        />
      ) : null}
      {sharpnessScore !== null ? (
        <Feedback
          kind="info"
          title="Calidad de la foto"
          message="La foto está guardada. Si no se lee bien, puedes tomarla de nuevo."
          technicalDetails={`Nitidez calculada: ${sharpnessScore.toFixed(2)}${sharpnessThreshold === null ? " · Umbral sin calibrar" : ` · Umbral ${sharpnessThreshold}`}.`}
        />
      ) : null}

      {canEditResults && draft.photoUri ? (
        <SegmentedTabs
          onChange={setEditorTab}
          options={[
            { key: "votes", label: "Votos" },
            { key: "evidence", label: "Foto y mapa" },
          ]}
          value={editorTab}
        />
      ) : null}

      {(!canEditResults || editorTab === "evidence" || !draft.photoUri) ? (
        <>
          {draft.photoUri ? (
            <View style={styles.evidenceSection}>
              <View style={styles.photoHeader}>
                <SectionTitle>Foto del acta</SectionTitle>
                <StatusChip label="Guardada" tone="success" />
              </View>
              <View style={styles.photoFrame}>
                <Image
                  accessibilityLabel="Fotografía del acta guardada en este dispositivo"
                  resizeMode="contain"
                  source={{ uri: draft.photoUri }}
                  style={styles.photo}
                />
              </View>
              <ActaLocationCard
                capturedAt={draft.capturedAtDevice}
                location={
                  draft.latitude !== null && draft.longitude !== null
                    ? {
                        latitude: draft.latitude,
                        longitude: draft.longitude,
                      }
                    : null
                }
                warningMeters={draft.locationWarningMeters}
                reference={
                  locationReferenceState?.precinctId === draft.precinctId
                    ? locationReferenceState.location
                    : null
                }
              />
            </View>
          ) : null}

          {showCamera && canCapture ? (
            <View style={styles.cameraSection}>
              <SectionTitle>Tomar foto</SectionTitle>
              <Text style={styles.muted}>
                Apoya el teléfono y procura que se lean todos los números. Evita
                sombras y movimientos.
              </Text>
              {cameraPermission?.granted ? (
                <View style={styles.cameraFrame}>
                  <CameraView
                    ref={cameraRef}
                    facing="back"
                    mode="picture"
                    style={styles.camera}
                  />
                </View>
              ) : (
                <View style={styles.permission}>
                  <Text style={styles.muted}>
                    La cámara necesita permiso para fotografiar el acta.
                  </Text>
                  <SecondaryButton
                    label="Permitir cámara"
                    onPress={() => void requestCameraPermission()}
                  />
                </View>
              )}
              <PrimaryButton
                disabled={isBusy || !cameraPermission?.granted}
                label={isBusy ? "Tomando foto…" : "Tomar foto"}
                onPress={() => void takePhoto()}
              />
              <SecondaryButton
                disabled={isBusy}
                label="Cerrar cámara"
                onPress={() => setShowCamera(false)}
              />
            </View>
          ) : null}

          {!showCamera && canCapture ? (
            <SecondaryButton
              disabled={isBusy}
              label={draft.photoUri ? "Tomar otra foto" : "Abrir cámara"}
              onPress={() => setShowCamera(true)}
            />
          ) : null}

          {draft.photoUri && !canEditResults ? (
            <View style={styles.actions}>
              {draft.status === "pending" ||
              (draft.status === "failed" && draft.failureStage === "ocr") ? (
                <SecondaryButton
                  disabled={isBusy}
                  label={isBusy ? "Intentando…" : "Intentar leer la foto otra vez"}
                  onPress={() => void retryOCR()}
                />
              ) : null}
              {draft.status !== "sent" &&
              draft.status !== "sending" ? (
                <PrimaryButton
                  disabled={isBusy}
                  label="Escribir resultados manualmente"
                  onPress={() => void enterReview()}
                />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {canEditResults && (editorTab === "votes" || !draft.photoUri) ? (
        <View style={styles.form}>
          <SectionTitle>Revisa los números del acta</SectionTitle>
          <Feedback
            kind="info"
            message="Si un dato no se puede leer, deja el campo vacío: se marcará como Revisión, pero tendrás que verificarlo antes de enviar. Escribe 0 solo si el acta dice 0."
          />
          {field("totalVoters", "Sufragantes")}
          {field("blankVotes", "Votos en blanco")}
          {field("nullVotes", "Votos nulos")}
          {draft.candidateVotes.map((candidate) => (
            <View key={candidate.candidateId} style={styles.candidateRow}>
              <View style={styles.candidateHead}>
                <View style={styles.candidateCopy}>
                  <Text style={styles.candidateName}>
                    {candidate.candidateName}
                  </Text>
                  <Text style={styles.organization}>
                    {candidate.organizationName}
                  </Text>
                </View>
              </View>
              {field(
                `candidateVotes.${candidate.candidateId}` as Path<FormValues>,
                "Votos",
              )}
            </View>
          ))}
          <SecondaryButton
            disabled={isBusy}
            label={isBusy ? "Guardando…" : "Guardar y seguir revisando"}
            onPress={() => void handleSubmit(saveManualResults)()}
          />
          {submissionValidationError ? (
            <Feedback kind="error" message={submissionValidationError} />
          ) : null}
          <PrimaryButton
            disabled={isBusy}
            label={
              draft.correctionMode
                ? "Revisé y quiero enviar la corrección"
                : "Revisé y quiero enviar el acta"
            }
            onPress={() =>
              void handleSubmit(requestSubmit, () => {
                setSubmissionValidationError(
                  "Revisa los campos marcados antes de continuar.",
                );
              })()
            }
          />
        </View>
      ) : null}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  historyButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  evidenceSection: {
    gap: spacing.md,
  },
  cameraSection: {
    gap: spacing.sm,
  },
  candidateRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  muted: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  statusMeta: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  photoCard: {
    gap: spacing.md,
  },
  photoHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  photoFrame: {
    backgroundColor: colors.navy,
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  photo: {
    height: 290,
    width: "100%",
  },
  photoCaption: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  cameraCard: {
    gap: spacing.sm,
  },
  cameraFrame: {
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  camera: {
    height: 340,
    width: "100%",
  },
  permission: {
    alignItems: "center",
    backgroundColor: colors.navy,
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    justifyContent: "center",
    minHeight: 180,
    padding: spacing.lg,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.sm,
  },
  candidate: {
    backgroundColor: colors.navy,
    borderColor: colors.navyBorder,
    borderLeftColor: colors.red,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
    padding: spacing.md,
  },
  candidateHead: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  candidateCopy: {
    flex: 1,
  },
  candidateMark: {
    backgroundColor: colors.red,
    borderRadius: 3,
    height: 7,
    marginTop: 6,
    width: 7,
  },
  candidateName: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  organization: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  confirmationBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(4, 12, 20, 0.78)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  confirmationCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    maxWidth: 480,
    padding: spacing.lg,
    width: "100%",
  },
  confirmationSummary: {
    backgroundColor: colors.navy,
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  confirmationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  confirmationLabel: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  confirmationValue: {
    color: colors.white,
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "right",
  },
});
