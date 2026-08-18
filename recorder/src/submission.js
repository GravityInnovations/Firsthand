export class SubmissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SubmissionError";
    this.status = details.status;
    this.response = details.response;
  }
}

export function buildFormData(report, FormDataClass = globalThis.FormData) {
  if (!FormDataClass) {
    throw new Error("FormData is not available in this environment.");
  }

  const formData = new FormDataClass();
  formData.append("description", report.description || "");
  formData.append("metadata", JSON.stringify(report.metadata || {}));

  if (report.video?.blob) {
    formData.append(
      "video",
      report.video.blob,
      report.video.fileName || "recording.webm"
    );
  }

  if (report.prepared) {
    formData.append("prepared", JSON.stringify(report.prepared));
  }

  return formData;
}

async function readResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function submitReport(report, options, fetchImplementation = globalThis.fetch) {
  const { submission } = options;

  if (!submission.endpoint) {
    throw new SubmissionError("A submission.endpoint must be configured before submitting.");
  }

  if (typeof fetchImplementation !== "function") {
    throw new SubmissionError("Fetch is not available in this environment.");
  }

  const configuredHeaders = typeof submission.headers === "function"
    ? await submission.headers(report)
    : submission.headers;

  const response = await fetchImplementation(submission.endpoint, {
    method: submission.method,
    headers: configuredHeaders || {},
    credentials: submission.credentials,
    body: buildFormData(report)
  });

  const body = await readResponse(response);

  if (!response.ok) {
    throw new SubmissionError(`Report submission failed with status ${response.status}.`, {
      status: response.status,
      response: body
    });
  }

  return {
    status: response.status,
    body,
    response
  };
}
