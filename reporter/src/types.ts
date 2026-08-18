import { z } from "zod";

export interface UploadedMedia { buffer: Buffer; fileName: string; mimeType: string; }
export const preparedReportSchema = z.object({
  title: z.string().trim().min(1).max(160), summary: z.string().trim().min(1).max(10_000),
  stepsToReproduce: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  expectedBehaviour: z.string().trim().max(5_000).default(""), actualBehaviour: z.string().trim().max(5_000).default(""),
  technicalContext: z.record(z.string(), z.unknown()).default({}), uncertainties: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  developerNotes: z.string().trim().max(5_000).optional(), suggestedLabels: z.array(z.string().trim().min(1).max(100)).max(20).default([])
});
export type PreparedReport = z.infer<typeof preparedReportSchema>;
