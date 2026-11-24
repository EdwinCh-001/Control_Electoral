import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

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
      <PageTitle
        title="Iniciar sesión"
        description="Ingresa con la cuenta que te proporcionó tu coordinador."
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
      <FormField
        autoCapitalize="none"
        autoComplete="current-password"
        control={control}
        label="Contraseña"
        name="password"
        placeholder="Ingresa tu contraseña"
        secureTextEntry
        textContentType="password"
      />
      {serverError ? <Feedback message={serverError} /> : null}
      <PrimaryButton
        disabled={isSubmitting}
        label={isSubmitting ? "Ingresando…" : "Ingresar"}
        onPress={() => void onSubmit()}
      />
      <SecondaryButton
        label="Olvidé mi contraseña"
        onPress={() => navigation.navigate("ForgotPassword")}
      />
      <Text style={{ color: "#4B5563", fontSize: 13, marginTop: 20 }}>
        El registro público está deshabilitado. Solicita una cuenta a tu coordinador.
      </Text>
    </AuthPage>
  );
}
