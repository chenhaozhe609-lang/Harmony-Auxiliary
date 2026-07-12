declare const process: {
  env: Record<string, string | undefined>;
};

/** Liveness endpoint; dependency readiness is handled separately. */
export default function health(): Response {
  return Response.json({
    status: "ok",
    service: "harmony-api",
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
    timestamp: new Date().toISOString(),
  });
}
