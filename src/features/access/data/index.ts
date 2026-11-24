import { SupabaseAuthRepository } from "./SupabaseAuthRepository";
import { getSupabaseClient } from "../infrastructure/supabaseClient";

export const authRepository = new SupabaseAuthRepository(getSupabaseClient());
