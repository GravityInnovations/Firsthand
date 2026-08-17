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

export async function combineStreams(displayStream, microphoneStream, windowObject) {
  const videoTracks = displayStream.getVideoTracks();
  const audioTracks = [
    ...displayStream.getAudioTracks(),
    ...(microphoneStream?.getAudioTracks() || [])
  ];

  if (audioTracks.length <= 1 || !windowObject.AudioContext) {
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

export function supportsScreenCapture(navigatorObject = globalThis.navigator) {
  return Boolean(
    navigatorObject?.mediaDevices?.getDisplayMedia &&
    globalThis.MediaRecorder
  );
}

export async function checkCapturePermissions(options = {}, windowObject = globalThis.window) {
  const navigatorObject = windowObject?.navigator;
  if (windowObject?.isSecureContext === false) {
    throw new Error("Screen and microphone capture require HTTPS or localhost.");
  }
  if (!navigatorObject?.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen recording is not supported by this browser.");
  }

  const result = { display: "prompt", microphone: options.microphone ? "unknown" : "disabled" };
  if (options.microphone) {
    if (!navigatorObject.mediaDevices.getUserMedia) {
      throw new Error("Microphone capture is not supported by this browser.");
    }
    try {
      const permission = await navigatorObject.permissions?.query?.({ name: "microphone" });
      if (permission?.state) {
        result.microphone = permission.state;
      }
    } catch {
      // Some browsers do not expose microphone state through the Permissions API.
    }
    if (result.microphone === "denied") {
      throw new Error("Microphone permission is blocked. Allow it in the browser's site settings and try again.");
    }
  }
  return result;
}

export function createDisplayMediaOptions(options = {}) {
  const displayOptions = {
    video: options.displaySurface
      ? { displaySurface: options.displaySurface }
      : true,
    audio: Boolean(options.audio)
  };

  for (const key of [
    "preferCurrentTab",
    "selfBrowserSurface",
    "surfaceSwitching",
    "systemAudio",
    "windowAudio"
  ]) {
    if (options[key] !== undefined) {
      displayOptions[key] = options[key];
    }
  }

  return displayOptions;
}

export async function startScreenRecording(options = {}, windowObject = globalThis.window) {
  const navigatorObject = windowObject?.navigator;
  const MediaRecorderClass = windowObject?.MediaRecorder;

  if (!navigatorObject?.mediaDevices?.getDisplayMedia || !MediaRecorderClass) {
    throw new Error("Screen recording is not supported by this browser.");
  }

  let displayStream = null;
  let microphoneStream = null;

  try {
    if (options.microphone) {
      microphoneStream = await navigatorObject.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }

    displayStream = await navigatorObject.mediaDevices.getDisplayMedia(
      createDisplayMediaOptions({
        ...options.capture,
        audio: options.systemAudio
      })
    );

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
          mimeType: recorder.mimeType || "video/webm",
          hasAudio: combined.stream.getAudioTracks().length > 0
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
      microphone: microphoneStream?.getAudioTracks?.()[0]
        ? {
            label: microphoneStream.getAudioTracks()[0].label,
            deviceId: microphoneStream.getAudioTracks()[0].getSettings?.().deviceId || "",
            muted: microphoneStream.getAudioTracks()[0].muted
          }
        : null,
      startedAt,
      completed,
      stop
    };
  } catch (error) {
    stopTracks(displayStream, microphoneStream);
    throw error;
  }
}
