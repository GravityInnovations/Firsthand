import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const recorderRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);

const staticFiles = new Map([
  ["/", { path: path.join(recorderRoot, "demo", "index.html"), type: "text/html; charset=utf-8" }],
  ["/dist/firsthand-recorder.js", { path: path.join(recorderRoot, "dist", "firsthand-recorder.js"), type: "text/javascript; charset=utf-8" }],
  ["/dist/firsthand-recorder.js.map", { path: path.join(recorderRoot, "dist", "firsthand-recorder.js.map"), type: "application/json; charset=utf-8" }],
  ["/dist/firsthand-recorder.css", { path: path.join(recorderRoot, "dist", "firsthand-recorder.css"), type: "text/css; charset=utf-8" }]
]);

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/reports") {
    let receivedBytes = 0;
    for await (const chunk of request) {
      receivedBytes += chunk.length;
    }

    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({
      reportId: `demo_${Date.now()}`,
      status: "received",
      receivedBytes
    }));
    return;
  }

  const asset = staticFiles.get(request.url);
  if (!asset) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const details = await stat(asset.path);
    response.writeHead(200, {
      "content-type": asset.type,
      "content-length": details.size
    });
    createReadStream(asset.path).pipe(response);
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Run npm run build before starting the demo.");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Firsthand Recorder demo: http://127.0.0.1:${port}`);
});
