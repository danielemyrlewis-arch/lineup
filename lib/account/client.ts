"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const AUTH_STORAGE_KEY = "lineup:auth:v1";
export type AuthStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
let persistentStorage = true;
let browserClient: SupabaseClient | null = null;

/** These two public values are substituted into the static browser bundle. */
export function getPublicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
        parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.port) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

/** Private/full storage must not throw into either the auth SDK or the game. */
export function createSafeAuthStorage(factory: () => AuthStorage, onRestricted: () => void = () => {}): AuthStorage {
  const memory = new Map<string, string>();
  let restricted = false;
  const failed = () => { restricted = true; onRestricted(); };
  return {
    getItem(key) {
      if (restricted) return memory.get(key) ?? null;
      try {
        const value = factory().getItem(key);
        if (value !== null) memory.set(key, value);
        else memory.delete(key);
        return value;
      } catch { failed(); return memory.get(key) ?? null; }
    },
    setItem(key, value) {
      memory.set(key, value);
      if (restricted) return;
      try { factory().setItem(key, value); } catch { failed(); }
    },
    removeItem(key) {
      memory.delete(key);
      // Removal can still succeed when quota prevented an earlier write.
      try { factory().removeItem(key); } catch { failed(); }
    },
  };
}

export function hasPersistentAuthStorage(): boolean { return persistentStorage; }

/** Lazy singleton: SSR/builds never create a session or contact Supabase. */
export function getBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (browserClient) return browserClient;
  const config = getPublicSupabaseConfig();
  if (!config) return null;
  try {
    browserClient = createClient(config.url, config.key, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        storage: createSafeAuthStorage(() => window.localStorage, () => { persistentStorage = false; }),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Retain browser support for legacy redirect callbacks and existing sessions.
        flowType: "pkce",
      },
    });
    return browserClient;
  } catch { return null; }
}
