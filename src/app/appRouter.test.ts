import { describe, expect, it } from "vitest";
import { pathForRoute, routeFromPath } from "./appRouter";

describe("appRouter", () => {
  it("maps public paths to app route state", () => {
    expect(routeFromPath("/")).toEqual({ screen: "landing", isDemo: false });
    expect(routeFromPath("/workspace")).toEqual({ screen: "workspace", isDemo: false });
    expect(routeFromPath("/demo")).toEqual({ screen: "workspace", isDemo: true });
    expect(routeFromPath("/unknown")).toEqual({ screen: "landing", isDemo: false });
  });

  it("serializes route state back to stable paths", () => {
    expect(pathForRoute({ screen: "landing", isDemo: false })).toBe("/");
    expect(pathForRoute({ screen: "workspace", isDemo: false })).toBe("/workspace");
    expect(pathForRoute({ screen: "workspace", isDemo: true })).toBe("/demo");
  });
});
