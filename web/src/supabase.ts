import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? "El sitio todavía no está conectado a Supabase."
    : null;

export const supabase =
  supabaseConfigurationError === null
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Recovery links are issued by the mobile client without its local PKCE verifier.
          flowType: "implicit",
          persistSession: true,
        },
      })
    : null;
