import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { createRecorder } from "../src/index.js";

test("recorder mounts inline, opens, collects a description, and submits", async () => {
  const dom = new JSDOM(
    "<!doctype html><html><head><title>Demo</title></head><body><div id=host></div></body></html>",
    { url: "https://example.test/settings" }
  );
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch
  };
  let callbackDetail;

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.fetch = async () => new Response(JSON.stringify({ reportId: "rpt_demo" }), {
    status: 201,
    headers: { "content-type": "application/json" }
  });

  try {
    const recorder = createRecorder({
      target: "#host",
      position: "inline",
      features: { video: false, snapshot: false },
      submission: { endpoint: "https://api.example.test/reports" },
      callbacks: {
        onSubmitSuccess: (detail) => {
          callbackDetail = detail;
        }
      }
    });

    assert.ok(document.querySelector(".fhr-root--inline"));
    recorder.open();
    assert.equal(document.querySelector("[data-fhr=backdrop]").hidden, false);

    const textarea = document.querySelector("[data-fhr=description]");
    textarea.value = "The save button did nothing.";
    textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

    const result = await recorder.submit();

    assert.equal(result.status, 201);
    assert.equal(callbackDetail.result.body.reportId, "rpt_demo");
    assert.equal(recorder.getReport().description, "The save button did nothing.");
    await recorder.destroy();
    assert.equal(document.querySelector(".fhr-root"), null);
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.CustomEvent = previous.CustomEvent;
    globalThis.fetch = previous.fetch;
    dom.window.close();
  }
});
