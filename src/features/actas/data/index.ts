import { getSupabaseClient } from "../../access/infrastructure/supabaseClient";
import { SupabaseActaRepository } from "./SupabaseActaRepository";

export const actaRepository = new SupabaseActaRepository(
  getSupabaseClient(),
);
