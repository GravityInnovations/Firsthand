import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { AppError } from "../errors.js";
import type { UploadedMedia } from "../types.js";

export interface AudioPreparationInput {
  audio?: UploadedMedia;
  video?: UploadedMedia;
}

export interface AudioProcessor {
  prepare(input: AudioPreparationInput): Promise<UploadedMedia | null>;
}

const bundledFfmpegPath = ffmpegPath as unknown as string | null;

function safeExtension(fileName: string): string {
  const extension = extname(fileName).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(extension) ? extension : ".bin";
}

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const process = spawn(command, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk: string) => {
      if (stderr.length < 16_000) stderr += chunk;
    });
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2_000)}`));
    });
  });
}

export class FfmpegAudioProcessor implements AudioProcessor {
  constructor(private readonly executable: string | null = bundledFfmpegPath) {}

  async prepare(input: AudioPreparationInput): Promise<UploadedMedia | null> {
    const source = input.audio || input.video;
    if (!source) return null;
    if (!this.executable) {
      throw new AppError(500, "FFMPEG_UNAVAILABLE", "The server has no ffmpeg executable configured.");
    }

    const directory = await mkdtemp(join(tmpdir(), "firsthand-transcoder-"));
    const inputPath = join(directory, `recording${safeExtension(source.fileName)}`);
    const outputPath = join(directory, "narration.wav");

    try {
      await writeFile(inputPath, source.buffer);
      await run(this.executable, [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-i", inputPath,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "pcm_s16le",
        outputPath
      ]);
      return {
        buffer: await readFile(outputPath),
        fileName: "narration.wav",
        mimeType: "audio/wav"
      };
    } catch (error) {
      throw new AppError(422, "AUDIO_PREPARATION_FAILED", "Audio could not be prepared for transcription.", {
        cause: error instanceof Error ? error.message : "Unknown ffmpeg error"
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
