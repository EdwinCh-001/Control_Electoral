import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import { appRoles, type UserProfile } from "../domain/auth";

const profileCacheKey = "control-electoral.auth-profile";
const webProfileCache = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    appRoles.some((role) => role === value.role) &&
    typeof value.province_id === "string" &&
    typeof value.full_name === "string" &&
    typeof value.email === "string" &&
    typeof value.must_change_password === "boolean"
  );
}

async function getItem(): Promise<string | null> {
  if (Platform.OS === "web") {
    return webProfileCache.get(profileCacheKey) ?? null;
  }
  return SecureStore.getItemAsync(profileCacheKey);
}

async function setItem(value: string): Promise<void> {
  if (Platform.OS === "web") {
    webProfileCache.set(profileCacheKey, value);
    return;
  }
  await SecureStore.setItemAsync(profileCacheKey, value);
}

export async function readCachedProfile(
  userId: string,
): Promise<UserProfile | null> {
  const rawProfile = await getItem();
  if (!rawProfile) {
    return null;
  }

  let parsedProfile: unknown;
  try {
    parsedProfile = JSON.parse(rawProfile);
  } catch {
    await clearCachedProfile();
    return null;
  }

  if (!isUserProfile(parsedProfile)) {
    await clearCachedProfile();
    return null;
  }

  return parsedProfile.id === userId ? parsedProfile : null;
}

export async function storeCachedProfile(profile: UserProfile): Promise<void> {
  await setItem(JSON.stringify(profile));
}

export async function clearCachedProfile(): Promise<void> {
  if (Platform.OS === "web") {
    webProfileCache.delete(profileCacheKey);
    return;
  }
  await SecureStore.deleteItemAsync(profileCacheKey);
}
