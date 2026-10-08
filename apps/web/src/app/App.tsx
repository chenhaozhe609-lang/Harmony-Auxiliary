import { lazy, Suspense, useEffect, useState } from "react";
import { pathForRoute, routeFromPath, type AppScreen } from "./appRouter";

const Landing = lazy(() => import("../components/landing/Landing"));
const Workspace = lazy(() => import("./Workspace"));

export default function App() {
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  const [workspaceVisited, setWorkspaceVisited] = useState(route.screen === "workspace");
  useEffect(() => {
    const onPopState = () => {
      const next = routeFromPath(window.location.pathname);
      if (next.screen === "workspace") setWorkspaceVisited(true);
      setRoute(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (next: { screen: AppScreen; isDemo: boolean }, mode: "push" | "replace" = "push") => {
    const path = pathForRoute(next);
    if (window.location.pathname !== path) window.history[mode === "replace" ? "replaceState" : "pushState"](null, "", path);
    if (next.screen === "workspace") setWorkspaceVisited(true);
    setRoute(next);
  };
  return <Suspense fallback={<div role="status" aria-label="Loading" />}>
    {route.screen === "landing" ? <Landing
      onEnterWorkspace={() => navigate({ screen: "workspace", isDemo: false })}
      onEnterDemo={() => navigate({ screen: "workspace", isDemo: true })}
      prefersReducedMotion={window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false}
    /> : null}
    {workspaceVisited ? <div hidden={route.screen !== "workspace"}>
      <Workspace active={route.screen === "workspace"} isDemo={route.isDemo} navigateApp={navigate} />
    </div> : null}
  </Suspense>;
}
