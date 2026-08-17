/* Firsthand Recorder v0.1.0 | MIT License */
(function attachFirsthandRecorder(global) {
  "use strict";

const POSITIONS = new Set([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
  "inline"
]);

const DEFAULT_OPTIONS = Object.freeze({
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

function normalizeOptions(supplied = {}) {
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

function resolveTarget(target, documentObject = globalThis.document) {
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

function collectBrowserMetadata(windowObject = globalThis.window) {
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

class SubmissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SubmissionError";
    this.status = details.status;
    this.response = details.response;
  }
}

function buildFormData(report, FormDataClass = globalThis.FormData) {
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

  for (const [index, snapshot] of (report.snapshots || []).entries()) {
    formData.append(
      "snapshots",
      snapshot.blob,
      snapshot.fileName || `snapshot-${index + 1}.png`
    );
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

async function submitReport(report, options, fetchImplementation = globalThis.fetch) {
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

function chooseMimeType(MediaRecorderClass) {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return candidates.find((candidate) => MediaRecorderClass.isTypeSupported?.(candidate)) || "";
}

function stopTracks(...streams) {
  for (const stream of streams) {
    for (const track of stream?.getTracks?.() || []) {
      track.stop();
    }
  }
}

async function combineStreams(displayStream, microphoneStream, windowObject) {
  const videoTracks = displayStream.getVideoTracks();
  const audioTracks = [
    ...displayStream.getAudioTracks(),
    ...(microphoneStream?.getAudioTracks() || [])
  ];

  if (!audioTracks.length || !windowObject.AudioContext) {
    return {
      stream: new windowObject.MediaStream([...videoTracks, ...audioTracks]),
      closeAudio: async () => {}
    };
  }

  const audioContext = new windowObject.AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  for (const track of audioTracks) {
    const source = audioContext.createMediaStreamSource(new windowObject.MediaStream([track]));
    source.connect(destination);
  }

  await audioContext.resume();

  return {
    stream: new windowObject.MediaStream([
      ...videoTracks,
      ...destination.stream.getAudioTracks()
    ]),
    closeAudio: () => audioContext.close()
  };
}

function supportsScreenCapture(navigatorObject = globalThis.navigator) {
  return Boolean(
    navigatorObject?.mediaDevices?.getDisplayMedia &&
    globalThis.MediaRecorder
  );
}

async function startScreenRecording(options = {}, windowObject = globalThis.window) {
  const navigatorObject = windowObject?.navigator;
  const MediaRecorderClass = windowObject?.MediaRecorder;

  if (!navigatorObject?.mediaDevices?.getDisplayMedia || !MediaRecorderClass) {
    throw new Error("Screen recording is not supported by this browser.");
  }

  const displayStream = await navigatorObject.mediaDevices.getDisplayMedia({
    video: true,
    audio: Boolean(options.systemAudio)
  });

  let microphoneStream = null;

  try {
    if (options.microphone) {
      microphoneStream = await navigatorObject.mediaDevices.getUserMedia({ audio: true });
    }

    const combined = await combineStreams(displayStream, microphoneStream, windowObject);
    const mimeType = chooseMimeType(MediaRecorderClass);
    const recorder = new MediaRecorderClass(combined.stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const startedAt = Date.now();
    let stopped = false;

    const completed = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          chunks.push(event.data);
        }
      });
      recorder.addEventListener("error", (event) => reject(event.error || new Error("Recording failed.")));
      recorder.addEventListener("stop", async () => {
        stopTracks(combined.stream, displayStream, microphoneStream);
        await combined.closeAudio();
        resolve({
          blob: new windowObject.Blob(chunks, { type: recorder.mimeType || "video/webm" }),
          durationMs: Date.now() - startedAt,
          mimeType: recorder.mimeType || "video/webm"
        });
      });
    });

    const stop = () => {
      if (!stopped && recorder.state !== "inactive") {
        stopped = true;
        recorder.stop();
      }
      return completed;
    };

    displayStream.getVideoTracks()[0]?.addEventListener("ended", stop, { once: true });
    recorder.start(1000);

    return {
      stream: combined.stream,
      startedAt,
      completed,
      stop
    };
  } catch (error) {
    stopTracks(displayStream, microphoneStream);
    throw error;
  }
}

async function captureScreenSnapshot(windowObject = globalThis.window) {
  const navigatorObject = windowObject?.navigator;

  if (!navigatorObject?.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture is not supported by this browser.");
  }

  const stream = await navigatorObject.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const video = windowObject.document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await video.play();

    if (!video.videoWidth || !video.videoHeight) {
      await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
    }

    const canvas = windowObject.document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Snapshot creation failed.")), "image/png");
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      mimeType: "image/png"
    };
  } finally {
    video.srcObject = null;
    stopTracks(stream);
  }
}


const INSTANCE_KEY = "firsthandRecorder";

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function makeFileName(prefix, extension) {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
}

function template() {
  return `
    <button class="fhr-trigger" type="button" data-fhr="trigger">
      <span class="fhr-trigger__icon" aria-hidden="true">●</span>
      <span data-fhr="trigger-label"></span>
    </button>
    <div class="fhr-backdrop" data-fhr="backdrop" hidden>
      <section class="fhr-dialog" role="dialog" aria-modal="true" aria-labelledby="fhr-dialog-title">
        <header class="fhr-dialog__header">
          <div>
            <h2 class="fhr-dialog__title" id="fhr-dialog-title" data-fhr="dialog-title"></h2>
            <p class="fhr-dialog__description" data-fhr="dialog-description"></p>
          </div>
          <button class="fhr-icon-button" type="button" data-fhr="close" aria-label="Close">×</button>
        </header>

        <div class="fhr-dialog__body">
          <div class="fhr-capture-actions" data-fhr="capture-actions">
            <button class="fhr-secondary-button" type="button" data-fhr="record">
              <span aria-hidden="true">●</span>
              <span data-fhr="record-label"></span>
            </button>
            <button class="fhr-secondary-button" type="button" data-fhr="snapshot">
              <span aria-hidden="true">▣</span>
              <span data-fhr="snapshot-label"></span>
            </button>
          </div>

          <div class="fhr-recording" data-fhr="recording" hidden>
            <video class="fhr-video" data-fhr="live-video" autoplay muted playsinline></video>
            <div class="fhr-recording__bar">
              <span><span class="fhr-recording__dot"></span> <span data-fhr="timer">00:00</span></span>
              <button class="fhr-danger-button" type="button" data-fhr="stop"></button>
            </div>
          </div>

          <div class="fhr-video-preview" data-fhr="video-preview" hidden>
            <video class="fhr-video" data-fhr="recorded-video" controls playsinline></video>
            <button class="fhr-text-button" type="button" data-fhr="remove-video"></button>
          </div>

          <div class="fhr-snapshots" data-fhr="snapshots" hidden>
            <div class="fhr-snapshots__grid" data-fhr="snapshot-grid"></div>
          </div>

          <label class="fhr-field" data-fhr="description-field">
            <span class="fhr-field__label" data-fhr="description-label"></span>
            <textarea class="fhr-textarea" data-fhr="description" rows="5"></textarea>
          </label>

          <div class="fhr-status" data-fhr="status" role="status" aria-live="polite"></div>
        </div>

        <footer class="fhr-dialog__footer">
          <button class="fhr-primary-button" type="button" data-fhr="submit" disabled></button>
        </footer>
      </section>
    </div>
  `;
}

class FirsthandRecorder {
  constructor(options = {}) {
    this.options = normalizeOptions(options);
    this.root = null;
    this.elements = {};
    this.report = { description: "", video: null, snapshots: [], metadata: {} };
    this.recordingSession = null;
    this.urls = new Set();
    this.recordingTimer = null;
    this.recordingTimeout = null;
    this.isSubmitting = false;
    this.isOpen = false;
    this._onKeyDown = (event) => {
      if (event.key === "Escape" && this.isOpen) {
        this.close();
      }
    };
  }

  mount() {
    if (this.root) {
      return this;
    }

    const documentObject = globalThis.document;
    if (!documentObject) {
      throw new Error("Firsthand Recorder can only be mounted in a browser document.");
    }

    const target = resolveTarget(this.options.target, documentObject);
    if (this.options.position === "inline" && !target) {
      throw new Error("An inline recorder requires a target element or selector.");
    }

    this.root = documentObject.createElement("div");
    this.root.className = [
      "fhr-root",
      `fhr-root--${this.options.position}`,
      this.options.className
    ].filter(Boolean).join(" ");
    this.root.innerHTML = template();
    this._cacheElements();
    this._applyConfiguration();
    this._bindEvents();

    (target || documentObject.body).appendChild(this.root);
    documentObject.addEventListener("keydown", this._onKeyDown);
    this._updateSubmitState();
    return this;
  }

  _cacheElements() {
    const find = (name) => this.root.querySelector(`[data-fhr="${name}"]`);
    this.elements = {
      trigger: find("trigger"),
      triggerLabel: find("trigger-label"),
      backdrop: find("backdrop"),
      dialog: this.root.querySelector(".fhr-dialog"),
      dialogTitle: find("dialog-title"),
      dialogDescription: find("dialog-description"),
      close: find("close"),
      record: find("record"),
      recordLabel: find("record-label"),
      snapshot: find("snapshot"),
      snapshotLabel: find("snapshot-label"),
      recording: find("recording"),
      liveVideo: find("live-video"),
      timer: find("timer"),
      stop: find("stop"),
      videoPreview: find("video-preview"),
      recordedVideo: find("recorded-video"),
      removeVideo: find("remove-video"),
      snapshots: find("snapshots"),
      snapshotGrid: find("snapshot-grid"),
      descriptionField: find("description-field"),
      descriptionLabel: find("description-label"),
      description: find("description"),
      status: find("status"),
      submit: find("submit")
    };
  }

  _applyConfiguration() {
    const { labels, features, theme } = this.options;
    const style = this.root.style;

    style.setProperty("--fhr-primary", theme.primaryColor);
    style.setProperty("--fhr-primary-text", theme.primaryTextColor);
    style.setProperty("--fhr-surface", theme.surfaceColor);
    style.setProperty("--fhr-text", theme.textColor);
    style.setProperty("--fhr-muted", theme.mutedColor);
    style.setProperty("--fhr-border", theme.borderColor);
    style.setProperty("--fhr-radius", theme.borderRadius);
    style.setProperty("--fhr-z-index", String(theme.zIndex));

    this.elements.triggerLabel.textContent = labels.trigger;
    this.elements.dialogTitle.textContent = labels.dialogTitle;
    this.elements.dialogDescription.textContent = labels.dialogDescription;
    this.elements.recordLabel.textContent = labels.record;
    this.elements.snapshotLabel.textContent = labels.snapshot;
    this.elements.stop.textContent = labels.stop;
    this.elements.removeVideo.textContent = labels.remove;
    this.elements.descriptionLabel.textContent = labels.description;
    this.elements.description.placeholder = labels.descriptionPlaceholder;
    this.elements.submit.textContent = labels.submit;
    this.elements.close.setAttribute("aria-label", labels.close);

    this.elements.record.hidden = !features.video;
    this.elements.snapshot.hidden = !features.snapshot;
    this.elements.descriptionField.hidden = !features.description;
  }

  _bindEvents() {
    this.elements.trigger.addEventListener("click", () => this.open());
    this.elements.close.addEventListener("click", () => this.close());
    this.elements.backdrop.addEventListener("click", (event) => {
      if (event.target === this.elements.backdrop) {
        this.close();
      }
    });
    this.elements.record.addEventListener("click", () => this.startRecording());
    this.elements.stop.addEventListener("click", () => this.stopRecording());
    this.elements.snapshot.addEventListener("click", () => this.takeSnapshot());
    this.elements.removeVideo.addEventListener("click", () => this.removeVideo());
    this.elements.description.addEventListener("input", (event) => {
      this.report.description = event.target.value;
      this._updateSubmitState();
    });
    this.elements.submit.addEventListener("click", () => this.submit().catch(() => {}));
  }

  _emit(name, detail = {}) {
    const callback = this.options.callbacks[`on${name[0].toUpperCase()}${name.slice(1)}`];
    if (typeof callback === "function") {
      try {
        callback(detail, this);
      } catch (error) {
        console.error("Firsthand Recorder callback failed.", error);
      }
    }

    this.root?.dispatchEvent(new CustomEvent(
      `firsthand:${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      { bubbles: true, detail }
    ));
  }

  _setStatus(message, kind = "") {
    this.elements.status.textContent = message || "";
    this.elements.status.dataset.kind = kind;
  }

  _updateSubmitState() {
    const hasContent = Boolean(
      this.report.description.trim() ||
      this.report.video ||
      this.report.snapshots.length
    );
    this.elements.submit.disabled = !hasContent || this.isSubmitting || Boolean(this.recordingSession);
  }

  open() {
    if (!this.root) {
      this.mount();
    }
    this.elements.backdrop.hidden = false;
    this.isOpen = true;
    this.elements.close.focus();
    this._emit("open");
    return this;
  }

  async close() {
    if (this.recordingSession) {
      await this.stopRecording();
    }
    this.elements.backdrop.hidden = true;
    this.isOpen = false;
    this.elements.trigger.focus();
    this._emit("close");
    return this;
  }

  async startRecording() {
    if (this.recordingSession) {
      return;
    }

    this._setStatus("Choose the screen, window, or tab you want to record.");

    try {
      const session = await startScreenRecording({
        microphone: this.options.features.microphone,
        systemAudio: this.options.features.systemAudio
      });
      this.recordingSession = session;
      this.elements.recording.hidden = false;
      this.elements.liveVideo.srcObject = session.stream;
      await this.elements.liveVideo.play().catch(() => {});
      this.elements.timer.textContent = "00:00";
      this._setStatus("");
      this._emit("captureStart", { type: "video" });

      this.recordingTimer = globalThis.setInterval(() => {
        this.elements.timer.textContent = formatDuration(Date.now() - session.startedAt);
      }, 500);
      this.recordingTimeout = globalThis.setTimeout(
        () => this.stopRecording(),
        this.options.maxRecordingMs
      );
      session.completed.then(() => {
        if (this.recordingSession === session) {
          this.stopRecording();
        }
      }).catch(() => {});
      this._updateSubmitState();
    } catch (error) {
      this._setStatus(error.message || "Unable to start recording.", "error");
      this._emit("captureError", { type: "video", error });
    }
  }

  async stopRecording() {
    const session = this.recordingSession;
    if (!session) {
      return;
    }

    this.recordingSession = null;
    globalThis.clearInterval(this.recordingTimer);
    globalThis.clearTimeout(this.recordingTimeout);
    this.elements.recording.hidden = true;
    this.elements.liveVideo.srcObject = null;

    try {
      const recording = await session.stop();
      this.removeVideo();
      this.report.video = {
        ...recording,
        fileName: makeFileName("recording", "webm")
      };
      const url = URL.createObjectURL(recording.blob);
      this.urls.add(url);
      this.elements.recordedVideo.src = url;
      this.elements.videoPreview.hidden = false;
      this._emit("captureStop", { type: "video", recording: this.report.video });
    } catch (error) {
      this._setStatus(error.message || "Unable to finish recording.", "error");
      this._emit("captureError", { type: "video", error });
    } finally {
      this._updateSubmitState();
    }
  }

  removeVideo() {
    const currentUrl = this.elements.recordedVideo?.src;
    if (currentUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentUrl);
      this.urls.delete(currentUrl);
    }
    if (this.elements.recordedVideo) {
      this.elements.recordedVideo.removeAttribute("src");
      this.elements.videoPreview.hidden = true;
    }
    this.report.video = null;
    this._updateSubmitState();
  }

  async takeSnapshot() {
    if (this.report.snapshots.length >= this.options.maxSnapshots) {
      this._setStatus(`You can attach up to ${this.options.maxSnapshots} snapshots.`, "error");
      return;
    }

    this._setStatus("Choose the screen, window, or tab you want to capture.");

    try {
      const snapshot = await captureScreenSnapshot();
      const item = {
        ...snapshot,
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        fileName: makeFileName("snapshot", "png")
      };
      this.report.snapshots.push(item);
      this._renderSnapshots();
      this._setStatus("");
      this._emit("snapshot", { snapshot: item });
    } catch (error) {
      this._setStatus(error.message || "Unable to capture a snapshot.", "error");
      this._emit("captureError", { type: "snapshot", error });
    } finally {
      this._updateSubmitState();
    }
  }

  _renderSnapshots() {
    this.elements.snapshotGrid.replaceChildren();
    this.elements.snapshots.hidden = this.report.snapshots.length === 0;

    for (const snapshot of this.report.snapshots) {
      const figure = document.createElement("figure");
      figure.className = "fhr-snapshot";
      const image = document.createElement("img");
      if (!snapshot.previewUrl) {
        snapshot.previewUrl = URL.createObjectURL(snapshot.blob);
        this.urls.add(snapshot.previewUrl);
      }
      image.src = snapshot.previewUrl;
      image.alt = "Captured screen snapshot";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "fhr-snapshot__remove";
      remove.setAttribute("aria-label", this.options.labels.remove);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        URL.revokeObjectURL(snapshot.previewUrl);
        this.urls.delete(snapshot.previewUrl);
        this.report.snapshots = this.report.snapshots.filter((item) => item.id !== snapshot.id);
        this._renderSnapshots();
        this._updateSubmitState();
      });
      figure.append(image, remove);
      this.elements.snapshotGrid.appendChild(figure);
    }
  }

  getReport() {
    return {
      description: this.report.description,
      video: this.report.video,
      snapshots: [...this.report.snapshots],
      metadata: {
        ...collectBrowserMetadata(),
        ...this.options.metadata,
        evidence: {
          hasVideo: Boolean(this.report.video),
          snapshotCount: this.report.snapshots.length,
          recordingDurationMs: this.report.video?.durationMs || 0
        }
      }
    };
  }

  async submit() {
    if (this.isSubmitting) {
      return;
    }

    const report = this.getReport();
    this.isSubmitting = true;
    this.elements.submit.textContent = this.options.labels.submitting;
    this._setStatus("");
    this._updateSubmitState();
    this._emit("submitStart", { report });

    try {
      const result = await submitReport(report, this.options);
      this._setStatus(this.options.labels.success, "success");
      this._emit("submitSuccess", { result, report });
      this._emit("response", { result, report });
      if (this.options.closeOnSuccess) {
        await this.close();
      }
      return result;
    } catch (error) {
      this._setStatus(error.message || "Unable to submit the report.", "error");
      this._emit("submitError", { error, report });
      throw error;
    } finally {
      this.isSubmitting = false;
      this.elements.submit.textContent = this.options.labels.submit;
      this._updateSubmitState();
    }
  }

  reset() {
    this.removeVideo();
    for (const url of this.urls) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.report = { description: "", video: null, snapshots: [], metadata: {} };
    this.elements.description.value = "";
    this._renderSnapshots();
    this._setStatus("");
    this._updateSubmitState();
    return this;
  }

  async destroy() {
    if (this.recordingSession) {
      await this.stopRecording();
    }
    globalThis.document?.removeEventListener("keydown", this._onKeyDown);
    for (const url of this.urls) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.root?.remove();
    this.root = null;
  }
}

function createRecorder(options = {}) {
  return new FirsthandRecorder(options).mount();
}

function registerJQueryPlugin(jQueryObject = globalThis.jQuery) {
  if (!jQueryObject?.fn || jQueryObject.fn.firsthandRecorder) {
    return false;
  }

  jQueryObject.fn.firsthandRecorder = function firsthandRecorder(optionsOrMethod, ...args) {
    this.each(function initialiseOrInvoke() {
      let instance = jQueryObject.data(this, INSTANCE_KEY);

      if (typeof optionsOrMethod === "string") {
        if (!instance || typeof instance[optionsOrMethod] !== "function") {
          throw new Error(`Unknown Firsthand Recorder method: ${optionsOrMethod}`);
        }
        instance[optionsOrMethod](...args);
        return;
      }

      if (!instance) {
        instance = createRecorder({
          ...(optionsOrMethod || {}),
          position: optionsOrMethod?.position || "inline",
          target: this
        });
        jQueryObject.data(this, INSTANCE_KEY, instance);
      }
    });

    return this;
  };

  return true;
}

if (typeof globalThis.window !== "undefined" && globalThis.window.jQuery) {
  registerJQueryPlugin(globalThis.window.jQuery);
}



  global.FirsthandRecorder = Object.freeze({
    FirsthandRecorder,
    SubmissionError,
    buildFormData,
    collectBrowserMetadata,
    createRecorder,
    DEFAULT_OPTIONS,
    normalizeOptions,
    registerJQueryPlugin,
    submitReport
  });
})(globalThis);
