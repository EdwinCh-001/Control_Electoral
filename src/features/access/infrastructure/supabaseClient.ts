import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const secureMemory = new Map<string, string>();

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      return secureMemory.get(key) ?? null;
    }

    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      secureMemory.set(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      secureMemory.delete(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const isValidUrl = (() => {
  if (!supabaseUrl) {
    return false;
  }

  try {
    const url = new URL(supabaseUrl);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
    );
  } catch {
    return false;
  }
})();

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? "Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env."
    : !isValidUrl
      ? "EXPO_PUBLIC_SUPABASE_URL debe ser una URL HTTPS válida."
      : null;

let supabaseClient: SupabaseClient<Database> | null = null;

if (!supabaseConfigurationError) {
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  return supabaseClient;
}
