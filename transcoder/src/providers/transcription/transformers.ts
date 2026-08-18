import wavefile from "wavefile";
import { AppError } from "../../errors.js";
import type { Transcript } from "../../types.js";
import type { TranscriptionInput, TranscriptionProvider } from "./types.js";

const { WaveFile } = wavefile;

interface TransformersWhisperConfig {
  model: string;
  cacheDir?: string;
  chunkLengthSeconds?: number;
}

export interface LocalWhisperTranscriber {
  (audio: Float32Array, options: { language: string; task: "transcribe"; chunk_length_s?: number; stride_length_s?: number }): Promise<unknown>;
}

export type LocalWhisperFactory = (model: string, cacheDir?: string) => Promise<LocalWhisperTranscriber>;

async function createTranscriber(model: string, cacheDir?: string): Promise<LocalWhisperTranscriber> {
  const { env, pipeline } = await import("@huggingface/transformers");
  if (cacheDir) env.cacheDir = cacheDir;
  const transcriber = await pipeline("automatic-speech-recognition", model, { dtype: "q8" });
  return transcriber as unknown as LocalWhisperTranscriber;
}

function decodeMonoWav(buffer: Buffer): Float32Array {
  try {
    const wav = new WaveFile(buffer);
    wav.toBitDepth("32f");
    wav.toSampleRate(16_000);
    const decoded = wav.getSamples(false) as unknown;
    const mono = Array.isArray(decoded) ? decoded[0] : decoded;
    if (!mono || typeof mono !== "object" || !("length" in mono)) {
      throw new Error("WAV contains no audio channel");
    }
    return Float32Array.from(mono as ArrayLike<number>);
  } catch (error) {
    throw new AppError(422, "INVALID_TRANSCRIPTION_AUDIO", "The prepared WAV audio could not be decoded.", {
      cause: error instanceof Error ? error.message : "Unknown WAV decoding error"
    });
  }
}

function transcriptText(output: unknown): string {
  if (!output || typeof output !== "object" || !("text" in output) || typeof output.text !== "string") return "";
  return output.text.trim();
}

export class TransformersWhisperTranscriptionProvider implements TranscriptionProvider {
  readonly name = "transformers";
  private transcriber?: Promise<LocalWhisperTranscriber>;

  constructor(
    private readonly config: TransformersWhisperConfig,
    private readonly factory: LocalWhisperFactory = createTranscriber
  ) {}

  async transcribe(input: TranscriptionInput): Promise<Transcript> {
    this.transcriber ||= this.factory(this.config.model, this.config.cacheDir);
    const output = await (await this.transcriber)(decodeMonoWav(input.media.buffer), {
      language: input.language.split("-", 1)[0]?.toLowerCase() || "en",
      task: "transcribe",
      chunk_length_s: this.config.chunkLengthSeconds || 30,
      stride_length_s: 5
    });
    const text = transcriptText(output);
    if (!text) {
      throw new AppError(422, "NO_SPEECH_RECOGNIZED", "Local Whisper did not recognize any speech.");
    }
    return { provider: this.name, language: input.language, text };
  }
}
