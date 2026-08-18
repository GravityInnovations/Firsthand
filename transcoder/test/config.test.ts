import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.js";

describe("transcription configuration", () => {
  it("selects local Transformers.js without cloud transcription credentials", () => {
    const config = loadConfig({
      TRANSCRIPTION_PROVIDER: "local",
      TRANSCRIPTION_MODEL: "test/whisper"
    });

    assert.equal(config.transcription.provider, "local");
    assert.equal(config.transcription.model, "test/whisper");
    assert.equal(config.transcription.cacheDir, ".transformers-cache");
    assert.equal(config.transcription.chunkLengthSeconds, 30);
    assert.equal(config.transcription.projectId, undefined);
  });

  it("selects OpenAI only when its server API key is configured", () => {
    const openai = loadConfig({ TRANSFORMER_PROVIDER: "openai", TRANSFORMER_API_KEY: "server-key", TRANSFORMER_MODEL: "test-openai" });

    assert.equal(openai.transformer.model, "test-openai");
    assert.throws(() => loadConfig({ TRANSFORMER_PROVIDER: "openai" }), /TRANSFORMER_API_KEY/);
  });
});
