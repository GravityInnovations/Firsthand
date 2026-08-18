import { randomUUID } from "node:crypto";
import { AppError, errorMessage } from "../errors.js";
import type { AudioProcessor } from "../media/audio-processor.js";
import { preparedReportSchema } from "../schemas.js";
import type { ReportTransformer } from "../providers/transformer/types.js";
import type { TranscriptionProvider } from "../providers/transcription/types.js";
import type { PrepareReportInput, PrepareReportResult, PreparationWarning, Transcript } from "../types.js";

export interface PrepareReportServiceOptions {
  defaultLanguage: string;
}

export interface PrepareReportExecutor {
  execute(input: PrepareReportInput): Promise<PrepareReportResult>;
}

export class PrepareReportService implements PrepareReportExecutor {
  constructor(
    private readonly audioProcessor: AudioProcessor,
    private readonly transcriptionProvider: TranscriptionProvider,
    private readonly transformer: ReportTransformer,
    private readonly options: PrepareReportServiceOptions
  ) {}

  async execute(input: PrepareReportInput): Promise<PrepareReportResult> {
    if (!input.description && !input.audio && !input.video) {
      throw new AppError(400, "EVIDENCE_REQUIRED", "Provide a description, audio, or video recording.");
    }

    const warnings: PreparationWarning[] = [];
    let transcript: Transcript | null = null;

    if (this.transcriptionProvider.name === "disabled") {
      if (input.audio || input.video) {
        warnings.push({ code: "TRANSCRIPTION_DISABLED", message: "Audio transcription is not enabled on this server." });
      }
    } else {
      try {
        const audio = await this.audioProcessor.prepare({
          ...(input.audio ? { audio: input.audio } : {}),
          ...(input.video ? { video: input.video } : {})
        });
        if (audio) {
          transcript = await this.transcriptionProvider.transcribe({
            media: audio,
            language: input.language || this.options.defaultLanguage
          });
        }
      } catch (error) {
        if (!input.description) throw error;
        warnings.push({ code: "TRANSCRIPTION_FAILED", message: errorMessage(error) });
      }
    }

    if (!input.description && !transcript) {
      throw new AppError(422, "NO_TEXTUAL_EVIDENCE", "No written description or usable speech transcript was available.");
    }

    const transformed = await this.transformer.transform({
      description: input.description,
      transcript,
      metadata: input.metadata
    });
    const report = preparedReportSchema.parse(transformed);

    return {
      requestId: `prep_${randomUUID()}`,
      status: "completed",
      transcription: transcript,
      report,
      warnings
    };
  }
}
