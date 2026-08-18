import type { PreparedReport, Transcript } from "../../types.js";

export interface TransformationInput {
  description: string;
  transcript: Transcript | null;
  metadata: Record<string, unknown>;
}

export interface ReportTransformer {
  readonly name: string;
  transform(input: TransformationInput): Promise<PreparedReport>;
}
