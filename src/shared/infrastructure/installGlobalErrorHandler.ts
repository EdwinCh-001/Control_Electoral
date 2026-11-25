import type { CrashReporter } from "../domain/observability";

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

let installed = false;

/**
 * Reporta errores JavaScript fatales y no fatales sin sustituir el manejo
 * propio de React Native: el manejador original se ejecuta después.
 */
export function installGlobalErrorHandler(reporter: CrashReporter): void {
  if (installed) {
    return;
  }
  installed = true;

  const scope = globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike };
  const errorUtils = scope.ErrorUtils;
  if (!errorUtils) {
    return;
  }

  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reporter.recordNonFatal(error, {
      screen: "global",
      operation: "javascript_error",
      stage: isFatal ? "fatal" : "non_fatal",
      kind: isFatal ? "fatal" : "non_fatal",
    });
    previousHandler(error, isFatal);
  });
}
