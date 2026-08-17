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
      features: { video: false },
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

test("closing the dialog preserves an active recording and changes the trigger action", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=host></div></body></html>");
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;

  try {
    const recorder = createRecorder({ target: "#host", position: "inline" });
    const session = {
      id: "active-recording",
      stop: async () => ({
        blob: new Blob(["video"], { type: "video/webm" }),
        durationMs: 1500,
        mimeType: "video/webm",
        hasAudio: true
      })
    };
    recorder.recordingSession = session;
    recorder._updateRecordingState();

    recorder.open();
    await recorder.close();

    assert.equal(recorder.recordingSession, session);
    assert.equal(document.querySelector("[data-fhr=trigger-label]").textContent, "Stop recording");
    assert.equal(document.querySelector("[data-fhr=backdrop]").hidden, true);

    await recorder.stopRecording();

    assert.equal(recorder.recordingSession, null);
    assert.equal(document.querySelector("[data-fhr=trigger-label]").textContent, "Report a problem");
    assert.equal(document.querySelector("[data-fhr=backdrop]").hidden, false);
    assert.equal(document.querySelector("[data-fhr=video-preview]").hidden, false);
    assert.equal(recorder.getReport().video.durationMs, 1500);

    await recorder.destroy();
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.CustomEvent = previous.CustomEvent;
    dom.window.close();
  }
});

test("the main trigger starts recording instead of opening the review dialog", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=host></div></body></html>");
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;

  try {
    const recorder = createRecorder({ target: "#host", position: "inline" });
    let started = false;
    recorder.startRecording = async () => { started = true; };

    document.querySelector("[data-fhr=trigger]").click();
    await Promise.resolve();

    assert.equal(started, true);
    assert.equal(document.querySelector("[data-fhr=backdrop]").hidden, true);
    await recorder.destroy();
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.CustomEvent = previous.CustomEvent;
    dom.window.close();
  }
});

test("transcoder preparation gates submission and becomes stale after editing", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id=host></div></body></html>");
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    CustomEvent: globalThis.CustomEvent,
    fetch: globalThis.fetch
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.fetch = async () => new Response(JSON.stringify({
    prepared: {
      title: "Save button does not respond",
      stepsToReproduce: ["Open settings", "Select Save"]
    }
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });

  try {
    const recorder = createRecorder({
      target: "#host",
      position: "inline",
      features: { video: false },
      transcoder: { endpoint: "https://api.example.test/prepare" }
    });
    const textarea = document.querySelector("[data-fhr=description]");
    const prepareButton = document.querySelector("[data-fhr=prepare]");
    const submitButton = document.querySelector("[data-fhr=submit]");

    textarea.value = "The save button did nothing.";
    textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(prepareButton.hidden, false);
    assert.equal(submitButton.hidden, true);

    await recorder.prepare();
    assert.equal(prepareButton.hidden, true);
    assert.equal(submitButton.hidden, false);
    assert.equal(recorder.getReport().prepared.title, "Save button does not respond");
    assert.match(document.querySelector("[data-fhr=prepared-content]").textContent, /Open settings/);

    textarea.value += " It still fails after retrying.";
    textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(prepareButton.hidden, false);
    assert.equal(submitButton.hidden, true);
    assert.equal(recorder.getReport().prepared, null);

    await recorder.destroy();
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.CustomEvent = previous.CustomEvent;
    globalThis.fetch = previous.fetch;
    dom.window.close();
  }
});
