import type { TranscriptionProvider } from "./types.js";

export class DisabledTranscriptionProvider implements TranscriptionProvider {
  readonly name = "disabled";

  async transcribe(): Promise<null> {
    return null;
  }
}
