import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrepareReportService } from "../src/application/prepare-report.js";
import { AppError } from "../src/errors.js";
import type { AudioProcessor } from "../src/media/audio-processor.js";
import type { ReportTransformer, TransformationInput } from "../src/providers/transformer/types.js";
import type { TranscriptionProvider } from "../src/providers/transcription/types.js";
import type { PreparedReport, UploadedMedia } from "../src/types.js";

const audio: UploadedMedia = {
  buffer: Buffer.from("audio"),
  fileName: "narration.webm",
  mimeType: "audio/webm"
};

function report(input: TransformationInput): PreparedReport {
  return {
    title: "Refund remains in progress",
    summary: input.description || input.transcript?.text || "No summary",
    stepsToReproduce: [],
    expectedBehaviour: "",
    actualBehaviour: "",
    technicalContext: input.metadata,
    uncertainties: ["Needs review"],
    suggestedLabels: ["needs-triage"]
  };
}

describe("PrepareReportService", () => {
  it("combines transcription, description, and metadata", async () => {
    const audioProcessor: AudioProcessor = { prepare: async () => audio };
    const transcription: TranscriptionProvider = {
      name: "test-speech",
      transcribe: async ({ language }) => ({ provider: "test-speech", language, text: "The refund spinner never stops." })
    };
    let transformationInput: TransformationInput | undefined;
    const transformer: ReportTransformer = {
      name: "test-transformer",
      transform: async (input) => {
        transformationInput = input;
        return report(input);
      }
    };
    const service = new PrepareReportService(audioProcessor, transcription, transformer, { defaultLanguage: "en-US" });

    const result = await service.execute({
      description: "Refund is stuck",
      metadata: { pageUrl: "https://example.test/orders/1" },
      audio
    });

    assert.equal(result.status, "completed");
    assert.match(result.requestId, /^prep_/);
    assert.equal(result.transcription?.text, "The refund spinner never stops.");
    assert.equal(transformationInput?.description, "Refund is stuck");
    assert.deepEqual(transformationInput?.metadata, { pageUrl: "https://example.test/orders/1" });
    assert.deepEqual(result.warnings, []);
  });

  it("continues from written evidence when optional transcription fails", async () => {
    const service = new PrepareReportService(
      { prepare: async () => { throw new Error("speech unavailable"); } },
      { name: "test-speech", transcribe: async () => null },
      { name: "test-transformer", transform: async (input) => report(input) },
      { defaultLanguage: "en-US" }
    );

    const result = await service.execute({ description: "The page freezes", metadata: {}, audio });
    assert.equal(result.transcription, null);
    assert.equal(result.warnings[0]?.code, "TRANSCRIPTION_FAILED");
  });

  it("requires at least one form of evidence", async () => {
    const service = new PrepareReportService(
      { prepare: async () => null },
      { name: "disabled", transcribe: async () => null },
      { name: "test-transformer", transform: async (input) => report(input) },
      { defaultLanguage: "en-US" }
    );

    await assert.rejects(
      () => service.execute({ description: "", metadata: {} }),
      (error: unknown) => error instanceof AppError && error.code === "EVIDENCE_REQUIRED"
    );
  });
});
