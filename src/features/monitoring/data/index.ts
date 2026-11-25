import { getSupabaseClient } from "../../access/infrastructure/supabaseClient";
import { crashReporter } from "../../../shared/infrastructure/CrashReporter";
import { SupabaseMonitoringRepository } from "./SupabaseMonitoringRepository";

export const monitoringRepository = new SupabaseMonitoringRepository(
  getSupabaseClient(),
  crashReporter,
);
