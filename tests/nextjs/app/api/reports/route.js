const reporterUrl = process.env.REPORTER_URL || "http://127.0.0.1:4200/v1/issues";

export async function POST(request) {
  const clientId = process.env.REPORTER_CLIENT_ID;
  const clientSecret = process.env.REPORTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return Response.json({ error: "Reporter client credentials are not configured on this Next.js host." }, { status: 503 });
  try {
    const upstream = await fetch(reporterUrl, { method: "POST", headers: { "content-type": request.headers.get("content-type") || "multipart/form-data", authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` }, body: request.body, duplex: "half" });
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch (error) {
    return Response.json({ error: "The reporter API is not available.", details: error instanceof Error ? error.message : "Unknown connection error" }, { status: 503 });
  }
}
