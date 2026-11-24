import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppRole } from "../../domain/auth";
import { useAppDispatch, useAppSelector } from "../../../../app/store";
import { setSession } from "../authSlice";
import { useAuthRepository } from "../AuthRepositoryContext";
import {
  AuthPage,
  Feedback,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
} from "../components/AuthUi";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../app/navigationTypes";

const roleLabels: Record<AppRole, string> = {
  provincial_coordinator: "Coordinador provincial",
  precinct_coordinator: "Coordinador de recinto",
  observer: "Veedor",
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const authRepository = useAuthRepository();
  const session = useAppSelector((state) => state.auth.session);
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!session) {
    return null;
  }

  const canManageAccounts = session.profile.role !== "observer";

  const signOut = async () => {
    setError(null);
    setIsSigningOut(true);

    try {
      await authRepository.signOut();
      dispatch(setSession(null));
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "No se pudo cerrar la sesión.",
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AuthPage>
      <PageTitle
        title={`Hola, ${session.profile.full_name}`}
        description="Tu sesión está protegida y el acceso depende de tu perfil."
      />
      <View style={styles.profileCard}>
        <Text style={styles.role}>{roleLabels[session.profile.role]}</Text>
        <Text style={styles.email}>{session.email}</Text>
      </View>
      {error ? <Feedback message={error} /> : null}
      {canManageAccounts ? (
        <PrimaryButton
          label="Crear cuenta de equipo"
          onPress={() => navigation.navigate("ManageAccounts")}
        />
      ) : null}
      <SecondaryButton
        disabled={isSigningOut}
        label={isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
        onPress={() => void signOut()}
      />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    gap: 8,
    marginBottom: 24,
    padding: 16,
  },
  role: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  email: {
    color: "#4B5563",
    fontSize: 14,
  },
});
