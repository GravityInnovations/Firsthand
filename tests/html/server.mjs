import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = normalize(join(testDirectory, "..", ".."));
const port = Number(process.env.PORT || 4174);
const transcoderUrl = process.env.TRANSCODER_URL || "http://127.0.0.1:4100/v1/prepare";
const issueUrl = process.env.REPORTER_URL || "http://127.0.0.1:4200/v1/issues";
const useMockTranscoder = process.env.USE_MOCK_TRANSCODER === "1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function receiveReport(request, response) {
  let upstream;
  try {
    const reporterClientId = process.env.REPORTER_CLIENT_ID || "";
    const reporterClientSecret = process.env.REPORTER_CLIENT_SECRET || "";
    upstream = await fetch(issueUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers["content-type"] || "multipart/form-data",
        ...(reporterClientId && reporterClientSecret ? { authorization: `Basic ${Buffer.from(`${reporterClientId}:${reporterClientSecret}`).toString("base64")}` } : {})
      },
      body: request,
      duplex: "half"
    });
  } catch (error) {
    sendJson(response, 503, { error: "The local issue service is not available.", details: error instanceof Error ? error.message : "Unknown connection error", issueUrl });
    return;
  }
  const body = (upstream.headers.get("content-type") || "").includes("application/json") ? await upstream.json() : await upstream.text();
  sendJson(response, upstream.status, body);
}

async function prepareMockReport(request, response) {
  let bytesReceived = 0;
  for await (const chunk of request) {
    bytesReceived += chunk.length;
    if (bytesReceived > 100 * 1024 * 1024) {
      sendJson(response, 413, { error: "The local preparation request is too large." });
      return;
    }
  }

  const mock = JSON.parse(await readFile(join(testDirectory, "transcoder-response.json"), "utf8"));
  sendJson(response, 200, { ...mock, mock: true, bytesReceived });
}

async function prepareRealReport(request, response) {
  let upstream;

  try {
    upstream = await fetch(transcoderUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers["content-type"] || "multipart/form-data"
      },
      body: request,
      duplex: "half"
    });
  } catch (error) {
    sendJson(response, 503, {
      error: "The local transcoder is not available.",
      details: error instanceof Error ? error.message : "Unknown connection error",
      transcoderUrl
    });
    return;
  }

  const contentType = upstream.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await upstream.json()
    : await upstream.text();

  if (!upstream.ok) {
    sendJson(response, upstream.status, body);
    return;
  }

  if (!body || typeof body !== "object" || !("report" in body)) {
    sendJson(response, 502, {
      error: "The local transcoder returned an unexpected response.",
      transcoderUrl,
      response: body
    });
    return;
  }

  sendJson(response, 200, {
    prepared: body.report,
    requestId: body.requestId,
    transcription: body.transcription,
    warnings: body.warnings || [],
    transcoder: "local"
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/reports") {
    await receiveReport(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/prepare") {
    if (useMockTranscoder) {
      await prepareMockReport(request, response);
    } else {
      await prepareRealReport(request, response);
    }
    return;
  }

  const relativePath = url.pathname === "/" ? "tests/html/index.html" : url.pathname.slice(1);
  const filePath = normalize(join(repositoryRoot, relativePath));

  if (!filePath.startsWith(repositoryRoot) || ![
    join(testDirectory, "index.html"),
    join(repositoryRoot, "recorder", "dist", "firsthand-recorder.css"),
    join(repositoryRoot, "recorder", "dist", "firsthand-recorder.js")
  ].includes(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Firsthand local test: http://127.0.0.1:${port}`);
  console.log(useMockTranscoder
    ? "Preparation mode: mock response"
    : `Preparation mode: local transcoder at ${transcoderUrl}`);
  console.log("Press Ctrl+C to stop.");
});
