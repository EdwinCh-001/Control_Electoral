import { SupabaseAuthRepository } from "./SupabaseAuthRepository";
import {
  getPasswordRecoveryClient,
  getSupabaseClient,
} from "../infrastructure/supabaseClient";

export const authRepository = new SupabaseAuthRepository(
  getSupabaseClient(),
  getPasswordRecoveryClient(),
);
