import "../global.css";

import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

import { authRepository } from "../features/access/data";
import { supabaseConfigurationError } from "../features/access/infrastructure/supabaseClient";
import {
  AuthRepositoryProvider,
  useAuthRepository,
} from "../features/access/presentation/AuthRepositoryContext";
import {
  setAuthError,
  setSession,
  setUnconfigured,
} from "../features/access/presentation/authSlice";
import { RootNavigator } from "../features/access/presentation/navigation/RootNavigator";
import { crashReporter } from "../shared/infrastructure/CrashReporter";
import { installGlobalErrorHandler } from "../shared/infrastructure/installGlobalErrorHandler";
import { store, useAppDispatch } from "./store";

/*
 * @gorhom/bottom-sheet passes web-only dependency arrays to Reanimated hooks.
 * Native ignores them by design. Reanimated emits those warnings via warnOnce,
 * which ignores `strict`; raising the level to error suppresses the noise but
 * keeps real Reanimated errors visible.
 */
configureReanimatedLogger({
  level: ReanimatedLogLevel.error,
  strict: false,
});

function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const repository = useAuthRepository();

  useEffect(() => {
    if (!repository.isConfigured()) {
      dispatch(
        setUnconfigured(
          supabaseConfigurationError ??
            "Completa la configuración de Supabase.",
        ),
      );
      return;
    }

    let active = true;
    const unsubscribe = repository.subscribe(
      (session) => {
        if (active) {
          dispatch(setSession(session));
        }
      },
      (error) => {
        if (active) {
          dispatch(setAuthError(error.message));
        }
      },
    );

    void repository
      .restoreSession()
      .then((session) => {
        if (active) {
          dispatch(setSession(session));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          dispatch(
            setAuthError(
              error instanceof Error
                ? error.message
                : "No se pudo comprobar la sesión.",
            ),
          );
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [dispatch, repository]);

  return (
    <>
      <StatusBar style="dark" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  useEffect(() => {
    installGlobalErrorHandler(crashReporter);
  }, []);

  return (
    <Provider store={store}>
      <AuthRepositoryProvider repository={authRepository}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthBootstrap />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </AuthRepositoryProvider>
    </Provider>
  );
}
