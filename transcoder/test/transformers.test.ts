import assert from "node:assert/strict";
import { describe, it } from "node:test";
import wavefile from "wavefile";
import { AppError } from "../src/errors.js";
import {
  TransformersWhisperTranscriptionProvider,
  type LocalWhisperFactory
} from "../src/providers/transcription/transformers.js";

const { WaveFile } = wavefile;

function silentWav(): Buffer {
  const wav = new WaveFile();
  wav.fromScratch(2, 16_000, "16", [new Int16Array(1_600), new Int16Array(1_600)]);
  return Buffer.from(wav.toBuffer());
}

describe("TransformersWhisperTranscriptionProvider", () => {
  it("decodes WAV audio and lazily reuses the local model", async () => {
    let loads = 0;
    let receivedSamples = 0;
    let receivedLanguage = "";
    const factory: LocalWhisperFactory = async (model) => {
      loads += 1;
      assert.equal(model, "test/whisper");
      return async (audio, options) => {
        receivedSamples = audio.length;
        receivedLanguage = options.language;
        return { text: "  Save remains in progress.  " };
      };
    };
    const provider = new TransformersWhisperTranscriptionProvider({ model: "test/whisper" }, factory);
    const input = {
      media: { buffer: silentWav(), fileName: "narration.wav", mimeType: "audio/wav" },
      language: "en-US"
    };

    const first = await provider.transcribe(input);
    const second = await provider.transcribe(input);

    assert.equal(first.text, "Save remains in progress.");
    assert.equal(second.provider, "transformers");
    assert.equal(receivedSamples, 1_600);
    assert.equal(receivedLanguage, "en");
    assert.equal(loads, 1);
  });

  it("rejects an empty model response", async () => {
    const provider = new TransformersWhisperTranscriptionProvider(
      { model: "test/whisper" },
      async () => async () => ({ text: " " })
    );
    await assert.rejects(
      () => provider.transcribe({
        media: { buffer: silentWav(), fileName: "narration.wav", mimeType: "audio/wav" },
        language: "en-US"
      }),
      (error: unknown) => error instanceof AppError && error.code === "NO_SPEECH_RECOGNIZED"
    );
  });
});
