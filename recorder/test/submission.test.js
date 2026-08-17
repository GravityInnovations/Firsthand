import test from "node:test";
import assert from "node:assert/strict";

import { buildFormData, SubmissionError, submitReport } from "../src/submission.js";
import { normalizeOptions } from "../src/options.js";

function makeReport() {
  return {
    description: "The save button did nothing.",
    metadata: { pageUrl: "https://example.test/settings" },
    video: {
      blob: new Blob(["video"], { type: "video/webm" }),
      fileName: "recording.webm"
    },
    prepared: { title: "Save button does not respond" }
  };
}

test("buildFormData uses the documented multipart field names", () => {
  const formData = buildFormData(makeReport());

  assert.equal(formData.get("description"), "The save button did nothing.");
  assert.deepEqual(JSON.parse(formData.get("metadata")), {
    pageUrl: "https://example.test/settings"
  });
  assert.equal(formData.get("video").name, "recording.webm");
  assert.deepEqual(JSON.parse(formData.get("prepared")), {
    title: "Save button does not respond"
  });
});

test("submitReport posts multipart data and returns the parsed response", async () => {
  let capturedRequest;
  const options = normalizeOptions({
    submission: {
      endpoint: "https://api.example.test/reports",
      headers: async () => ({ Authorization: "Bearer short-lived-token" })
    }
  });
  const fetchMock = async (url, request) => {
    capturedRequest = { url, request };
    return new Response(JSON.stringify({ reportId: "rpt_123" }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  };

  const result = await submitReport(makeReport(), options, fetchMock);

  assert.equal(capturedRequest.url, "https://api.example.test/reports");
  assert.equal(capturedRequest.request.method, "POST");
  assert.equal(capturedRequest.request.headers.Authorization, "Bearer short-lived-token");
  assert.ok(capturedRequest.request.body instanceof FormData);
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { reportId: "rpt_123" });
});

test("submitReport exposes endpoint failures without hiding the response", async () => {
  const options = normalizeOptions({
    submission: { endpoint: "https://api.example.test/reports" }
  });
  const fetchMock = async () => new Response(JSON.stringify({ error: "Rejected" }), {
    status: 422,
    headers: { "content-type": "application/json" }
  });

  await assert.rejects(
    () => submitReport(makeReport(), options, fetchMock),
    (error) => {
      assert.ok(error instanceof SubmissionError);
      assert.equal(error.status, 422);
      assert.deepEqual(error.response, { error: "Rejected" });
      return true;
    }
  );
});
