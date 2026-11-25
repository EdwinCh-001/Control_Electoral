import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Lock, Mail } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../shared/presentation/theme";
import { useAuthRepository } from "../AuthRepositoryContext";
import { setSession } from "../authSlice";
import { useAppDispatch } from "../../../../app/store";
import type { RootStackParamList } from "../../../../app/navigationTypes";
import {
  AuthPage,
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";

const signInSchema = z.object({
  email: z.email("Ingresa un correo válido.").trim().toLowerCase(),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

type SignInValues = z.infer<typeof signInSchema>;
type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const authRepository = useAuthRepository();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const session = await authRepository.signIn(email, password);
      dispatch(setSession(session));
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar sesión. Intenta de nuevo.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthPage>
      <View style={styles.formOffset}>
        <PageTitle
          eyebrow="Acceso"
          title="Entra a tu mesa"
          description="Usa la cuenta de tu coordinador."
        />
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          control={control}
          icon={Mail}
          keyboardType="email-address"
          label="Correo electrónico"
          name="email"
          placeholder="nombre@correo.com"
          textContentType="emailAddress"
        />
        <FormField
          autoCapitalize="none"
          autoComplete="current-password"
          control={control}
          icon={Lock}
          label="Contraseña"
          name="password"
          placeholder="Ingresa tu contraseña"
          secureTextEntry
          secureTextToggle
          textContentType="password"
        />
        {serverError ? <Feedback message={serverError} /> : null}
        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Entrando…" : "Entrar"}
          onPress={() => void onSubmit()}
        />
        <SecondaryButton
          label="Recuperar mi contraseña"
          onPress={() => navigation.navigate("ForgotPassword")}
        />
      </View>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  formOffset: {
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
});
