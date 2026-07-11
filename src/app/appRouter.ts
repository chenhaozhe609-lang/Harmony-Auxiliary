export type AppScreen = "landing" | "workspace";

export type AppRoute = {
  screen: AppScreen;
  isDemo: boolean;
};

export function routeFromPath(pathname: string): AppRoute {
  if (pathname === "/demo") return { screen: "workspace", isDemo: true };
  if (pathname === "/workspace") return { screen: "workspace", isDemo: false };
  return { screen: "landing", isDemo: false };
}

export function pathForRoute(route: AppRoute): string {
  if (route.screen === "workspace") return route.isDemo ? "/demo" : "/workspace";
  return "/";
}
