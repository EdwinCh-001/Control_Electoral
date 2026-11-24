import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";

const accountSchema = z.object({
  fullName: z.string().trim().min(1, "Ingresa nombres y apellidos."),
  nationalId: z.string().trim().min(1, "Ingresa la cédula."),
  phone: z.string().trim().min(1, "Ingresa el teléfono."),
  email: z.email("Ingresa un correo válido.").trim().toLowerCase(),
});

type AccountValues = z.infer<typeof accountSchema>;
type Props = NativeStackScreenProps<RootStackParamList, "ManageAccounts">;

const createdRoleLabels: Record<
  "precinct_coordinator" | "observer",
  string
> = {
  precinct_coordinator: "coordinador de recinto",
  observer: "veedor",
};

const roleLabels: Record<AppRole, string> = {
  provincial_coordinator: "Coordinador provincial",
  precinct_coordinator: "Coordinador de recinto",
  observer: "Veedor",
};

export function ManageAccountsScreen({ navigation }: Props) {
  const authRepository = useAuthRepository();
  const session = useAppSelector((state) => state.auth.session);
  const [precincts, setPrecincts] = useState<AssignablePrecinct[]>([]);
  const [selectedPrecinctId, setSelectedPrecinctId] = useState("");
  const [isLoadingPrecincts, setIsLoadingPrecincts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] =
    useState<ManagedAccountResult | null>(null);
  const { control, handleSubmit, reset } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      fullName: "",
      nationalId: "",
      phone: "",
      email: "",
    },
  });

  const role = session?.profile.role;
  const canCreate =
    role === "provincial_coordinator" || role === "precinct_coordinator";

  useEffect(() => {
    let active = true;

    void authRepository
      .listAssignablePrecincts()
      .then((items) => {
        if (!active) {
          return;
        }
        setPrecincts(items);
        if (role === "precinct_coordinator" && items.length === 1) {
          setSelectedPrecinctId(items[0].id);
        }
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
  }, [authRepository, role]);

  if (!session || !canCreate) {
    return (
      <AuthPage>
        <PageTitle
          title="Acceso no autorizado"
          description="Tu perfil no puede crear cuentas."
        />
        <SecondaryButton
          label="Volver"
          onPress={() => navigation.goBack()}
        />
      </AuthPage>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setCreatedAccount(null);

    if (role === "provincial_coordinator" && !selectedPrecinctId) {
      setError("Selecciona el recinto para asignar al coordinador.");
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        ...values,
        ...(role === "provincial_coordinator"
          ? { precinctId: selectedPrecinctId }
          : {}),
      };
      const result = await authRepository.createManagedAccount(input);
      setCreatedAccount(result);
      reset();
      if (role === "provincial_coordinator") {
        setSelectedPrecinctId("");
      }
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

  return (
    <AuthPage>
      <PageTitle
        title="Crear cuenta de equipo"
        description={`Se creará una cuenta de ${createdRoleLabels[role === "provincial_coordinator" ? "precinct_coordinator" : "observer"]}. No se habilita el registro público.`}
      />
      {role === "provincial_coordinator" ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recinto asignado</Text>
          {isLoadingPrecincts ? (
            <Feedback kind="info" message="Cargando recintos autorizados…" />
          ) : precincts.length === 0 ? (
            <Feedback
              message="No hay recintos disponibles en tu jurisdicción."
            />
          ) : (
            precincts.map((precinct) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  checked: selectedPrecinctId === precinct.id,
                }}
                key={precinct.id}
                onPress={() => setSelectedPrecinctId(precinct.id)}
                style={[
                  styles.precinctOption,
                  selectedPrecinctId === precinct.id
                    ? styles.precinctSelected
                    : null,
                ]}
              >
                <Text style={styles.precinctName}>{precinct.name}</Text>
                <Text style={styles.precinctDetail}>
                  {precinct.parish} · {precinct.cantonName}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <Feedback
          kind="info"
          message={`La cuenta tendrá el alcance de tu recinto (${precincts[0]?.name ?? "asignado"}).`}
        />
      )}
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
      {createdAccount ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Cuenta creada</Text>
          <Text style={styles.resultText}>
            Rol: {roleLabels[createdAccount.role]}
          </Text>
          <Text style={styles.resultText}>Correo: {createdAccount.email}</Text>
          <Text style={styles.resultText}>
            Contraseña temporal (se muestra una sola vez):
          </Text>
          <Text selectable style={styles.password}>
            {createdAccount.temporaryPassword}
          </Text>
          <Text style={styles.resultText}>
            Comparte la contraseña de forma segura. La persona deberá confirmar
            su correo y cambiarla al primer acceso.
          </Text>
        </View>
      ) : null}
      {error ? <Feedback message={error} /> : null}
      <PrimaryButton
        disabled={
          isSubmitting ||
          isLoadingPrecincts ||
          precincts.length === 0
        }
        label={isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
        onPress={() => void onSubmit()}
      />
      <SecondaryButton
        label="Volver"
        onPress={() => navigation.goBack()}
      />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "700",
  },
  precinctOption: {
    borderColor: "#9CA3AF",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  precinctSelected: {
    borderColor: "#111827",
    borderWidth: 2,
  },
  precinctName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  precinctDetail: {
    color: "#4B5563",
    fontSize: 13,
  },
  resultCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    gap: 8,
    marginVertical: 16,
    padding: 16,
  },
  resultTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },
  resultText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
  },
  password: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
});
