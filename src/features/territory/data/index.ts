import { getSupabaseClient } from "../../access/infrastructure/supabaseClient";
import { SupabaseTerritoryRepository } from "./SupabaseTerritoryRepository";

export const territoryRepository = new SupabaseTerritoryRepository(
  getSupabaseClient(),
);
