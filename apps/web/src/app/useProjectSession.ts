import { useEffect, useState, type Dispatch } from "react";
import type { AppState } from "./sessionTypes";
import type { StoredProjectSnapshot } from "./projectTypes";
import type { AppAction } from "./appState";
import {
  createProject,
  deleteAllProjects,
  deleteProject,
  listProjects,
  renameProject,
  updateProject,
  clearActiveAutosave,
  createProjectSnapshot,
  loadActiveAutosave,
  saveActiveAutosave,
  type LocalProject,
} from "./projectRepository";

export function useProjectSession(state: AppState, dispatch: Dispatch<AppAction>, t: (key: string) => string,
  prepareOpen: () => void, setActiveStep: (step: number) => void, active = true) {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsBusy, setProjectsBusy] = useState(false);
  const [recoveredSnapshot, setRecoveredSnapshot] = useState<StoredProjectSnapshot | null>(null);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [clearingLocalData, setClearingLocalData] = useState(false);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadActiveAutosave()
      .then((snapshot) => {
        if (!cancelled && snapshot && snapshot.melody.length > 0) {
          setRecoveredSnapshot(snapshot);
        }
      })
      .catch(() => {
        // Recovery is best-effort; user-facing errors are reserved for direct actions.
      })
      .finally(() => {
        if (!cancelled) setAutosaveReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active || !autosaveReady || recoveredSnapshot || clearingLocalData) return;

    const timeout = window.setTimeout(() => {
      const save = state.melody.length > 0
        ? saveActiveAutosave(createProjectSnapshot(state))
        : clearActiveAutosave();
      save
        .then(() => {
          setLastAutosaveAt(state.melody.length > 0 ? new Date().toLocaleTimeString() : null);
          dispatch({ type: "clear-error", id: "autosave" });
        })
        .catch(() => {
          dispatch({ type: "set-error", id: "autosave", message: t("message.projectSaveFailure") });
        });
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [
    state.settings,
    state.melody,
    state.candidates,
    state.selectedCandidateId,
    state.selectedChordId,
    state.importState,
    autosaveReady,
    recoveredSnapshot,
    clearingLocalData,
    active,
  ]);

  const notifyProjects = (messageKey: string, tone: "status" | "error") => {
    dispatch({ type: "set-error", id: "projects", message: t(messageKey), tone });
    window.setTimeout(() => dispatch({ type: "clear-error", id: "projects" }), 2200);
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      setProjects(await listProjects());
    } catch {
      notifyProjects("message.projectLoadFailure", "error");
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleSaveNewProject = async () => {
    if (state.melody.length === 0 || projectsBusy) return;
    setProjectsBusy(true);
    try {
      const project = await createProject(
        state.importState.fileName ?? t("projects.defaultTitle"),
        createProjectSnapshot(state),
      );
      setProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      setActiveProjectId(project.id);
      notifyProjects("message.projectSaveSuccess", "status");
    } catch {
      notifyProjects("message.projectSaveFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleUpdateCurrentProject = async () => {
    if (!activeProjectId || state.melody.length === 0 || projectsBusy) return;
    setProjectsBusy(true);
    try {
      const project = await updateProject(activeProjectId, createProjectSnapshot(state));
      setProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      notifyProjects("message.projectSaveSuccess", "status");
    } catch {
      notifyProjects("message.projectSaveFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleOpenProject = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    prepareOpen();
    setRecoveredSnapshot(null);
    dispatch({ type: "restore-snapshot", snapshot: project.snapshot });
    setActiveProjectId(project.id);
    setActiveStep(project.snapshot.candidates.length > 0 ? 3 : 0);
    setProjectsOpen(false);
    notifyProjects("message.projectOpenSuccess", "status");
  };

  const handleRenameProject = async (id: string, title: string) => {
    setProjectsBusy(true);
    try {
      const project = await renameProject(id, title);
      setProjects((prev) => prev.map((item) => (item.id === id ? project : item)));
    } catch {
      notifyProjects("message.projectSaveFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    setProjectsBusy(true);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((item) => item.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
      notifyProjects("message.projectDeleteSuccess", "status");
    } catch {
      notifyProjects("message.projectDeleteFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const handleDeleteAllProjects = async () => {
    if (!window.confirm(t("message.clearProjectsConfirm"))) return;
    setProjectsBusy(true);
    try {
      await deleteAllProjects();
      setProjects([]);
      setActiveProjectId(null);
      notifyProjects("message.clearProjectsSuccess", "status");
    } catch {
      notifyProjects("message.clearProjectsFailure", "error");
    } finally {
      setProjectsBusy(false);
    }
  };

  const restoreAutosave = () => {
    if (!recoveredSnapshot) return;
    prepareOpen();
    setActiveProjectId(null);
    dispatch({ type: "restore-snapshot", snapshot: recoveredSnapshot });
    setRecoveredSnapshot(null);
  };

  const discardAutosave = async () => {
    try {
      await clearActiveAutosave();
      setRecoveredSnapshot(null);
    } catch {
      dispatch({ type: "set-error", id: "local-data", message: t("message.clearFailure") });
    }
  };

  return { projects, setProjects, activeProjectId, setActiveProjectId, projectsOpen, setProjectsOpen,
    projectsLoading, projectsBusy, recoveredSnapshot, setRecoveredSnapshot, lastAutosaveAt, setLastAutosaveAt,
    setClearingLocalData, loadProjects, handleSaveNewProject, handleUpdateCurrentProject, handleOpenProject,
    handleRenameProject, handleDeleteProject, handleDeleteAllProjects, restoreAutosave, discardAutosave };
}
