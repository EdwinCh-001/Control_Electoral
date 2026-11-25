import { noopCrashReporter, type CrashReporter } from "../domain/observability";

/**
 * Crashlytics desactivado temporalmente para que Expo Go arranque sin módulos
 * nativos de Firebase. ADR-06 se reactivará cuando se compile el APK de EAS
 * con google-services.json.
 */
export const crashReporter: CrashReporter = noopCrashReporter;
