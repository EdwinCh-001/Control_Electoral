import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAuthRepository } from "../AuthRepositoryContext";
import type { RootStackParamList } from "../../../../app/navigationTypes";
import {
  AuthPage,
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";

const forgotPasswordSchema = z.object({
  email: z.email("Ingresa un correo válido.").trim().toLowerCase(),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const authRepository = useAuthRepository();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      await authRepository.requestPasswordReset(email);
      setMessage(
        "Revisa tu correo. Si la cuenta existe, recibirás un enlace para crear una contraseña nueva.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo solicitar la recuperación.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthPage>
      <PageTitle
        eyebrow="Acceso"
        title="Recupera tu contraseña"
        description="Te enviaremos un enlace para crear una contraseña nueva."
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
      {message ? <Feedback kind="success" message={message} /> : null}
      {error ? <Feedback message={error} /> : null}
      <PrimaryButton
        disabled={isSubmitting}
        label={isSubmitting ? "Enviando…" : "Enviar instrucciones"}
        onPress={() => void onSubmit()}
      />
      <SecondaryButton
        label="Volver al inicio de sesión"
        onPress={() => navigation.navigate("SignIn")}
      />
    </AuthPage>
  );
}
