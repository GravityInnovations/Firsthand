import { buildFormData } from "./submission.js";

export class PreparationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PreparationError";
    this.status = details.status;
    this.response = details.response;
  }
}

async function readResponse(response) {
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

export async function prepareReport(report, options, fetchImplementation = globalThis.fetch) {
  const { transcoder } = options;
  if (!transcoder.endpoint) {
    throw new PreparationError("A transcoder.endpoint must be configured before preparing.");
  }
  if (typeof fetchImplementation !== "function") {
    throw new PreparationError("Fetch is not available in this environment.");
  }

  const configuredHeaders = typeof transcoder.headers === "function"
    ? await transcoder.headers(report)
    : transcoder.headers;
  const response = await fetchImplementation(transcoder.endpoint, {
    method: transcoder.method,
    headers: configuredHeaders || {},
    credentials: transcoder.credentials,
    body: buildFormData(report)
  });
  const body = await readResponse(response);

  if (!response.ok) {
    throw new PreparationError(`Report preparation failed with status ${response.status}.`, {
      status: response.status,
      response: body
    });
  }

  return { status: response.status, body, response };
}
