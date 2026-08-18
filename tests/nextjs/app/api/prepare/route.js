import { readFile } from "node:fs/promises";
import { join } from "node:path";

const transcoderUrl = process.env.TRANSCODER_URL || "http://127.0.0.1:4100/v1/prepare";

export async function POST(request) {
  if (process.env.USE_MOCK_TRANSCODER === "1") {
    const mock = JSON.parse(await readFile(join(process.cwd(), "data", "transcoder-response.json"), "utf8"));
    return Response.json({ ...mock, mock: true });
  }
  try {
    const upstream = await fetch(transcoderUrl, { method: "POST", headers: { "content-type": request.headers.get("content-type") || "multipart/form-data" }, body: request.body, duplex: "half" });
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
  } catch (error) {
    return Response.json({ error: "The transcoder API is not available.", details: error instanceof Error ? error.message : "Unknown connection error" }, { status: 503 });
  }
}
