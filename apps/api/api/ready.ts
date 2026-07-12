declare const process: {
  env: Record<string, string | undefined>;
};

/** A2 replaces this explicit placeholder with a real database probe. */
export default function ready(): Response {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  return Response.json(
    {
      status: databaseConfigured ? "not_verified" : "not_configured",
      checks: {
        database: databaseConfigured ? "not_verified" : "not_configured",
      },
    },
    { status: 503 },
  );
}
