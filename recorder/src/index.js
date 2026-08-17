import { collectBrowserMetadata, normalizeOptions, resolveTarget } from "./options.js";
import { checkCapturePermissions, startScreenRecording } from "./media-capture.js";
import { prepareReport } from "./preparation.js";
import { submitReport } from "./submission.js";

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

function formatPreparedLabel(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function template() {
  return `
    <button class="fhr-trigger" type="button" data-fhr="trigger">
      <span class="fhr-trigger__icon" data-fhr="trigger-icon" aria-hidden="true">&#9679;</span>
      <span data-fhr="trigger-label"></span>
    </button>
    <div class="fhr-backdrop" data-fhr="backdrop" hidden>
      <section class="fhr-dialog" role="dialog" aria-modal="true" aria-labelledby="fhr-dialog-title">
        <header class="fhr-dialog__header">
          <div>
            <h2 class="fhr-dialog__title" id="fhr-dialog-title" data-fhr="dialog-title"></h2>
            <p class="fhr-dialog__description" data-fhr="dialog-description"></p>
          </div>
          <button class="fhr-icon-button" type="button" data-fhr="close" aria-label="Close">&times;</button>
        </header>

        <div class="fhr-dialog__body">
          <div class="fhr-review-column">

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

          <label class="fhr-field" data-fhr="description-field">
            <span class="fhr-field__label" data-fhr="description-label"></span>
            <textarea class="fhr-textarea" data-fhr="description" rows="5"></textarea>
          </label>

          <div class="fhr-status" data-fhr="status" role="status" aria-live="polite"></div>
          </div>

          <aside class="fhr-prepared-panel" aria-live="polite">
            <h3 class="fhr-prepared-panel__title" data-fhr="prepared-title"></h3>
            <div class="fhr-prepared-panel__content" data-fhr="prepared-content"></div>
          </aside>
        </div>

        <footer class="fhr-dialog__footer">
          <button class="fhr-secondary-button" type="button" data-fhr="prepare" hidden></button>
          <button class="fhr-primary-button" type="button" data-fhr="submit" disabled></button>
        </footer>
      </section>
    </div>
  `;
}

export class FirsthandRecorder {
  constructor(options = {}) {
    this.options = normalizeOptions(options);
    this.root = null;
    this.elements = {};
    this.report = { description: "", video: null, prepared: null, metadata: {} };
    this.recordingSession = null;
    this.urls = new Set();
    this.recordingTimer = null;
    this.recordingTimeout = null;
    this.isSubmitting = false;
    this.isPreparing = false;
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
      triggerIcon: find("trigger-icon"),
      triggerLabel: find("trigger-label"),
      backdrop: find("backdrop"),
      dialog: this.root.querySelector(".fhr-dialog"),
      dialogTitle: find("dialog-title"),
      dialogDescription: find("dialog-description"),
      close: find("close"),
      recording: find("recording"),
      liveVideo: find("live-video"),
      timer: find("timer"),
      stop: find("stop"),
      videoPreview: find("video-preview"),
      recordedVideo: find("recorded-video"),
      removeVideo: find("remove-video"),
      descriptionField: find("description-field"),
      descriptionLabel: find("description-label"),
      description: find("description"),
      status: find("status"),
      prepare: find("prepare"),
      preparedPanel: this.root.querySelector(".fhr-prepared-panel"),
      preparedTitle: find("prepared-title"),
      preparedContent: find("prepared-content"),
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
    this.elements.stop.textContent = labels.stop;
    this.elements.removeVideo.textContent = labels.remove;
    this.elements.descriptionLabel.textContent = labels.description;
    this.elements.description.placeholder = labels.descriptionPlaceholder;
    this.elements.prepare.textContent = labels.prepare;
    this.elements.preparedTitle.textContent = labels.preparedTitle;
    this.elements.preparedContent.textContent = labels.preparedEmpty;
    this.elements.submit.textContent = labels.submit;
    this.elements.close.setAttribute("aria-label", labels.close);

    this.elements.descriptionField.hidden = !features.description;
    this.elements.preparedPanel.hidden = !this.options.transcoder.endpoint;
    this.root.classList.toggle("fhr-root--has-transcoder", Boolean(this.options.transcoder.endpoint));
  }

  _bindEvents() {
    this.elements.trigger.addEventListener("click", () => {
      this._handleTriggerClick().catch(() => {});
    });
    this.elements.close.addEventListener("click", () => this.close());
    this.elements.backdrop.addEventListener("click", (event) => {
      if (event.target === this.elements.backdrop) {
        this.close();
      }
    });
    this.elements.stop.addEventListener("click", () => this.stopRecording());
    this.elements.removeVideo.addEventListener("click", () => this.removeVideo());
    this.elements.description.addEventListener("input", (event) => {
      this.report.description = event.target.value;
      this._invalidatePreparation();
      this._updateSubmitState();
    });
    this.elements.prepare.addEventListener("click", () => this.prepare().catch(() => {}));
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
    const hasContent = Boolean(this.report.description.trim() || this.report.video);
    const requiresPreparation = Boolean(this.options.transcoder.endpoint);
    const isPrepared = Boolean(this.report.prepared);

    this.elements.prepare.hidden = !requiresPreparation || isPrepared;
    this.elements.submit.hidden = requiresPreparation && !isPrepared;
    this.elements.prepare.disabled = !hasContent || this.isPreparing || Boolean(this.recordingSession);
    this.elements.submit.disabled = !hasContent || this.isSubmitting || Boolean(this.recordingSession);
  }

  _invalidatePreparation() {
    if (!this.report.prepared) {
      return;
    }
    this.report.prepared = null;
    this._renderPreparedResult(null);
    this._setStatus("Changes need to be prepared again.");
    this._emit("preparedChange", { prepared: null, stale: true });
  }

  _renderPreparedResult(prepared) {
    const container = this.elements.preparedContent;
    container.replaceChildren();

    if (!prepared || typeof prepared !== "object") {
      container.textContent = this.options.labels.preparedEmpty;
      return;
    }

    for (const [key, value] of Object.entries(prepared)) {
      if (value === null || value === undefined || key === "id" || key === "status") {
        continue;
      }
      const section = document.createElement("section");
      section.className = "fhr-prepared-field";
      const heading = document.createElement("h4");
      heading.textContent = formatPreparedLabel(key);
      const content = document.createElement(Array.isArray(value) ? "ul" : "div");

      if (Array.isArray(value)) {
        for (const item of value) {
          const listItem = document.createElement("li");
          listItem.textContent = typeof item === "object" ? JSON.stringify(item) : String(item);
          content.appendChild(listItem);
        }
      } else {
        content.textContent = typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value);
      }
      section.append(heading, content);
      container.appendChild(section);
    }
  }

  _updateRecordingState() {
    const isRecording = Boolean(this.recordingSession);
    const label = isRecording ? this.options.labels.stop : this.options.labels.trigger;
    this.root.classList.toggle("fhr-root--recording", isRecording);
    this.elements.triggerLabel.textContent = label;
    this.elements.trigger.setAttribute("aria-label", label);
  }

  async _handleTriggerClick() {
    await this.toggleRecording();
  }

  async toggleRecording() {
    if (!this.options.features.video) {
      this.open();
      return this;
    }
    if (this.recordingSession) {
      await this.stopRecording({ openPreview: true });
      return this;
    }
    await this.startRecording();
    return this;
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
      const permissions = await checkCapturePermissions({
        microphone: this.options.features.microphone
      });
      this._emit("permissionCheck", { permissions });
      const session = await startScreenRecording({
        microphone: this.options.features.microphone,
        systemAudio: this.options.features.systemAudio,
        capture: this.options.capture
      });
      this.recordingSession = session;
      this._updateRecordingState();
      this.elements.recording.hidden = false;
      this.elements.liveVideo.srcObject = session.stream;
      await this.elements.liveVideo.play().catch(() => {});
      this.elements.timer.textContent = "00:00";
      this._setStatus("");
      this._emit("captureStart", {
        type: "video",
        hasAudio: session.stream.getAudioTracks().length > 0,
        microphone: session.microphone,
        permissions
      });

      this.recordingTimer = globalThis.setInterval(() => {
        this.elements.timer.textContent = formatDuration(Date.now() - session.startedAt);
      }, 500);
      this.recordingTimeout = globalThis.setTimeout(
        () => this.stopRecording(),
        this.options.maxRecordingMs
      );
      session.completed.then(() => {
        if (this.recordingSession === session) {
          this.stopRecording({ openPreview: true });
        }
      }).catch(() => {});
      this._updateSubmitState();
      await this.close();
    } catch (error) {
      this._setStatus(error.message || "Unable to start recording.", "error");
      this._emit("captureError", { type: "video", error });
      this.open();
    }
  }

  async stopRecording({ openPreview = true } = {}) {
    const session = this.recordingSession;
    if (!session) {
      return;
    }

    this.recordingSession = null;
    this._updateRecordingState();
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
      this._invalidatePreparation();
      if (!recording.hasAudio) {
        this._setStatus(
          "The recording has no audio track. Allow microphone access and enable tab or system audio in the browser share dialog.",
          "error"
        );
      } else {
        this._setStatus("");
      }
      this._emit("captureStop", { type: "video", recording: this.report.video });
    } catch (error) {
      this._setStatus(error.message || "Unable to finish recording.", "error");
      this._emit("captureError", { type: "video", error });
    } finally {
      this._updateSubmitState();
      if (openPreview && this.root) {
        this.open();
      }
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
    this._invalidatePreparation();
    this._updateSubmitState();
  }

  getReport() {
    return {
      description: this.report.description,
      video: this.report.video,
      prepared: this.report.prepared,
      metadata: {
        ...collectBrowserMetadata(),
        ...this.options.metadata,
        evidence: {
          hasVideo: Boolean(this.report.video),
          hasAudio: Boolean(this.report.video?.hasAudio),
          recordingDurationMs: this.report.video?.durationMs || 0
        }
      }
    };
  }

  async prepare() {
    if (this.isPreparing || !this.options.transcoder.endpoint) {
      return;
    }

    const report = this.getReport();
    this.isPreparing = true;
    this.elements.prepare.textContent = this.options.labels.preparing;
    this._setStatus("");
    this._updateSubmitState();
    this._emit("prepareStart", { report });

    try {
      const result = await prepareReport(report, this.options);
      const prepared = result.body?.prepared || result.body;
      this.report.prepared = prepared;
      this._renderPreparedResult(prepared);
      this._setStatus(this.options.labels.prepareSuccess, "success");
      this._emit("prepareSuccess", { result, prepared, report });
      this._emit("preparedChange", { prepared, stale: false });
      return result;
    } catch (error) {
      this._setStatus(error.message || "Unable to prepare the developer report.", "error");
      this._emit("prepareError", { error, report });
      throw error;
    } finally {
      this.isPreparing = false;
      this.elements.prepare.textContent = this.options.labels.prepare;
      this._updateSubmitState();
    }
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
    this.report = { description: "", video: null, prepared: null, metadata: {} };
    this.elements.description.value = "";
    this._renderPreparedResult(null);
    this._setStatus("");
    this._updateSubmitState();
    return this;
  }

  async destroy() {
    if (this.recordingSession) {
      await this.stopRecording({ openPreview: false });
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

export function createRecorder(options = {}) {
  return new FirsthandRecorder(options).mount();
}

export function registerJQueryPlugin(jQueryObject = globalThis.jQuery) {
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

export { SubmissionError, buildFormData, submitReport } from "./submission.js";
export { PreparationError, prepareReport } from "./preparation.js";
export { collectBrowserMetadata, DEFAULT_OPTIONS, normalizeOptions } from "./options.js";
export default createRecorder;
