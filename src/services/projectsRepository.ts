import type { StoredProjectSnapshot } from "../music/types";
import { requireSupabase } from "./supabaseClient";

// Cloud project storage (Task 5 / T5.3). Each row in the `projects` table holds
// a StoredProjectSnapshot in its `snapshot` jsonb column. Row-level security
// scopes every query to the signed-in user, so these helpers never filter by
// user_id on read — the database does it.

export type CloudProject = {
  id: string;
  title: string;
  snapshot: StoredProjectSnapshot;
  createdAt: string;
  updatedAt: string;
};

type ProjectRow = {
  id: string;
  title: string;
  snapshot: StoredProjectSnapshot;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ProjectRow): CloudProject {
  return {
    id: row.id,
    title: row.title,
    snapshot: row.snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function currentUserId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated.");
  }
  return data.user.id;
}

export async function listProjects(): Promise<CloudProject[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("projects")
    .select("id, title, snapshot, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ProjectRow[]).map(mapRow);
}

export async function createProject(
  title: string,
  snapshot: StoredProjectSnapshot,
): Promise<CloudProject> {
  const client = requireSupabase();
  const userId = await currentUserId();
  const { data, error } = await client
    .from("projects")
    .insert({ user_id: userId, title, snapshot })
    .select("id, title, snapshot, created_at, updated_at")
    .single();
  if (error) throw error;
  return mapRow(data as ProjectRow);
}

export async function updateProject(
  id: string,
  snapshot: StoredProjectSnapshot,
  title?: string,
): Promise<CloudProject> {
  const client = requireSupabase();
  const patch: { snapshot: StoredProjectSnapshot; title?: string } = { snapshot };
  if (title !== undefined) patch.title = title;
  const { data, error } = await client
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("id, title, snapshot, created_at, updated_at")
    .single();
  if (error) throw error;
  return mapRow(data as ProjectRow);
}

export async function renameProject(id: string, title: string): Promise<CloudProject> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("projects")
    .update({ title })
    .eq("id", id)
    .select("id, title, snapshot, created_at, updated_at")
    .single();
  if (error) throw error;
  return mapRow(data as ProjectRow);
}

export async function deleteProject(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllProjects(): Promise<void> {
  const client = requireSupabase();
  const userId = await currentUserId();
  // RLS already scopes to the user; the explicit user_id filter satisfies
  // Supabase's requirement that bulk deletes carry a filter.
  const { error } = await client.from("projects").delete().eq("user_id", userId);
  if (error) throw error;
}
