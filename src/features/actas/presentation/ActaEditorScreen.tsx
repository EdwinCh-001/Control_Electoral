import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
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

import type { RootStackParamList } from "../../../app/navigationTypes";
import { useAppSelector } from "../../../app/store";
import {
  AuthPage,
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../../access/presentation/components/AuthUi";
import { actaRepository } from "../data";
import type { ActaDraft } from "../domain/acta";

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
  draft: "Toma una fotografía con la cámara para iniciar el acta.",
  pending: "La fotografía está guardada. El OCR se ejecutará al tener conexión; también puedes ingresar los datos manualmente.",
  processing_ocr: "Leyendo la fotografía. Puedes esperar el resultado o continuar con la revisión manual.",
  ready: "Revisa la propuesta o los datos ingresados. El acta no se envía hasta que autorices.",
  sending: "Envío autorizado y guardado. Se sincronizará cuando haya conexión; el servidor todavía no lo confirma.",
  sent: "El servidor confirmó el envío del acta.",
  failed: "Ocurrió un problema. Revisa el detalle y reintenta o continúa manualmente.",
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
  const [sharpnessScore, setSharpnessScore] = useState<number | null>(null);
  const [sharpnessThreshold, setSharpnessThreshold] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
          : "No se pudo iniciar el procesamiento OCR.",
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
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
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
            ? "No se aceptó la foto: falta calibrar el umbral real de nitidez. Configura EXPO_PUBLIC_IMAGE_SHARPNESS_THRESHOLD después de medir imágenes de prueba."
            : "La fotografía no alcanzó el nivel de nitidez requerido. Tómala nuevamente.",
        );
        return;
      }
      setCurrentDraft(result.draft);
      setShowCamera(false);
      if (result.warningMeters !== null) {
        setNotice(
          `Aviso: la captura está a ${Math.round(result.warningMeters)} m de la primera ubicación registrada para este recinto.`,
        );
      } else {
        setNotice(
          result.cleanupWarning ??
            "Fotografía guardada en el dispositivo. Los resultados aún requieren revisión.",
        );
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
      setNotice("Resultados guardados localmente. Revisa el cuadre antes de enviar.");
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
    setNotice("Se intentará procesar la fotografía. Puedes continuar manualmente.");
    try {
      await actaRepository.retryOCR(current);
    } catch (ocrError) {
      setError(
        ocrError instanceof Error
          ? ocrError.message
          : "No se pudo reintentar el OCR.",
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
          ? "El servidor confirmó el envío del acta."
          : "Autorización guardada. El envío se completará al recuperar la conexión.",
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
      placeholder="0"
    />
  );

  if (isLoading) {
    return (
      <AuthPage>
        <ActivityIndicator accessibilityLabel="Cargando borrador" />
        <Text style={styles.muted}>Cargando borrador…</Text>
      </AuthPage>
    );
  }

  if (!draft) {
    return (
      <AuthPage>
        <PageTitle title="Acta no disponible" description="No se pudo abrir el borrador local." />
        {error ? <Feedback message={error} /> : null}
        <SecondaryButton label="Volver" onPress={() => navigation.goBack()} />
      </AuthPage>
    );
  }

  const canCapture =
    draft.status === "draft" ||
    draft.status === "ready" ||
    (draft.status === "failed" && draft.failureStage === "submission");

  return (
    <AuthPage>
      <PageTitle
        title={`${draft.precinctName} · Mesa ${draft.stationNumber}`}
        description={`Acta para ${draft.office === "mayor" ? "Alcaldía" : "Prefectura"}${draft.correctionMode ? " · Corrección" : ""}.`}
      />
      <Feedback kind="info" message={statusMessages[draft.status]} />
      {error ? <Feedback message={error} /> : null}
      {notice ? <Feedback kind="success" message={notice} /> : null}
      {draft.locationWarningMeters !== null ? (
        <Feedback
          kind="info"
          message={`La ubicación está a ${Math.round(draft.locationWarningMeters)} m de la primera foto registrada en el recinto. El aviso no bloquea el envío.`}
        />
      ) : null}
      {sharpnessScore !== null ? (
        <Feedback
          kind="info"
          message={`Nitidez calculada: ${sharpnessScore.toFixed(2)}${sharpnessThreshold === null ? " · Umbral sin calibrar" : ` · Umbral ${sharpnessThreshold}`}.`}
        />
      ) : null}

      {draft.photoUri ? (
        <View style={styles.photoCard}>
          <Image
            accessibilityLabel="Fotografía del acta guardada en este dispositivo"
            resizeMode="contain"
            source={{ uri: draft.photoUri }}
            style={styles.photo}
          />
          <Text style={styles.photoCaption}>Evidencia guardada localmente</Text>
        </View>
      ) : null}

      {showCamera && canCapture ? (
        <View style={styles.cameraCard}>
          {cameraPermission?.granted ? (
            <CameraView
              ref={cameraRef}
              facing="back"
              mode="picture"
              style={styles.camera}
            />
          ) : (
            <View style={styles.permission}>
              <Text style={styles.muted}>
                La cámara requiere permiso para tomar la fotografía.
              </Text>
              <SecondaryButton
                label="Permitir cámara"
                onPress={() => void requestCameraPermission()}
              />
            </View>
          )}
          <PrimaryButton
            disabled={isBusy || !cameraPermission?.granted}
            label={isBusy ? "Capturando…" : "Tomar fotografía"}
            onPress={() => void takePhoto()}
          />
          <SecondaryButton
            disabled={isBusy}
            label="Cancelar cámara"
            onPress={() => setShowCamera(false)}
          />
        </View>
      ) : null}
      {!showCamera && canCapture ? (
        <SecondaryButton
          disabled={isBusy}
          label={draft.photoUri ? "Tomar otra fotografía" : "Abrir cámara"}
          onPress={() => setShowCamera(true)}
        />
      ) : null}

      {draft.photoUri && !canEditResults ? (
        <View style={styles.actions}>
          {draft.status === "pending" ||
          (draft.status === "failed" && draft.failureStage === "ocr") ? (
            <SecondaryButton
              disabled={isBusy}
              label={isBusy ? "Procesando…" : "Reintentar OCR"}
              onPress={() => void retryOCR()}
            />
          ) : null}
          {draft.status !== "processing_ocr" &&
          draft.status !== "sent" &&
          draft.status !== "sending" ? (
            <PrimaryButton
              disabled={isBusy}
              label="Ingresar o revisar resultados manualmente"
              onPress={() => void enterReview()}
            />
          ) : null}
        </View>
      ) : null}

      {canEditResults ? (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Revisión de resultados</Text>
          <Text style={styles.muted}>
            Verifica cada valor con la fotografía. Los campos vacíos no se pueden enviar.
          </Text>
          {field("totalVoters", "Sufragantes")}
          {field("blankVotes", "Votos en blanco")}
          {field("nullVotes", "Votos nulos")}
          {draft.candidateVotes.map((candidate) => (
            <View key={candidate.candidateId} style={styles.candidate}>
              <Text style={styles.candidateName}>{candidate.candidateName}</Text>
              <Text style={styles.organization}>{candidate.organizationName}</Text>
              {field(
                `candidateVotes.${candidate.candidateId}` as Path<FormValues>,
                "Votos",
              )}
            </View>
          ))}
          <PrimaryButton
            disabled={isBusy}
            label={isBusy ? "Guardando…" : "Guardar revisión manual"}
            onPress={() => void handleSubmit(saveManualResults)()}
          />
          <PrimaryButton
            disabled={isBusy}
            label={
              isBusy
                ? "Enviando…"
                : draft.correctionMode
                  ? "Revisé y autorizo la corrección"
                  : "Revisé y autorizo el envío"
            }
            onPress={() => void handleSubmit(submitActa)()}
          />
        </View>
      ) : null}
      <SecondaryButton
        disabled={isBusy}
        label="Ver historial de auditoría"
        onPress={() => navigation.navigate("ActaHistory", { actaId })}
      />
      <SecondaryButton
        disabled={isBusy}
        label="Volver a actas"
        onPress={() => navigation.goBack()}
      />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
  },
  photoCard: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    marginBottom: 16,
    padding: 12,
  },
  photo: {
    height: 260,
    width: "100%",
  },
  photoCaption: {
    color: "#374151",
    fontSize: 13,
    marginTop: 8,
  },
  cameraCard: {
    gap: 10,
    marginBottom: 12,
  },
  camera: {
    height: 340,
    width: "100%",
  },
  permission: {
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    gap: 12,
    minHeight: 180,
    justifyContent: "center",
    padding: 16,
  },
  actions: {
    gap: 6,
  },
  form: {
    borderTopColor: "#D1D5DB",
    borderTopWidth: 1,
    gap: 8,
    marginTop: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "700",
  },
  candidate: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginTop: 8,
    padding: 12,
  },
  candidateName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  organization: {
    color: "#4B5563",
    fontSize: 13,
    marginBottom: 12,
    marginTop: 3,
  },
});
