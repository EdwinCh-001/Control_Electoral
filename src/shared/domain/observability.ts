export interface CrashContext {
  screen: string;
  operation: string;
  stage?: string;
  kind?: "fatal" | "non_fatal";
}

/**
 * Contrato del dominio para reportar fallos. No recibe identificadores,
 * correos, cédulas, votos ni rutas de fotografías: RNF-03 prohíbe enviar
 * datos sensibles a la herramienta de observabilidad.
 */
export interface CrashReporter {
  setScreen(screen: string): void;
  recordNonFatal(error: unknown, context: CrashContext): void;
}

export const noopCrashReporter: CrashReporter = {
  setScreen: () => undefined,
  recordNonFatal: () => undefined,
};
