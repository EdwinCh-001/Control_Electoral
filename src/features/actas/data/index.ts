import { getSupabaseClient } from "../../access/infrastructure/supabaseClient";
import { crashReporter } from "../../../shared/infrastructure/CrashReporter";
import { SupabaseActaRepository } from "./SupabaseActaRepository";

export const actaRepository = new SupabaseActaRepository(
  getSupabaseClient(),
  crashReporter,
);
