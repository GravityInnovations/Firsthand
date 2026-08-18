import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { PrepareReportInput, PrepareReportResult } from "../src/types.js";

const config: AppConfig = {
  host: "127.0.0.1",
  port: 4100,
  corsOrigins: ["*"],
  maxMediaBytes: 1024 * 1024,
  transcription: {
    provider: "disabled",
    language: "en-US",
    model: "onnx-community/whisper-tiny",
    cacheDir: ".transformers-cache",
    chunkLengthSeconds: 30
  },
  transformer: {
    provider: "heuristic",
    baseUrl: "https://api.openai.com/v1"
  },
};

const prepared: PrepareReportResult = {
  requestId: "prep_test",
  status: "completed",
  transcription: null,
  report: {
    title: "Save does not finish",
    summary: "Save does not finish",
    stepsToReproduce: [],
    expectedBehaviour: "",
    actualBehaviour: "",
    technicalContext: {},
    uncertainties: [],
    suggestedLabels: []
  },
  warnings: []
};

async function multipartPayload(): Promise<{ body: Buffer; contentType: string }> {
  const form = new FormData();
  form.set("description", "Save does not finish");
  form.set("metadata", JSON.stringify({ pageUrl: "https://example.test/settings" }));
  form.set("video", new Blob(["video"], { type: "video/webm" }), "recording.webm");
  const request = new Request("http://localhost/v1/prepare", { method: "POST", body: form });
  return {
    body: Buffer.from(await request.arrayBuffer()),
    contentType: request.headers.get("content-type")!
  };
}

describe("transcoder HTTP API", () => {
  it("accepts the recorder multipart contract", async () => {
    let received: PrepareReportInput | undefined;
    const app = await buildApp({
      config,
      prepareService: { execute: async (input) => { received = input; return prepared; } }
    });
    const payload = await multipartPayload();

    const response = await app.inject({
      method: "POST",
      url: "/v1/prepare",
      headers: { "content-type": payload.contentType },
      payload: payload.body
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().requestId, "prep_test");
    assert.equal(received?.description, "Save does not finish");
    assert.equal(received?.video?.mimeType, "video/webm");
    await app.close();
  });

  it("rejects non-multipart requests", async () => {
    const app = await buildApp({
      config,
      prepareService: { execute: async () => prepared }
    });
    const response = await app.inject({ method: "POST", url: "/v1/prepare", payload: {} });

    assert.equal(response.statusCode, 415);
    assert.equal(response.json().error.code, "MULTIPART_REQUIRED");
    await app.close();
  });

  it("protects preparation when an API token is configured", async () => {
    const app = await buildApp({
      config: { ...config, apiAuthToken: "test-token" },
      prepareService: { execute: async () => prepared }
    });
    const payload = await multipartPayload();
    const response = await app.inject({
      method: "POST",
      url: "/v1/prepare",
      headers: { "content-type": payload.contentType },
      payload: payload.body
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error.code, "UNAUTHORIZED");
    await app.close();
  });

});
