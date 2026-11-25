import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../../../../app/navigationTypes";
import { useAppSelector } from "../../../../app/store";
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
            <View className={classes.options}>
              {precincts.map((precinct) => {
                const isSelected = selectedPrecinctId === precinct.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    className={`${classes.precinctOption} ${isSelected ? classes.precinctSelected : ""}`}
                    key={precinct.id}
                    onPress={() => setSelectedPrecinctId(precinct.id)}
                  >
                    <View
                      className={`${classes.optionDot} ${isSelected ? classes.optionDotSelected : ""}`}
                    >
                      {isSelected ? <View className={classes.optionDotFill} /> : null}
                    </View>
                    <View className={classes.optionCopy}>
                      <Text
                        className={`${classes.precinctName} ${isSelected ? classes.precinctNameSelected : ""}`}
                      >
                        {precinct.name}
                      </Text>
                      <Text className={classes.precinctDetail}>
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
        <View className={classes.resultBanner}>
          <View className={classes.resultHeader}>
            <View className={classes.resultCopy}>
              <Text className={classes.resultEyebrow}>Cuenta creada</Text>
              <Text className={classes.resultTitle}>{createdAccount.email}</Text>
            </View>
            <StatusChip label="Lista" tone="success" />
          </View>
          <View className={classes.resultRow}>
            <Text className={classes.resultLabel}>Rol</Text>
            <Text className={classes.resultValue}>
              {roleLabels[createdAccount.role]}
            </Text>
          </View>
          {createdPrecinctName ? (
            <View className={classes.resultRow}>
              <Text className={classes.resultLabel}>Recinto</Text>
              <Text className={classes.resultValue}>{createdPrecinctName}</Text>
            </View>
          ) : null}
          <Text className={classes.passwordLabel}>
            Contraseña temporal · se muestra una sola vez
          </Text>
          <Text selectable className={classes.password}>
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

const classes = {
  options: "gap-2",
  precinctOption:
    "flex-row items-center gap-2 rounded-md border border-border bg-surface p-3",
  precinctSelected: "border-primary bg-primary-soft-bg",
  optionDot:
    "h-4 w-4 items-center justify-center rounded-sm border border-ink-muted",
  optionDotSelected: "border-primary",
  optionDotFill: "h-2 w-2 rounded-[4px] bg-primary",
  optionCopy: "flex-1 gap-[1px]",
  precinctName: "font-body-medium text-[14px] leading-[19px] text-ink",
  precinctNameSelected: "text-ink",
  precinctDetail: "font-body text-[12px] leading-[17px] text-ink-muted",
  resultBanner:
    "gap-2 rounded-md border border-border border-l-[3px] border-l-primary bg-surface p-4",
  resultHeader: "flex-row items-start justify-between gap-2",
  resultCopy: "flex-1 gap-[1px]",
  resultEyebrow: "font-body-medium text-[12px] tracking-[0.4px] text-ink-muted",
  resultTitle: "font-body-bold text-section text-ink",
  resultRow:
    "flex-row items-center justify-between gap-2 border-t border-border pt-2",
  resultLabel: "font-body text-[12px] text-ink-muted",
  resultValue: "shrink font-body-medium text-[13px] text-right text-ink",
  passwordLabel: "mt-1 font-body text-[12px] leading-[15px] text-ink-muted",
  password:
    "rounded-md border border-primary bg-background p-3 text-center font-mono text-[18px] tracking-[0.8px] text-ink",
} as const;
