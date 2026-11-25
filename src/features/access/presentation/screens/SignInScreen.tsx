import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Lock, Mail } from "lucide-react-native";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

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

const loginLogo = require("../../../../../assets/images/logo.webp");
const loginFooter = require("../../../../../assets/images/fondo_bottom.png");

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
    <AuthPage
      footerBackground={
        <Image
          accessible={false}
          contentFit="cover"
          source={loginFooter}
          style={styles.footerBackground}
        />
      }
    >
      <View className={classes.formOffset}>
        <Image
          accessibilityLabel="Acción Democrática Nacional"
          contentFit="contain"
          source={loginLogo}
          style={styles.logo}
        />
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
  logo: {
    alignSelf: "center",
    height: 90,
    maxWidth: 260,
    width: "100%",
  },
  footerBackground: {
    bottom: 0,
    height: 180,
    left: 0,
    position: "absolute",
    right: 0,
    width: "100%",
  },
});

const classes = {
  formOffset: "mt-4 gap-4",
} as const;
