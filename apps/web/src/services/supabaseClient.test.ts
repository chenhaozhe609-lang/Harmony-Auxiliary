import { afterEach, describe, expect, it, vi } from "vitest";

// The module reads import.meta.env at import time, so each test stubs the env
// and re-imports a fresh copy.
describe("supabaseClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("degrades to null when env vars are absent", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.resetModules();
    const mod = await import("./supabaseClient");
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
    expect(() => mod.requireSupabase()).toThrow(/not configured/i);
  });

  it("creates a client when env vars are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.resetModules();
    const mod = await import("./supabaseClient");
    expect(mod.isSupabaseConfigured).toBe(true);
    expect(mod.supabase).not.toBeNull();
    expect(mod.requireSupabase()).toBe(mod.supabase);
  });
});
