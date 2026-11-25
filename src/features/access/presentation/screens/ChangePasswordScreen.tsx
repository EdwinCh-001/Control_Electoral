import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAppDispatch } from "../../../../app/store";

import { useAuthRepository } from "../AuthRepositoryContext";
import { setSession } from "../authSlice";
import {
  AuthPage,
  Feedback,
  FormField,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";

const changePasswordSchema = z
  .object({
    password: z.string().min(1, "Ingresa una contraseña nueva."),
    confirmPassword: z.string().min(1, "Confirma la contraseña nueva."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordScreen() {
  const dispatch = useAppDispatch();
  const authRepository = useAuthRepository();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, handleSubmit } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const session = await authRepository.completePasswordChange(password);
      dispatch(setSession(session));
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la contraseña.",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const signOut = async () => {
    setServerError(null);
    try {
      await authRepository.signOut();
      dispatch(setSession(null));
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "No se pudo cerrar la sesión.",
      );
    }
  };

  return (
    <AuthPage>
      <PageTitle
        eyebrow="Primer ingreso"
        title="Crea tu contraseña"
        description="Crea una contraseña nueva para continuar."
      />
      <Feedback
        kind="info"
        message="La contraseña temporal dejará de funcionar cuando guardes la nueva."
      />
      <FormField
        autoCapitalize="none"
        autoComplete="new-password"
        control={control}
        label="Contraseña nueva"
        name="password"
        placeholder="Ingresa una contraseña"
        secureTextEntry
        secureTextToggle
        textContentType="newPassword"
      />
      <FormField
        autoCapitalize="none"
        autoComplete="new-password"
        control={control}
        label="Confirmar contraseña"
        name="confirmPassword"
        placeholder="Escribe de nuevo la contraseña"
        secureTextEntry
        secureTextToggle
        textContentType="newPassword"
      />
      {serverError ? <Feedback message={serverError} /> : null}
      <PrimaryButton
        disabled={isSubmitting}
        label={isSubmitting ? "Guardando…" : "Guardar y continuar"}
        onPress={() => void onSubmit()}
      />
      <SecondaryButton
        disabled={isSubmitting}
        label="Cerrar sesión"
        onPress={() => void signOut()}
      />
    </AuthPage>
  );
}
