import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../../app/navigationTypes";
import { useAppSelector } from "../../../../app/store";
import { colors, fonts, radii, spacing } from "../../../../shared/presentation/theme";
import type {
  AppRole,
  AssignablePrecinct,
  ManagedAccountResult,
} from "../../domain/auth";
import { useAuthRepository } from "../AuthRepositoryContext";
import {
  AuthPage,
  EmptyState,
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusChip,
  WorkflowStrip,
} from "../components/AuthUi";

const accountSchema = z.object({
  fullName: z.string().trim().min(1, "Ingresa nombres y apellidos."),
  nationalId: z.string().trim().min(1, "Ingresa la cédula."),
  phone: z.string().trim().min(1, "Ingresa el teléfono."),
  email: z.email("Ingresa un correo válido.").trim().toLowerCase(),
});

type AccountValues = z.infer<typeof accountSchema>;
type AccountStep = "details" | "precinct";
type Props = NativeStackScreenProps<RootStackParamList, "ManageAccounts">;

const roleLabels: Record<AppRole, string> = {
  provincial_coordinator: "Coordinador provincial",
  precinct_coordinator: "Coordinador de recinto",
  observer: "Veedor",
};

export function ManageAccountsScreen({ navigation }: Props) {
  const authRepository = useAuthRepository();
  const session = useAppSelector((state) => state.auth.session);
  const role = session?.profile.role;
  const isProvincial = role === "provincial_coordinator";
  const canCreate = isProvincial || role === "precinct_coordinator";
  const [precincts, setPrecincts] = useState<AssignablePrecinct[]>([]);
  const [selectedPrecinctId, setSelectedPrecinctId] = useState("");
  const [step, setStep] = useState<AccountStep>("details");
  const [isLoadingPrecincts, setIsLoadingPrecincts] = useState(isProvincial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] =
    useState<ManagedAccountResult | null>(null);
  const [createdPrecinctName, setCreatedPrecinctName] = useState<string | null>(
    null,
  );
  const { control, handleSubmit, reset } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName: "",
      nationalId: "",
      phone: "",
      email: "",
    },
  });

  useEffect(() => {
    if (!isProvincial) {
      return;
    }
    let active = true;

    void authRepository
      .listAssignablePrecincts()
      .then((items) => {
        if (!active) {
          return;
        }
        setPrecincts(items);
        setIsLoadingPrecincts(false);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los recintos autorizados.",
        );
        setIsLoadingPrecincts(false);
      });

    return () => {
      active = false;
    };
  }, [authRepository, isProvincial]);

  if (!session || !canCreate) {
    return (
      <AuthPage>
        <PageTitle
          eyebrow="Acceso"
          title="No puedes crear cuentas"
          description="Solo coordinadores pueden crear accesos para el equipo."
        />
        <SecondaryButton
          label="Volver al inicio"
          onPress={() => navigation.goBack()}
        />
      </AuthPage>
    );
  }

  const saveAccount = handleSubmit(async (values) => {
    setError(null);
    setCreatedAccount(null);
    setCreatedPrecinctName(null);

    if (isProvincial && !selectedPrecinctId) {
      setError(
        "Elige un recinto sin coordinador. La asignación se registra al crear la cuenta.",
      );
      return;
    }

    setIsSubmitting(true);
    const selectedPrecinct = precincts.find(
      (precinct) => precinct.id === selectedPrecinctId,
    );
    try {
      const input = {
        ...values,
        ...(isProvincial ? { precinctId: selectedPrecinctId } : {}),
      };
      const result = await authRepository.createManagedAccount(input);
      setCreatedAccount(result);
      setCreatedPrecinctName(
        isProvincial ? (selectedPrecinct?.name ?? null) : null,
      );
      reset();
      setSelectedPrecinctId("");
      setStep("details");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const goToPrecinctStep = handleSubmit(() => {
    setError(null);
    setCreatedAccount(null);
    setCreatedPrecinctName(null);
    setStep("precinct");
  });

  return (
    <AuthPage onBack={() => navigation.goBack()}>
      <PageTitle
        eyebrow="Equipo"
        title={isProvincial ? "Crear coordinador" : "Registrar veedor"}
        description={
          isProvincial
            ? "Primero los datos, luego el recinto."
            : "Crea el acceso; asigna las mesas después."
        }
      />

      {isProvincial ? (
        <WorkflowStrip
          steps={[
            {
              label: "Datos",
              state: step === "details" ? "current" : "done",
            },
            {
              label: "Recinto",
              state: step === "precinct" ? "current" : "todo",
            },
          ]}
        />
      ) : null}

      {step === "details" ? (
        <>
          <SectionTitle>Datos de la persona</SectionTitle>
          <FormField
            autoCapitalize="words"
            control={control}
            label="Nombres y apellidos"
            name="fullName"
            placeholder="Nombre completo"
            textContentType="name"
          />
          <FormField
            autoCapitalize="none"
            control={control}
            label="Cédula"
            name="nationalId"
            placeholder="Número de identificación"
          />
          <FormField
            autoCapitalize="none"
            control={control}
            keyboardType="phone-pad"
            label="Teléfono"
            name="phone"
            placeholder="Número de contacto"
            textContentType="telephoneNumber"
          />
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            control={control}
            keyboardType="email-address"
            label="Correo electrónico"
            name="email"
            placeholder="nombre@correo.com"
            textContentType="emailAddress"
          />
        </>
      ) : (
        <>
          <SectionTitle>Recinto sin coordinador</SectionTitle>
          {isLoadingPrecincts ? (
            <Feedback kind="info" message="Cargando recintos…" />
          ) : precincts.length === 0 ? (
            <EmptyState
              title="No hay recintos libres"
              message="Si todos los recintos ya tienen coordinador, no se puede crear otra cuenta de coordinador."
            />
          ) : (
            <View style={styles.options}>
              {precincts.map((precinct) => {
                const isSelected = selectedPrecinctId === precinct.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    key={precinct.id}
                    onPress={() => setSelectedPrecinctId(precinct.id)}
                    style={[
                      styles.precinctOption,
                      isSelected ? styles.precinctSelected : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.optionDot,
                        isSelected ? styles.optionDotSelected : null,
                      ]}
                    >
                      {isSelected ? <View style={styles.optionDotFill} /> : null}
                    </View>
                    <View style={styles.optionCopy}>
                      <Text
                        style={[
                          styles.precinctName,
                          isSelected ? styles.precinctNameSelected : null,
                        ]}
                      >
                        {precinct.name}
                      </Text>
                      <Text style={styles.precinctDetail}>
                        {precinct.parish} · {precinct.cantonName}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {createdAccount ? (
        <View style={styles.resultBanner}>
          <View style={styles.resultHeader}>
            <View style={styles.resultCopy}>
              <Text style={styles.resultEyebrow}>Cuenta creada</Text>
              <Text style={styles.resultTitle}>{createdAccount.email}</Text>
            </View>
            <StatusChip label="Lista" tone="success" />
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Rol</Text>
            <Text style={styles.resultValue}>
              {roleLabels[createdAccount.role]}
            </Text>
          </View>
          {createdPrecinctName ? (
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Recinto</Text>
              <Text style={styles.resultValue}>{createdPrecinctName}</Text>
            </View>
          ) : null}
          <Text style={styles.passwordLabel}>
            Contraseña temporal · se muestra una sola vez
          </Text>
          <Text selectable style={styles.password}>
            {createdAccount.temporaryPassword}
          </Text>
          <Feedback
            kind="warning"
            title="Compártela de forma segura"
            message="La persona deberá confirmar su correo y cambiar la contraseña en el primer acceso."
          />
        </View>
      ) : null}
      {error ? <Feedback message={error} /> : null}

      {isProvincial && step === "precinct" ? (
        <SecondaryButton
          label="Volver a datos"
          onPress={() => setStep("details")}
        />
      ) : null}

      {isProvincial && step === "details" ? (
        <PrimaryButton label="Continuar" onPress={() => void goToPrecinctStep()} />
      ) : (
        <PrimaryButton
          disabled={
            isSubmitting ||
            (isProvincial && (isLoadingPrecincts || !selectedPrecinctId))
          }
          label={isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
          onPress={() => void saveAccount()}
        />
      )}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: spacing.sm,
  },
  precinctOption: {
    alignItems: "center",
    backgroundColor: colors.navyDeep,
    borderColor: colors.navyBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  precinctSelected: {
    backgroundColor: colors.redSoft,
    borderColor: colors.red,
  },
  optionDot: {
    alignItems: "center",
    borderColor: colors.boneMuted,
    borderRadius: 8,
    borderWidth: 1,
    height: 16,
    justifyContent: "center",
    width: 16,
  },
  optionDotSelected: {
    borderColor: colors.red,
  },
  optionDotFill: {
    backgroundColor: colors.red,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  optionCopy: {
    flex: 1,
    gap: 1,
  },
  precinctName: {
    color: colors.bone,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  precinctNameSelected: {
    color: colors.white,
  },
  precinctDetail: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  resultBanner: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftColor: colors.primary,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  resultHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  resultCopy: {
    flex: 1,
    gap: 1,
  },
  resultEyebrow: {
    color: colors.boneMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  resultTitle: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 21,
  },
  resultRow: {
    alignItems: "center",
    borderTopColor: colors.navyBorder,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  resultLabel: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  resultValue: {
    color: colors.bone,
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "right",
  },
  passwordLabel: {
    color: colors.boneMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  password: {
    backgroundColor: colors.navy,
    borderColor: colors.emerald,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 18,
    letterSpacing: 0.8,
    padding: spacing.md,
    textAlign: "center",
  },
});
