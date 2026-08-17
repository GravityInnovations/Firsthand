const POSITIONS = new Set([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
  "inline"
]);

export const DEFAULT_OPTIONS = Object.freeze({
  position: "bottom-right",
  target: null,
  className: "",
  closeOnSuccess: false,
  maxRecordingMs: 120000,
  maxSnapshots: 5,
  features: {
    video: true,
    snapshot: true,
    description: true,
    microphone: true,
    systemAudio: true
  },
  labels: {
    trigger: "Report a problem",
    dialogTitle: "Report a problem",
    dialogDescription: "Show us what happened or describe the problem below.",
    record: "Record video",
    stop: "Stop recording",
    snapshot: "Take snapshot",
    description: "What happened?",
    descriptionPlaceholder: "Describe what you were trying to do and what went wrong.",
    submit: "Submit report",
    submitting: "Submitting…",
    success: "Your report was submitted.",
    close: "Close",
    remove: "Remove"
  },
  theme: {
    primaryColor: "#3157d5",
    primaryTextColor: "#ffffff",
    surfaceColor: "#ffffff",
    textColor: "#182033",
    mutedColor: "#667085",
    borderColor: "#d8deea",
    borderRadius: "14px",
    zIndex: 2147483000
  },
  metadata: {},
  submission: {
    endpoint: "",
    method: "POST",
    headers: {},
    credentials: "same-origin"
  },
  callbacks: {}
});

function mergeObject(base, supplied) {
  return { ...base, ...(supplied || {}) };
}

export function normalizeOptions(supplied = {}) {
  const position = supplied.position || DEFAULT_OPTIONS.position;

  if (!POSITIONS.has(position)) {
    throw new TypeError(`Unsupported recorder position: ${position}`);
  }

  const maxRecordingMs = Number(supplied.maxRecordingMs ?? DEFAULT_OPTIONS.maxRecordingMs);
  const maxSnapshots = Number(supplied.maxSnapshots ?? DEFAULT_OPTIONS.maxSnapshots);

  if (!Number.isFinite(maxRecordingMs) || maxRecordingMs <= 0) {
    throw new TypeError("maxRecordingMs must be a positive number.");
  }

  if (!Number.isInteger(maxSnapshots) || maxSnapshots < 1) {
    throw new TypeError("maxSnapshots must be a positive integer.");
  }

  return {
    ...DEFAULT_OPTIONS,
    ...supplied,
    position,
    maxRecordingMs,
    maxSnapshots,
    features: mergeObject(DEFAULT_OPTIONS.features, supplied.features),
    labels: mergeObject(DEFAULT_OPTIONS.labels, supplied.labels),
    theme: mergeObject(DEFAULT_OPTIONS.theme, supplied.theme),
    metadata: mergeObject(DEFAULT_OPTIONS.metadata, supplied.metadata),
    submission: mergeObject(DEFAULT_OPTIONS.submission, supplied.submission),
    callbacks: mergeObject(DEFAULT_OPTIONS.callbacks, supplied.callbacks)
  };
}

export function resolveTarget(target, documentObject = globalThis.document) {
  if (!documentObject) {
    throw new Error("Firsthand Recorder can only be mounted in a browser document.");
  }

  if (!target) {
    return null;
  }

  if (typeof target === "string") {
    const element = documentObject.querySelector(target);
    if (!element) {
      throw new Error(`Recorder target was not found: ${target}`);
    }
    return element;
  }

  if (typeof target.appendChild === "function") {
    return target;
  }

  throw new TypeError("target must be a CSS selector or DOM element.");
}

export function collectBrowserMetadata(windowObject = globalThis.window) {
  const navigatorObject = windowObject?.navigator;
  return {
    capturedAt: new Date().toISOString(),
    pageUrl: windowObject?.location?.href || "",
    pageTitle: windowObject?.document?.title || "",
    referrer: windowObject?.document?.referrer || "",
    userAgent: navigatorObject?.userAgent || "",
    language: navigatorObject?.language || "",
    viewport: {
      width: windowObject?.innerWidth || 0,
      height: windowObject?.innerHeight || 0,
      devicePixelRatio: windowObject?.devicePixelRatio || 1
    }
  };
}
