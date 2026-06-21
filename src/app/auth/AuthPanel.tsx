import { useState, type FormEvent } from "react";
import { translate, type Language } from "../i18n";
import { useAuth } from "./AuthProvider";

type AuthPanelProps = {
  language: Language;
  onClose: () => void;
  onAuthenticated: () => void;
  onDemo?: () => void;
};

type PanelMode = "sign-in" | "sign-up";

export function AuthPanel({ language, onClose, onAuthenticated, onDemo }: AuthPanelProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<PanelMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "status"; text: string } | null>(null);
  const t = (key: string) => translate(language, key);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);

    const result =
      mode === "sign-in" ? await signIn(email, password) : await signUp(email, password);

    setBusy(false);

    if (!result.ok) {
      setMessage({ tone: "error", text: result.message || t("auth.errorGeneric") });
      return;
    }

    if (mode === "sign-up" && result.needsConfirmation) {
      setMessage({ tone: "status", text: t("auth.checkEmail") });
      setMode("sign-in");
      return;
    }

    onAuthenticated();
  };

  return (
    <div
      className="auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "sign-in" ? t("auth.signInTitle") : t("auth.signUpTitle")}
      onClick={onClose}
    >
      <div className="auth-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-close" aria-label={t("auth.close")} onClick={onClose}>
          ×
        </button>
        <h2>{mode === "sign-in" ? t("auth.signInTitle") : t("auth.signUpTitle")}</h2>
        <p className="auth-prompt-copy">{t("auth.landingPrompt")}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            {t("auth.email")}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            {t("auth.password")}
            <input
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small>{t("auth.passwordHint")}</small>
          </label>

          {message ? (
            <p className="auth-message" data-tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          ) : null}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy
              ? mode === "sign-in"
                ? t("auth.signingIn")
                : t("auth.signingUp")
              : mode === "sign-in"
                ? t("auth.signInCta")
                : t("auth.signUpCta")}
          </button>
        </form>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
            setMessage(null);
          }}
        >
          {mode === "sign-in" ? t("auth.toggleToSignUp") : t("auth.toggleToSignIn")}
        </button>

        <div className="auth-secondary">
          <button type="button" className="auth-dismiss" onClick={onClose}>
            {t("auth.dismiss")}
          </button>
          {onDemo ? (
            <button type="button" className="auth-demo-link" onClick={onDemo}>
              {t("auth.demoCta")}
            </button>
          ) : null}
        </div>

        <p className="auth-privacy">{t("privacy.accountNote")}</p>
      </div>
    </div>
  );
}
