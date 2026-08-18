import type { PreparedReport } from "../../types.js";
import type { ReportTransformer, TransformationInput } from "./types.js";

function compact(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function titleFrom(text: string): string {
  const firstLine = text.split(/[\r\n.!?]/, 1)[0]?.trim() || "User-reported problem";
  return firstLine.length <= 120 ? firstLine : `${firstLine.slice(0, 117).trimEnd()}...`;
}

export class HeuristicReportTransformer implements ReportTransformer {
  readonly name = "heuristic";

  async transform(input: TransformationInput): Promise<PreparedReport> {
    const evidence = compact([input.description, input.transcript?.text || ""]);
    const summary = evidence.join("\n\n");
    const uncertainties: string[] = [];

    if (!input.description) uncertainties.push("The user did not provide a written description.");
    if (!input.transcript) uncertainties.push("No speech transcript was available.");
    uncertainties.push("Steps, expected behaviour, and actual behaviour require user review.");

    return {
      title: titleFrom(evidence[0] || "User-reported problem"),
      summary: summary || "Evidence was supplied without readable text.",
      stepsToReproduce: [],
      expectedBehaviour: "",
      actualBehaviour: "",
      technicalContext: input.metadata,
      uncertainties,
      developerNotes: "This draft was prepared without an external transformation agent.",
      suggestedLabels: ["needs-triage"]
    };
  }
}
