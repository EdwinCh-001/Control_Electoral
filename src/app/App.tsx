import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Provider } from "react-redux";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
import { store, useAppDispatch } from "./store";

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
