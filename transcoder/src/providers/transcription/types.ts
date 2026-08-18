import type { Transcript, UploadedMedia } from "../../types.js";

export interface TranscriptionInput {
  media: UploadedMedia;
  language: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<Transcript | null>;
}
