import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";

import type { RootStackParamList } from "../../../../app/navigationTypes";
import { useAppDispatch, useAppSelector } from "../../../../app/store";
import { setAuthError, setLoading, setSession } from "../authSlice";
import { useAuthRepository } from "../AuthRepositoryContext";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { ForgotPasswordScreen } from "../screens/ForgotPasswordScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ManageAccountsScreen } from "../screens/ManageAccountsScreen";
import { SignInScreen } from "../screens/SignInScreen";
import {
  AuthPage,
  Feedback,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "examen1://"],
  config: {
    screens: {
      SignIn: "login",
      ForgotPassword: "forgot-password",
      ChangePassword: "change-password",
      Home: "home",
      ManageAccounts: "manage-accounts",
    },
  },
};

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const authRepository = useAuthRepository();
  const { phase, session, error } = useAppSelector((state) => state.auth);
  const navigationKey = useMemo(
    () => `${phase}-${session?.userId ?? "anonymous"}`,
    [phase, session?.userId],
  );

  if (phase === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator accessibilityLabel="Cargando sesión" />
        <Text style={styles.statusText}>Comprobando sesión…</Text>
      </View>
    );
  }

  if (phase === "unconfigured") {
    return (
      <AuthPage>
        <PageTitle
          title="Falta configurar Supabase"
          description={error ?? "Completa la configuración de servicios."}
        />
        <Feedback
          kind="info"
          message="Completa el proyecto Supabase y las variables públicas de .env antes de iniciar sesión."
        />
      </AuthPage>
    );
  }

  if (phase === "error") {
    return (
      <AuthPage>
        <PageTitle
          title="No se pudo cargar tu perfil"
          description={error ?? "La sesión no puede continuar."}
        />
        <PrimaryButton
          label="Reintentar"
          onPress={() => {
            dispatch(setLoading());
            void authRepository
              .restoreSession()
              .then((restoredSession) => dispatch(setSession(restoredSession)))
              .catch((restoreError: unknown) =>
                dispatch(
                  setAuthError(
                    restoreError instanceof Error
                      ? restoreError.message
                      : "No se pudo recuperar la sesión.",
                  ),
                ),
              );
          }}
        />
        <SecondaryButton
          label="Cerrar sesión"
          onPress={() => {
            void authRepository
              .signOut()
              .then(() => dispatch(setSession(null)))
              .catch((signOutError: unknown) =>
                dispatch(
                  setAuthError(
                    signOutError instanceof Error
                      ? signOutError.message
                      : "No se pudo cerrar la sesión.",
                  ),
                ),
              );
          }}
        />
      </AuthPage>
    );
  }

  return (
    <NavigationContainer key={navigationKey} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {phase === "signed_out" || !session ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
          </>
        ) : session.profile.must_change_password ? (
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            {session.profile.role !== "observer" ? (
              <Stack.Screen
                name="ManageAccounts"
                component={ManageAccountsScreen}
              />
            ) : null}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  statusText: {
    color: "#374151",
    fontSize: 15,
  },
});
