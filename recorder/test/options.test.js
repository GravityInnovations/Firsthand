import test from "node:test";
import assert from "node:assert/strict";

import { collectBrowserMetadata, normalizeOptions } from "../src/options.js";

test("normalizeOptions merges nested configuration without losing defaults", () => {
  const options = normalizeOptions({
    position: "top-left",
    features: { microphone: false },
    labels: { trigger: "Help" },
    theme: { primaryColor: "#123456" }
  });

  assert.equal(options.position, "top-left");
  assert.equal(options.features.microphone, false);
  assert.equal(options.features.video, true);
  assert.equal(options.labels.trigger, "Help");
  assert.equal(options.labels.submit, "Submit report");
  assert.equal(options.theme.primaryColor, "#123456");
});

test("normalizeOptions rejects unsupported positions", () => {
  assert.throws(
    () => normalizeOptions({ position: "middle" }),
    /Unsupported recorder position/
  );
});

test("collectBrowserMetadata returns page and viewport context", () => {
  const metadata = collectBrowserMetadata({
    location: { href: "https://example.test/account" },
    document: { title: "Account", referrer: "https://example.test/" },
    navigator: { userAgent: "Test Browser", language: "en-GB" },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2
  });

  assert.equal(metadata.pageUrl, "https://example.test/account");
  assert.equal(metadata.pageTitle, "Account");
  assert.deepEqual(metadata.viewport, { width: 1280, height: 720, devicePixelRatio: 2 });
});
