import type { AppState, StoredProjectSnapshot } from "../music/types";

const DB_NAME = "harmony-auxiliary-db";
const DB_VERSION = 1;
const AUTOSAVE_STORE = "autosaves";
const ACTIVE_AUTOSAVE_ID = "active";

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
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, "readwrite");
    const store = transaction.objectStore(AUTOSAVE_STORE);
    await requestToPromise(store.put({ id: ACTIVE_AUTOSAVE_ID, snapshot } satisfies AutosaveRecord));
  } finally {
    db.close();
  }
}

export async function loadActiveAutosave(): Promise<StoredProjectSnapshot | null> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, "readonly");
    const store = transaction.objectStore(AUTOSAVE_STORE);
    const record = await requestToPromise<AutosaveRecord | undefined>(
      store.get(ACTIVE_AUTOSAVE_ID),
    );
    return record?.snapshot ?? null;
  } finally {
    db.close();
  }
}

export async function clearActiveAutosave(): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(AUTOSAVE_STORE, "readwrite");
    const store = transaction.objectStore(AUTOSAVE_STORE);
    await requestToPromise(store.delete(ACTIVE_AUTOSAVE_ID));
  } finally {
    db.close();
  }
}

export function clearAllProjectData(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
