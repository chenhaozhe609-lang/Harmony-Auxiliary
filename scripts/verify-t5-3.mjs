// Live cloud round-trip verification for Task 5 / T5.3.
// Requires `.env` with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, and the
// Supabase project to have "Confirm email" turned off so the test user gets a
// session immediately (no real email is sent).
//
// Run: node scripts/verify-t5-3.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const email = process.env.VERIFY_EMAIL ?? "harmony.t5.verify@gmail.com";
const password = process.env.VERIFY_PASSWORD ?? "harmony-t5-verify-123";

const snapshot = (title) => ({
  schemaVersion: 1,
  id: "active",
  title,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  settings: {
    keyTonic: 0,
    mode: "major",
    tempo: 92,
    timeSignature: { numerator: 4, denominator: 4 },
    harmonyRhythm: "bar",
    inputMode: "manual",
    playbackTone: "acoustic-grand",
  },
  melody: [
    { id: "n1", midi: 60, pitchClass: 0, name: "C4", startBeat: 0, durationBeats: 1, velocity: 0.8, source: "manual" },
  ],
  candidates: [],
  selectedCandidateId: null,
  selectedChordId: null,
  harmonyStatus: "empty",
});

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exit(1);
};

const client = createClient(url, anonKey, { auth: { persistSession: false } });

// 1. Authenticate (sign up once, then reuse via sign-in).
let signUp = await client.auth.signUp({ email, password });
if (signUp.error && !/already registered/i.test(signUp.error.message)) {
  fail(`signUp: ${signUp.error.message}`);
}
let session = signUp.data?.session ?? null;
if (!session) {
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    fail(
      `Could not get a session. Is "Confirm email" still ON in Supabase? (${signIn.error.message})`,
    );
  }
  session = signIn.data.session;
}
const userId = (await client.auth.getUser()).data.user?.id;
if (!userId) fail("No user id after authentication.");

const results = {};

// 2. Create two projects.
const a = await client
  .from("projects")
  .insert({ user_id: userId, title: "T5.3 Verify A", snapshot: snapshot("A") })
  .select("id, title, snapshot, created_at, updated_at")
  .single();
if (a.error) fail(`createProject A: ${a.error.message}`);
const b = await client
  .from("projects")
  .insert({ user_id: userId, title: "T5.3 Verify B", snapshot: snapshot("B") })
  .select("id, title, snapshot, created_at, updated_at")
  .single();
if (b.error) fail(`createProject B: ${b.error.message}`);
results.created = [a.data.id, b.data.id];

// 3. List shows both, newest-first (B before A).
let list = await client
  .from("projects")
  .select("id, title, snapshot, created_at, updated_at")
  .order("updated_at", { ascending: false });
if (list.error) fail(`list: ${list.error.message}`);
const ids = list.data.map((r) => r.id);
results.listHasBoth = ids.includes(a.data.id) && ids.includes(b.data.id);
results.bSnapshotRoundTrips = list.data.find((r) => r.id === b.data.id)?.snapshot?.melody?.length === 1;

// 4. Update A's snapshot -> updated_at bumps, A moves to front.
await new Promise((r) => setTimeout(r, 1100));
const updA = await client
  .from("projects")
  .update({ snapshot: snapshot("A2") })
  .eq("id", a.data.id)
  .select("id, updated_at")
  .single();
if (updA.error) fail(`update A: ${updA.error.message}`);
results.updatedAtBumped = updA.data.updated_at !== a.data.updated_at;

// 5. Rename B.
const ren = await client
  .from("projects")
  .update({ title: "B Renamed" })
  .eq("id", b.data.id)
  .select("id, title")
  .single();
if (ren.error) fail(`rename B: ${ren.error.message}`);
results.renamed = ren.data.title === "B Renamed";

// B was renamed last, so the updated_at trigger should float it to the front.
list = await client
  .from("projects")
  .select("id")
  .order("updated_at", { ascending: false });
results.lastWriteMovedToFront = list.data[0]?.id === b.data.id;

// 6. RLS: an anonymous client sees none of these rows.
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const anonRead = await anon.from("projects").select("id");
results.rlsHidesFromAnon = (anonRead.data?.length ?? 0) === 0;

// 7. Delete both, then confirm they are gone.
for (const id of [a.data.id, b.data.id]) {
  const del = await client.from("projects").delete().eq("id", id);
  if (del.error) fail(`delete ${id}: ${del.error.message}`);
}
const after = await client.from("projects").select("id");
results.deletedGone = !(after.data ?? []).some((r) => results.created.includes(r.id));

await client.auth.signOut();

const checks = {
  listHasBoth: results.listHasBoth,
  bSnapshotRoundTrips: results.bSnapshotRoundTrips,
  updatedAtBumped: results.updatedAtBumped,
  renamed: results.renamed,
  lastWriteMovedToFront: results.lastWriteMovedToFront,
  rlsHidesFromAnon: results.rlsHidesFromAnon,
  deletedGone: results.deletedGone,
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ checks, results }, null, 2));
if (failed.length > 0) {
  console.error("Failed checks:", failed.map(([k]) => k).join(", "));
  process.exit(1);
}
console.log("T5.3 cloud round-trip OK");
