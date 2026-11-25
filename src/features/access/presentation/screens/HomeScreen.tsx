import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../../../../app/navigationTypes";
import { useAppDispatch, useAppSelector } from "../../../../app/store";
import { colors, fonts, radii, spacing } from "../../../../shared/presentation/theme";
import type { AppRole } from "../../domain/auth";
import { useAuthRepository } from "../AuthRepositoryContext";
import { setSession } from "../authSlice";
import {
  ActionCard,
  ActionTile,
  AuthPage,
  ConfirmActionSheet,
  Feedback,
  PageTitle,
  SectionTitle,
  StatusChip,
} from "../components/AuthUi";

const roleLabels: Record<AppRole, string> = {
  provincial_coordinator: "Coordinador provincial",
  precinct_coordinator: "Coordinador de recinto",
  observer: "Veedor",
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const session = useAppSelector((state) => state.auth.session);
  const dispatch = useAppDispatch();
  const authRepository = useAuthRepository();
  const [error, setError] = useState<string | null>(null);
  const [logoutSheetVisible, setLogoutSheetVisible] = useState(false);

  if (!session) {
    return null;
  }

  const profile = session.profile;
  const isProvincial = profile.role === "provincial_coordinator";
  const isObserver = profile.role === "observer";

  async function handleSignOut() {
    setError(null);
    setLogoutSheetVisible(false);
    try {
      await authRepository.signOut();
      dispatch(setSession(null));
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : "No se pudo cerrar la sesión.",
      );
    }
  }

  return (
    <AuthPage>
      <PageTitle
        eyebrow="Inicio"
        title="¿Qué vas a hacer hoy?"
        description="Elige una opción para continuar."
      />

      <View style={styles.profileStrip}>
        <View style={styles.profileIcon}>
          <UserRound color={colors.primary} size={20} strokeWidth={2.2} />
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{profile.full_name}</Text>
          <StatusChip
            label={roleLabels[profile.role]}
            tone={isProvincial ? "action" : "neutral"}
          />
        </View>
      </View>

      <View style={styles.centerArea}>
        <SectionTitle>Accesos rápidos</SectionTitle>

        {isProvincial ? (
          <View style={styles.tileGrid}>
            <ActionTile
              icon={LayoutDashboard}
              title="Tablero"
              subtitle="Avance general"
              onPress={() => navigation.navigate("ProvincialDashboard")}
            />
            <ActionTile
              icon={MapPinned}
              title="Ubicaciones"
              subtitle="Mapa de actas"
              onPress={() => navigation.navigate("ProvincialLocationReview")}
            />
            <ActionTile
              icon={UsersRound}
              title="Territorio"
              subtitle="Recintos y mesas"
              onPress={() => navigation.navigate("TerritoryManagement")}
            />
            <ActionTile
              icon={UserPlus}
              title="Cuentas"
              subtitle="Crear accesos"
              onPress={() => navigation.navigate("ManageAccounts")}
            />
          </View>
        ) : isObserver ? (
          <ActionCard
            icon={ClipboardList}
            title="Registrar acta"
            description="Tomar foto y contar votos"
            onPress={() => navigation.navigate("ActaList")}
          />
        ) : (
          <View style={styles.tileGrid}>
            <ActionTile
              icon={ClipboardList}
              title="Actas"
              subtitle="Revisar y enviar"
              onPress={() => navigation.navigate("ActaList")}
            />
            <ActionTile
              icon={UsersRound}
              title="Equipo"
              subtitle="Asignar veedores"
              onPress={() => navigation.navigate("TerritoryManagement")}
            />
            <ActionTile
              icon={UserPlus}
              title="Registrar veedor"
              subtitle="Crear acceso"
              onPress={() => navigation.navigate("ManageAccounts")}
            />
          </View>
        )}
      </View>

      {error ? <Feedback message={error} kind="error" /> : null}

      <Pressable
        accessibilityLabel="Cerrar sesión"
        accessibilityRole="button"
        onPress={() => setLogoutSheetVisible(true)}
        style={({ pressed }) => [
          styles.signOutButton,
          pressed ? styles.signOutButtonPressed : null,
        ]}
      >
        <LogOut color={colors.onPrimary} size={18} strokeWidth={2.2} />
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>

      <ConfirmActionSheet
        visible={logoutSheetVisible}
        title="¿Cerrar sesión?"
        message="Podrás volver a entrar con tu correo y contraseña."
        confirmLabel="Sí, cerrar"
        onConfirm={() => {
          void handleSignOut();
        }}
        onCancel={() => setLogoutSheetVisible(false)}
      />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  profileStrip: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  profileIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoftBg,
    borderRadius: radii.md,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  profileCopy: {
    alignItems: "flex-start",
    flex: 1,
    gap: 5,
  },
  profileName: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    fontWeight: "700",
  },
  centerArea: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: "flex-start",
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  signOutButtonPressed: {
    opacity: 0.85,
  },
  signOutText: {
    color: colors.onPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
});
