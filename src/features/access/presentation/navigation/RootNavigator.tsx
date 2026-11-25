import { useMemo } from "react";
import { Text, View } from "react-native";
import {
  createNavigationContainerRef,
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
  type Theme,
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
import { TerritoryManagementScreen } from "../../../territory/presentation/TerritoryManagementScreen";
import { ActaEditorScreen } from "../../../actas/presentation/ActaEditorScreen";
import { ActaHistoryScreen } from "../../../actas/presentation/ActaHistoryScreen";
import { ActaListScreen } from "../../../actas/presentation/ActaListScreen";
import { ProvincialLocationReviewScreen } from "../../../actas/presentation/ProvincialLocationReviewScreen";
import { ProvincialActaDetailScreen } from "../../../monitoring/presentation/ProvincialActaDetailScreen";
import { ProvincialDashboardScreen } from "../../../monitoring/presentation/ProvincialDashboardScreen";
import { crashReporter } from "../../../../shared/infrastructure/CrashReporter";
import { LottieIcon } from "../../../../shared/presentation/components/LottieIcon";
import { colors } from "../../../../shared/presentation/theme";
import {
  AuthPage,
  Feedback,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
    border: colors.border,
    card: colors.surface,
    notification: colors.accentDeep,
    primary: colors.primary,
    text: colors.ink,
  },
};

function trackActiveScreen(): void {
  const name = navigationRef.getCurrentRoute()?.name;
  if (name) {
    crashReporter.setScreen(name);
  }
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "examen1://"],
  config: {
    screens: {
      SignIn: "login",
      ForgotPassword: "forgot-password",
      ChangePassword: "change-password",
      Home: "home",
      ManageAccounts: "manage-accounts",
      TerritoryManagement: "territory",
      ActaList: "actas",
      ActaEditor: "actas/:actaId",
      ActaHistory: "actas/:actaId/history",
      ProvincialLocationReview: "provincial-locations",
      ProvincialDashboard: "provincial-dashboard",
      ProvincialActaDetail: "provincial-actas/:actaId",
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
      <View className={classes.loading}>
        <View className={classes.loadingBrand}>
          <View className={classes.loadingMark}>
            <Text className={classes.loadingMarkText}>7</Text>
          </View>
          <View>
            <Text className={classes.loadingTitle}>Control Electoral</Text>
            <Text className={classes.statusText}>Preparando tu jornada…</Text>
          </View>
        </View>
        <LottieIcon name="loading" size={112} />
      </View>
    );
  }

  if (phase === "unconfigured") {
    return (
      <AuthPage>
        <PageTitle
          eyebrow="Configuración pendiente"
          title="Falta conectar el servicio"
          description="Falta la configuración de la app."
        />
        <Feedback
          kind="info"
          message="Completa el proyecto de datos y las variables públicas de .env. Después vuelve a abrir la app."
          technicalDetails={error ?? "No hay detalle técnico disponible."}
        />
      </AuthPage>
    );
  }

  if (phase === "error") {
    return (
      <AuthPage>
        <PageTitle
          eyebrow="Sesión"
          title="No pudimos cargar tu perfil"
          description="Intenta de nuevo. Tu sesión sigue segura."
        />
        <Feedback
          kind="error"
          message={error ?? "No se pudo cargar el perfil."}
        />
        <PrimaryButton
          label="Intentar de nuevo"
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
    <NavigationContainer
      key={navigationKey}
      linking={linking}
      ref={navigationRef}
      theme={navigationTheme}
      onReady={trackActiveScreen}
      onStateChange={trackActiveScreen}
    >
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
            {session.profile.role === "provincial_coordinator" ? (
              <>
                <Stack.Screen
                  name="ProvincialDashboard"
                  component={ProvincialDashboardScreen}
                />
                <Stack.Screen
                  name="ProvincialActaDetail"
                  component={ProvincialActaDetailScreen}
                />
                <Stack.Screen
                  name="ProvincialLocationReview"
                  component={ProvincialLocationReviewScreen}
                />
              </>
            ) : null}
            {session.profile.role !== "observer" ? (
              <Stack.Screen
                name="ManageAccounts"
                component={ManageAccountsScreen}
              />
            ) : null}
            {session.profile.role !== "observer" ? (
              <Stack.Screen
                name="TerritoryManagement"
                component={TerritoryManagementScreen}
              />
            ) : null}
            {session.profile.role !== "provincial_coordinator" ? (
              <>
                <Stack.Screen name="ActaList" component={ActaListScreen} />
                <Stack.Screen name="ActaEditor" component={ActaEditorScreen} />
                <Stack.Screen name="ActaHistory" component={ActaHistoryScreen} />
              </>
            ) : null}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const classes = {
  loading: "flex-1 items-center justify-center gap-5 px-6",
  loadingBrand: "flex-row items-center gap-3",
  loadingMark: "h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-primary",
  loadingMarkText:
    "font-display text-[14px] font-bold tracking-[0.4px] text-on-primary",
  loadingTitle: "font-display text-[22px] font-bold tracking-[-0.2px] text-ink",
  statusText: "mt-[2px] font-body text-[14px] leading-[19px] text-ink-muted",
} as const;
