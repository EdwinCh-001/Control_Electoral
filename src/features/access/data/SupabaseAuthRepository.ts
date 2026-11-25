import type { Session, SupabaseClient } from "@supabase/supabase-js";

import type {
  AssignablePrecinct,
  AuthRepository,
  AuthSession,
  ManagedAccountInput,
  ManagedAccountResult,
  UserProfile,
} from "../domain/auth";
import type { Database } from "../infrastructure/database.types";
import {
  clearCachedProfile,
  readCachedProfile,
  storeCachedProfile,
} from "../infrastructure/profileCache";
import { supabaseConfigurationError } from "../infrastructure/supabaseClient";

const recoveryRedirectUrl =
  process.env.EXPO_PUBLIC_PASSWORD_RESET_URL?.trim() ?? "";

const profileColumns =
  "id, role, province_id, full_name, email, must_change_password";

export class SupabaseAuthRepository implements AuthRepository {
  constructor(
    private readonly client: SupabaseClient<Database> | null,
    private readonly passwordRecoveryClient: SupabaseClient<Database> | null,
  ) {}

  isConfigured(): boolean {
    return this.client !== null;
  }

  async restoreSession(): Promise<AuthSession | null> {
    const client = this.getClient();
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw this.toUserError(error.message);
    }

    return this.toAuthSession(data.session);
  }

  subscribe(
    onSession: (session: AuthSession | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    const client = this.getClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void this.toAuthSession(session).then(onSession).catch(onError);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.getClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw this.toUserError(error.message);
    }

    const session = await this.toAuthSession(data.session);
    if (!session) {
      throw new Error("No se pudo restaurar la sesión iniciada.");
    }

    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.getClient().auth.signOut();
    if (error) {
      throw this.toUserError(error.message);
    }
    await clearCachedProfile();
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!this.passwordRecoveryClient) {
      throw new Error(
        supabaseConfigurationError ?? "No se pudo configurar la recuperación.",
      );
    }
    if (!recoveryRedirectUrl) {
      throw new Error(
        "Configura EXPO_PUBLIC_PASSWORD_RESET_URL con la URL desplegada de recuperación.",
      );
    }

    let redirectUrl: URL;
    try {
      redirectUrl = new URL(recoveryRedirectUrl);
    } catch {
      throw new Error("La URL de recuperación configurada no es válida.");
    }

    const isLocalDevelopment =
      redirectUrl.protocol === "http:" &&
      (redirectUrl.hostname === "localhost" ||
        redirectUrl.hostname === "127.0.0.1");
    if (redirectUrl.protocol !== "https:" && !isLocalDevelopment) {
      throw new Error("La URL de recuperación debe usar HTTPS.");
    }

    const { error } = await this.passwordRecoveryClient.auth.resetPasswordForEmail(
      email,
      { redirectTo: redirectUrl.toString() },
    );

    if (error) {
      throw this.toUserError(error.message);
    }
  }

  async completePasswordChange(newPassword: string): Promise<AuthSession> {
    const client = this.getClient();
    const { error } = await client.functions.invoke("complete-password-change", {
      body: { newPassword },
    });

    if (error) {
      throw await this.toFunctionError(error);
    }

    const session = await this.restoreSession();
    if (!session) {
      throw new Error("La clave se actualizó, pero la sesión expiró. Inicia sesión.");
    }

    const updatedSession = {
      ...session,
      profile: { ...session.profile, must_change_password: false },
    };
    await storeCachedProfile(updatedSession.profile);
    return updatedSession;
  }

  async listAssignablePrecincts(): Promise<AssignablePrecinct[]> {
    const client = this.getClient();
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      throw this.toUserError(sessionError.message);
    }
    if (!sessionData.session) {
      throw new Error("La sesión expiró. Inicia sesión de nuevo.");
    }

    const profile = await this.getProfile(sessionData.session.user.id);
    if (profile.role === "provincial_coordinator") {
      const { data, error } = await client
        .from("precincts")
        .select("id, name, parish, canton_id")
        .order("name");

      if (error) {
        throw this.toUserError(error.message);
      }

      const { data: assignments, error: assignmentError } = await client
        .from("precinct_coordinators")
        .select("precinct_id");

      if (assignmentError) {
        throw this.toUserError(assignmentError.message);
      }

      const assignedPrecinctIds = new Set(
        assignments.map((assignment) => assignment.precinct_id),
      );
      return this.addCantonNames(
        data.filter((precinct) => !assignedPrecinctIds.has(precinct.id)),
      );
    }

    if (profile.role === "precinct_coordinator") {
      const { data: assignments, error: assignmentError } = await client
        .from("precinct_coordinators")
        .select("precinct_id")
        .eq("user_id", profile.id);

      if (assignmentError) {
        throw this.toUserError(assignmentError.message);
      }

      const precinctIds = assignments.map((assignment) => assignment.precinct_id);
      if (precinctIds.length === 0) {
        return [];
      }

      const { data, error } = await client
        .from("precincts")
        .select("id, name, parish, canton_id")
        .in("id", precinctIds)
        .order("name");

      if (error) {
        throw this.toUserError(error.message);
      }

      return this.addCantonNames(data);
    }

    throw new Error("Tu perfil no tiene permisos para crear cuentas.");
  }

  async createManagedAccount(
    input: ManagedAccountInput,
  ): Promise<ManagedAccountResult> {
    const { data, error } = await this.getClient().functions.invoke<{
      email?: unknown;
      temporaryPassword?: unknown;
      role?: unknown;
    }>("create-account", {
      body: input,
    });

    if (error) {
      throw await this.toFunctionError(error);
    }

    if (
      !data ||
      typeof data.email !== "string" ||
      typeof data.temporaryPassword !== "string" ||
      (data.role !== "precinct_coordinator" && data.role !== "observer")
    ) {
      throw new Error("El servidor devolvió una respuesta de cuenta inválida.");
    }

    return {
      email: data.email,
      temporaryPassword: data.temporaryPassword,
      role: data.role,
    };
  }

  private getClient(): SupabaseClient<Database> {
    if (!this.client) {
      throw new Error(
        supabaseConfigurationError ??
          "Supabase no está configurado para esta aplicación.",
      );
    }

    return this.client;
  }

  private async toAuthSession(
    session: Session | null,
  ): Promise<AuthSession | null> {
    if (!session) {
      await clearCachedProfile();
      return null;
    }

    let profile: UserProfile;
    try {
      profile = await this.getProfile(session.user.id);
      await storeCachedProfile(profile);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("No hay conexión")) {
        throw error;
      }

      const cachedProfile = await readCachedProfile(session.user.id);
      if (!cachedProfile) {
        throw error;
      }
      profile = cachedProfile;
    }

    return {
      userId: session.user.id,
      email: session.user.email ?? profile.email,
      profile,
    };
  }

  private async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await this.getClient()
      .from("profiles")
      .select(profileColumns)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw this.toUserError(error.message);
    }
    if (!data) {
      throw new Error(
        "La cuenta no tiene un perfil autorizado. Contacta al coordinador.",
      );
    }

    return data;
  }

  private async addCantonNames(
    precincts: {
      id: string;
      name: string;
      parish: string;
      canton_id: string;
    }[],
  ): Promise<AssignablePrecinct[]> {
    const cantonIds = [...new Set(precincts.map((precinct) => precinct.canton_id))];
    if (cantonIds.length === 0) {
      return [];
    }

    const { data: cantons, error } = await this.getClient()
      .from("cantons")
      .select("id, name")
      .in("id", cantonIds);

    if (error) {
      throw this.toUserError(error.message);
    }

    if (cantons.length !== cantonIds.length) {
      throw new Error(
        "No se pudieron resolver todos los cantones de tu jurisdicción.",
      );
    }

    const cantonNames = new Map(cantons.map((canton) => [canton.id, canton.name]));
    return precincts.map((precinct) => {
      const cantonName = cantonNames.get(precinct.canton_id);
      if (!cantonName) {
        throw new Error("Un recinto no tiene un cantón visible.");
      }

      return {
        id: precinct.id,
        name: precinct.name,
        parish: precinct.parish,
        cantonName,
      };
    });
  }

  private async toFunctionError(error: {
    message: string;
    context?: unknown;
  }): Promise<Error> {
    // React Native can use a fetch polyfill, so `instanceof Response` is not
    // reliable here. Duck-type the response instead to surface the function's
    // real error message.
    const context = error.context;
    const response =
      context !== null &&
      typeof context === "object" &&
      typeof (context as Response).json === "function"
        ? (context as Response)
        : null;

    if (response) {
      try {
        const body: unknown = await response.json();
        if (
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "string"
        ) {
          return new Error(body.error);
        }
        if (
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
        ) {
          return new Error(body.message);
        }
      } catch {
        return new Error("El servidor no pudo completar la operación.");
      }
    }

    return this.toUserError(error.message);
  }

  private toUserError(message: string): Error {
    const normalized = message.toLowerCase();

    if (normalized.includes("invalid login credentials")) {
      return new Error("El correo o la contraseña no son correctos.");
    }
    if (normalized.includes("email not confirmed")) {
      return new Error("Confirma tu correo desde el mensaje enviado por Auth.");
    }
    if (normalized.includes("rate limit") || normalized.includes("too many")) {
      return new Error("Demasiados intentos. Espera un momento y vuelve a probar.");
    }
    if (
      normalized.includes("smtp") ||
      normalized.includes("email") ||
      normalized.includes("redirect")
    ) {
      return new Error(
        "Auth no pudo completar el correo. Verifica SMTP y las URLs permitidas en Supabase.",
      );
    }
    if (
      normalized.includes("network") ||
      normalized.includes("fetch") ||
      normalized.includes("offline")
    ) {
      return new Error("No hay conexión con el servicio. Revisa internet e intenta de nuevo.");
    }

    return new Error("No se pudo completar la operación. Intenta de nuevo.");
  }
}
