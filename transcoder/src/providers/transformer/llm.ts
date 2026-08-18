import { AppError } from "../../errors.js";
import { preparedReportSchema } from "../../schemas.js";
import type { PreparedReport } from "../../types.js";
import type { ReportTransformer, TransformationInput } from "./types.js";

const reportSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    stepsToReproduce: { type: "array", items: { type: "string" } },
    expectedBehaviour: { type: "string" },
    actualBehaviour: { type: "string" },
    technicalContext: { type: "object", additionalProperties: true },
    uncertainties: { type: "array", items: { type: "string" } },
    developerNotes: { type: "string" },
    suggestedLabels: { type: "array", items: { type: "string" } }
  },
  required: ["title", "summary", "stepsToReproduce", "expectedBehaviour", "actualBehaviour", "technicalContext", "uncertainties", "developerNotes", "suggestedLabels"],
  additionalProperties: false
} as const;

const defaultInstructions = "Turn the supplied user evidence into a concise, factual developer report. Preserve uncertainty. Do not invent steps, expected behaviour, actual behaviour, or technical facts that the evidence does not support. Return only a JSON object matching the supplied schema.";

interface LlmTransformerConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  instructions?: string;
}

function parseReport(value: unknown, provider: string): PreparedReport {
  const parsed = preparedReportSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(502, "INVALID_TRANSFORMER_RESPONSE", `${provider} returned an invalid prepared report.`, parsed.error.flatten());
  }
  return parsed.data;
}

function parseJson(text: string, provider: string): PreparedReport {
  try {
    return parseReport(JSON.parse(text), provider);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, "INVALID_TRANSFORMER_RESPONSE", `${provider} did not return valid JSON.`);
  }
}

function providerFailureMessage(body: unknown, provider: string, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = body.error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return `${provider} returned status ${status}: ${error.message}`;
    }
  }
  return `${provider} returned status ${status}.`;
}

function openAiOutputText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  if ("output_text" in body && typeof body.output_text === "string") return body.output_text;
  if (!("output" in body) || !Array.isArray(body.output)) return "";

  return body.output.flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) return [];
    return item.content.flatMap((content: unknown) => {
      if (!content || typeof content !== "object" || !("text" in content) || typeof content.text !== "string") return [];
      return [content.text];
    });
  }).join("");
}

function prompt(input: TransformationInput): string {
  return JSON.stringify({
    writtenDescription: input.description,
    transcript: input.transcript?.text || null,
    transcriptLanguage: input.transcript?.language || null,
    metadata: input.metadata
  });
}

export class OpenAiReportTransformer implements ReportTransformer {
  readonly name = "openai";
  constructor(private readonly config: LlmTransformerConfig, private readonly fetchImplementation: typeof fetch = fetch) {}

  async transform(input: TransformationInput): Promise<PreparedReport> {
    const response = await this.fetchImplementation(`${this.config.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.config.apiKey}` },
      body: JSON.stringify({
        model: this.config.model,
        store: false,
        instructions: this.config.instructions || defaultInstructions,
        input: prompt(input),
        text: { format: { type: "json_schema", name: "firsthand_prepared_report", strict: false, schema: reportSchema } }
      })
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AppError(502, "TRANSFORMER_REQUEST_FAILED", providerFailureMessage(body, "OpenAI", response.status));
    }
    return parseJson(openAiOutputText(body), "OpenAI");
  }
}
