import test from "node:test";
import assert from "node:assert/strict";

import { normalizeOptions } from "../src/options.js";
import { prepareReport } from "../src/preparation.js";

test("prepareReport posts evidence to the configured transcoder", async () => {
  let captured;
  const options = normalizeOptions({
    transcoder: {
      endpoint: "https://api.example.test/prepare",
      headers: { "x-test": "firsthand" }
    }
  });
  const fetchMock = async (url, request) => {
    captured = { url, request };
    return new Response(JSON.stringify({ prepared: { title: "Prepared issue" } }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const result = await prepareReport({
    description: "Something failed.",
    metadata: {},
    video: null,
    prepared: null
  }, options, fetchMock);

  assert.equal(captured.url, "https://api.example.test/prepare");
  assert.equal(captured.request.method, "POST");
  assert.equal(captured.request.headers["x-test"], "firsthand");
  assert.equal(result.body.prepared.title, "Prepared issue");
});
