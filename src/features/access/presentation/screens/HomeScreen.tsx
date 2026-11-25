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
import { Pressable, Text, View } from "react-native";

import type { RootStackParamList } from "../../../../app/navigationTypes";
import { useAppDispatch, useAppSelector } from "../../../../app/store";
import { colors } from "../../../../shared/presentation/theme";
import type { AppRole } from "../../domain/auth";
import { useAuthRepository } from "../AuthRepositoryContext";
import { setSession } from "../authSlice";
import {
  ActionCard,
  ActionTile,
  AuthPage,
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
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!session) {
    return null;
  }

  const profile = session.profile;
  const isProvincial = profile.role === "provincial_coordinator";
  const isObserver = profile.role === "observer";

  async function handleSignOut() {
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
  }

  return (
    <AuthPage>
      <PageTitle
        eyebrow="Inicio"
        title="¿Qué vas a hacer hoy?"
        description="Elige una opción para continuar."
      />

      <View className={classes.profileStrip}>
        <View className={classes.profileIcon}>
          <UserRound color={colors.primary} size={20} strokeWidth={2.2} />
        </View>
        <View className={classes.profileCopy}>
          <Text className={classes.profileName}>{profile.full_name}</Text>
          <StatusChip
            label={roleLabels[profile.role]}
            tone={isProvincial ? "action" : "neutral"}
          />
        </View>
      </View>

      <View className={classes.centerArea}>
        <SectionTitle>Accesos rápidos</SectionTitle>

        {isProvincial ? (
          <View className={classes.tileGrid}>
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
          <View className={classes.tileGrid}>
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
        className={`${classes.signOutButton} ${isSigningOut ? classes.signOutDisabled : ""}`}
        disabled={isSigningOut}
        onPress={() => void handleSignOut()}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <LogOut color={colors.onPrimary} size={18} strokeWidth={2.2} />
        <Text className={classes.signOutText}>
          {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </Text>
      </Pressable>
    </AuthPage>
  );
}

const classes = {
  profileStrip:
    "flex-row items-center gap-3 border-b border-border pb-2",
  profileIcon:
    "h-[42px] w-[42px] items-center justify-center rounded-md bg-primary-soft-bg",
  profileCopy: "flex-1 items-start gap-[5px]",
  profileName: "font-body-bold text-[17px] font-bold text-ink",
  centerArea: "flex-1 justify-start gap-2 pb-3 pt-1",
  tileGrid: "flex-row flex-wrap gap-3",
  signOutButton:
    "min-h-[52px] flex-row items-center justify-center gap-2 rounded-md bg-primary-dark px-4",
  signOutDisabled: "opacity-60",
  signOutText: "font-body-bold text-button text-on-primary",
} as const;
