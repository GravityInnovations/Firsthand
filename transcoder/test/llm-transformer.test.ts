import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OpenAiReportTransformer } from "../src/providers/transformer/llm.js";

const report = {
  title: "Save action remains in progress",
  summary: "Saving never completes.",
  stepsToReproduce: ["Open settings", "Select Save"],
  expectedBehaviour: "The setting should save.",
  actualBehaviour: "The loading state remains visible.",
  technicalContext: { pageUrl: "https://example.test/settings" },
  uncertainties: [],
  developerNotes: "Check the save request.",
  suggestedLabels: ["bug"]
};

const input = { description: "Saving never completes", transcript: null, metadata: report.technicalContext };

describe("OpenAI report transformer", () => {
  it("sends server-only credentials and parses structured output", async () => {
    let request: Request | undefined;
    const transformer = new OpenAiReportTransformer(
      { apiKey: "openai-secret", model: "test-openai", baseUrl: "https://openai.test/v1" },
      async (url, init) => {
        request = new Request(url, init);
        return new Response(JSON.stringify({ output_text: JSON.stringify(report) }), { headers: { "content-type": "application/json" } });
      }
    );

    assert.deepEqual(await transformer.transform(input), report);
    assert.equal(request?.headers.get("authorization"), "Bearer openai-secret");
    assert.equal(new URL(request?.url || "").pathname, "/v1/responses");
  });
});
