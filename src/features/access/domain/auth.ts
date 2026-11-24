export const appRoles = [
  "provincial_coordinator",
  "precinct_coordinator",
  "observer",
] as const;

export type AppRole = (typeof appRoles)[number];

export interface UserProfile {
  id: string;
  role: AppRole;
  province_id: string;
  full_name: string;
  email: string;
  must_change_password: boolean;
}

export interface AuthSession {
  userId: string;
  email: string;
  profile: UserProfile;
}

export interface AssignablePrecinct {
  id: string;
  name: string;
  parish: string;
  cantonName: string;
}

export interface ManagedAccountInput {
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  precinctId?: string;
}

export interface ManagedAccountResult {
  email: string;
  temporaryPassword: string;
  role: "precinct_coordinator" | "observer";
}

export interface AuthRepository {
  isConfigured(): boolean;
  restoreSession(): Promise<AuthSession | null>;
  subscribe(
    onSession: (session: AuthSession | null) => void,
    onError: (error: Error) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  completePasswordChange(newPassword: string): Promise<AuthSession>;
  listAssignablePrecincts(): Promise<AssignablePrecinct[]>;
  createManagedAccount(input: ManagedAccountInput): Promise<ManagedAccountResult>;
}
