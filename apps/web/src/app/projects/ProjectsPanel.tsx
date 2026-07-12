import { useRef, useState } from "react";
import { translate, type Language } from "../i18n";
import type { CloudProject } from "../../services/projectsRepository";
import { useDialog } from "../useDialog";

type ProjectsPanelProps = {
  language: Language;
  projects: CloudProject[];
  activeProjectId: string | null;
  loading: boolean;
  busy: boolean;
  canSaveCurrent: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onSaveNew: () => void;
  onUpdateCurrent: () => void;
  onDeleteAll: () => void;
};

export function ProjectsPanel({
  language,
  projects,
  activeProjectId,
  loading,
  busy,
  canSaveCurrent,
  onClose,
  onOpen,
  onRename,
  onDelete,
  onSaveNew,
  onUpdateCurrent,
  onDeleteAll,
}: ProjectsPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const t = (key: string) => translate(language, key);
  const overlayRef = useRef<HTMLDivElement>(null);
  useDialog(true, onClose, overlayRef);

  const startRename = (project: CloudProject) => {
    setRenamingId(project.id);
    setDraftTitle(project.title);
  };

  const commitRename = (id: string) => {
    const next = draftTitle.trim();
    if (next) onRename(id, next);
    setRenamingId(null);
  };

  return (
    <div
      className="projects-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("projects.title")}
      onClick={onClose}
      ref={overlayRef}
    >
      <aside className="projects-drawer" onClick={(event) => event.stopPropagation()}>
        <header className="projects-drawer-header">
          <h2>{t("projects.title")}</h2>
          <button type="button" className="auth-close" aria-label={t("projects.close")} onClick={onClose}>
            ×
          </button>
        </header>

        <div className="projects-save-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!canSaveCurrent || busy}
            onClick={onSaveNew}
          >
            {busy ? t("projects.saving") : t("projects.saveNew")}
          </button>
          {activeProjectId ? (
            <button
              type="button"
              className="secondary-button"
              disabled={!canSaveCurrent || busy}
              onClick={onUpdateCurrent}
            >
              {t("projects.update")}
            </button>
          ) : null}
        </div>

        <div className="projects-list" aria-busy={loading}>
          {loading ? (
            <p className="projects-empty">{t("projects.loading")}</p>
          ) : projects.length === 0 ? (
            <p className="projects-empty">{t("projects.empty")}</p>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className={`project-item${project.id === activeProjectId ? " is-active" : ""}`}
              >
                {renamingId === project.id ? (
                  <input
                    className="project-rename-input"
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => commitRename(project.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(project.id);
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="project-open"
                    onClick={() => onOpen(project.id)}
                    title={project.title}
                  >
                    <strong>{project.title}</strong>
                    <small>
                      {t("projects.updatedAt")} {new Date(project.updatedAt).toLocaleString()}
                    </small>
                  </button>
                )}
                <div className="project-actions">
                  {project.id === activeProjectId ? (
                    <span className="project-active-badge">{t("projects.activeBadge")}</span>
                  ) : null}
                  <button
                    type="button"
                    className="project-mini-button"
                    disabled={busy}
                    onClick={() => startRename(project)}
                  >
                    {t("projects.rename")}
                  </button>
                  <button
                    type="button"
                    className="project-mini-button project-delete"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t("projects.deleteConfirm"))) onDelete(project.id);
                    }}
                  >
                    {t("projects.delete")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="projects-footer">
          <p className="projects-privacy">{translate(language, "privacy.accountNote")}</p>
          {projects.length > 0 ? (
            <button
              type="button"
              className="project-mini-button project-delete"
              disabled={busy}
              onClick={onDeleteAll}
            >
              {translate(language, "action.clearCloudData")}
            </button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}
