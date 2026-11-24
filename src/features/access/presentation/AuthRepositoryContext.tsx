import { createContext, useContext, type ReactNode } from "react";

import type { AuthRepository } from "../domain/auth";

const AuthRepositoryContext = createContext<AuthRepository | null>(null);

export function AuthRepositoryProvider({
  repository,
  children,
}: {
  repository: AuthRepository;
  children: ReactNode;
}) {
  return (
    <AuthRepositoryContext.Provider value={repository}>
      {children}
    </AuthRepositoryContext.Provider>
  );
}

export function useAuthRepository(): AuthRepository {
  const repository = useContext(AuthRepositoryContext);
  if (!repository) {
    throw new Error("AuthRepositoryProvider is missing.");
  }
  return repository;
}
