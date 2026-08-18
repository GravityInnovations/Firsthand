import assert from "node:assert/strict";
import { describe, it } from "node:test";
import wavefile from "wavefile";
import { FfmpegAudioProcessor } from "../src/media/audio-processor.js";

const { WaveFile } = wavefile;

describe("FfmpegAudioProcessor", () => {
  it("normalises supplied microphone audio to mono 16 kHz WAV", async () => {
    const source = new WaveFile();
    source.fromScratch(1, 8_000, "16", new Int16Array(800));
    const output = await new FfmpegAudioProcessor().prepare({
      audio: {
        buffer: Buffer.from(source.toBuffer()),
        fileName: "microphone.wav",
        mimeType: "audio/wav"
      }
    });

    assert.equal(output?.mimeType, "audio/wav");
    assert.equal(output?.fileName, "narration.wav");
    const prepared = new WaveFile(output?.buffer);
    assert.equal(prepared.fmt.sampleRate, 16_000);
    assert.equal(prepared.fmt.numChannels, 1);
  });
});
