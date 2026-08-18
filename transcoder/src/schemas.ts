import { z } from "zod";

export const metadataSchema = z.record(z.string(), z.unknown());

export const prepareFieldsSchema = z.object({
  description: z.string().trim().max(20_000).default(""),
  metadata: metadataSchema.default({}),
  language: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).optional()
});

export const preparedReportSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(10_000),
  stepsToReproduce: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  expectedBehaviour: z.string().trim().max(5_000).default(""),
  actualBehaviour: z.string().trim().max(5_000).default(""),
  technicalContext: metadataSchema.default({}),
  uncertainties: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  developerNotes: z.string().trim().max(5_000).optional(),
  suggestedLabels: z.array(z.string().trim().min(1).max(100)).max(20).default([])
});
