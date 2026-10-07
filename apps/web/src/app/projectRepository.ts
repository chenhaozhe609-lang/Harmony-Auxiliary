import type { AppState, StoredProjectSnapshot } from "../music/types";

const DB_NAME = "harmony-auxiliary-db";
const DB_VERSION = 1;
const AUTOSAVE_STORE = "autosaves";
const PROJECT_STORE = "projects";
const ACTIVE_AUTOSAVE_ID = "active";

export type LocalProject = {
  id: string;
  title: string;
  snapshot: StoredProjectSnapshot;
  createdAt: string;
  updatedAt: string;
};

type AutosaveRecord = {
  id: string;
  snapshot: StoredProjectSnapshot;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
        db.createObjectStore(AUTOSAVE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("imports")) {
        db.createObjectStore("imports", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string | string[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(storeName, mode);
    const committed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Storage transaction aborted."));
      transaction.onerror = () => reject(transaction.error ?? new Error("Storage transaction failed."));
    });
    const [result] = await Promise.all([operation(transaction), committed]);
    return result;
  } finally {
    db.close();
  }
}

function normaliseTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A project title is required.");
  return trimmed;
}

function projectWithSnapshot(
  project: Omit<LocalProject, "snapshot">,
  snapshot: StoredProjectSnapshot,
): LocalProject {
  return {
    ...project,
    snapshot: {
      ...snapshot,
      id: project.id,
      title: project.title,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  };
}

export async function listProjects(): Promise<LocalProject[]> {
  const projects = await withStore(PROJECT_STORE, "readonly", (transaction) =>
    requestToPromise<LocalProject[]>(transaction.objectStore(PROJECT_STORE).getAll()),
  );
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProject(
  title: string,
  snapshot: StoredProjectSnapshot,
): Promise<LocalProject> {
  const now = new Date().toISOString();
  const project = projectWithSnapshot(
    { id: crypto.randomUUID(), title: normaliseTitle(title), createdAt: now, updatedAt: now },
    snapshot,
  );
  await withStore(PROJECT_STORE, "readwrite", (transaction) =>
    requestToPromise(transaction.objectStore(PROJECT_STORE).add(project)),
  );
  return project;
}

async function changeProject(
  id: string,
  change: (project: LocalProject) => LocalProject,
): Promise<LocalProject> {
  return withStore(PROJECT_STORE, "readwrite", async (transaction) => {
    const store = transaction.objectStore(PROJECT_STORE);
    const existing = await requestToPromise<LocalProject | undefined>(store.get(id));
    if (!existing) throw new Error("Project not found.");
    const project = change(existing);
    await requestToPromise(store.put(project));
    return project;
  });
}

export function updateProject(id: string, snapshot: StoredProjectSnapshot): Promise<LocalProject> {
  return changeProject(id, (project) =>
    projectWithSnapshot({ ...project, updatedAt: new Date().toISOString() }, snapshot),
  );
}

export function renameProject(id: string, title: string): Promise<LocalProject> {
  const nextTitle = normaliseTitle(title);
  return changeProject(id, (project) =>
    projectWithSnapshot(
      { ...project, title: nextTitle, updatedAt: new Date().toISOString() },
      project.snapshot,
    ),
  );
}

export async function deleteProject(id: string): Promise<void> {
  await withStore(PROJECT_STORE, "readwrite", (transaction) =>
    requestToPromise(transaction.objectStore(PROJECT_STORE).delete(id)),
  );
}

export async function deleteAllProjects(): Promise<void> {
  await withStore(PROJECT_STORE, "readwrite", (transaction) =>
    requestToPromise(transaction.objectStore(PROJECT_STORE).clear()),
  );
}

export function createProjectSnapshot(state: AppState): StoredProjectSnapshot {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: "active",
    title: state.importState.fileName ?? "Untitled Harmony Sketch",
    createdAt: now,
    updatedAt: now,
    settings: state.settings,
    melody: state.melody,
    candidates: state.candidates,
    selectedCandidateId: state.selectedCandidateId,
    selectedChordId: state.selectedChordId,
    harmonyStatus: state.harmonyStatus,
    sourceImport: state.importState.fileName
      ? {
          fileName: state.importState.fileName,
          fileSize: state.importState.fileSize ?? 0,
          lastModified: state.importState.lastModified ?? 0,
          selectedTrackIndex: state.importState.selectedTrackIndex,
        }
      : undefined,
  };
}

export async function saveActiveAutosave(snapshot: StoredProjectSnapshot): Promise<void> {
  await withStore(AUTOSAVE_STORE, "readwrite", (transaction) =>
    requestToPromise(transaction.objectStore(AUTOSAVE_STORE).put({ id: ACTIVE_AUTOSAVE_ID, snapshot } satisfies AutosaveRecord)),
  );
}

export async function loadActiveAutosave(): Promise<StoredProjectSnapshot | null> {
  const record = await withStore(AUTOSAVE_STORE, "readonly", (transaction) =>
    requestToPromise<AutosaveRecord | undefined>(transaction.objectStore(AUTOSAVE_STORE).get(ACTIVE_AUTOSAVE_ID)),
  );
  return record?.snapshot ?? null;
}

export async function clearActiveAutosave(): Promise<void> {
  await withStore(AUTOSAVE_STORE, "readwrite", (transaction) =>
    requestToPromise(transaction.objectStore(AUTOSAVE_STORE).delete(ACTIVE_AUTOSAVE_ID)),
  );
}

export async function clearAllProjectData(): Promise<void> {
  await withStore([AUTOSAVE_STORE, PROJECT_STORE, "imports"], "readwrite", async (transaction) => {
    await Promise.all([AUTOSAVE_STORE, PROJECT_STORE, "imports"].map((name) =>
      requestToPromise(transaction.objectStore(name).clear()),
    ));
  });
}
