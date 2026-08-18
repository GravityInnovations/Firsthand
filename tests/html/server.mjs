import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = normalize(join(testDirectory, "..", ".."));
const port = Number(process.env.PORT || 4174);

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
  let bytesReceived = 0;

  for await (const chunk of request) {
    bytesReceived += chunk.length;
    if (bytesReceived > 100 * 1024 * 1024) {
      sendJson(response, 413, { error: "The local test submission is too large." });
      return;
    }
  }

  sendJson(response, 201, {
    id: `local-${Date.now()}`,
    status: "received",
    bytesReceived,
    contentType: request.headers["content-type"],
    message: "The local mock endpoint received the report. Nothing was uploaded externally."
  });
}

async function prepareReport(request, response) {
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

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/reports") {
    await receiveReport(request, response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/prepare") {
    await prepareReport(request, response);
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
  console.log("Press Ctrl+C to stop.");
});
