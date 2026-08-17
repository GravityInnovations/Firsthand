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

export function supportsScreenCapture(navigatorObject = globalThis.navigator) {
  return Boolean(
    navigatorObject?.mediaDevices?.getDisplayMedia &&
    globalThis.MediaRecorder
  );
}

export async function startScreenRecording(options = {}, windowObject = globalThis.window) {
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

export async function captureScreenSnapshot(windowObject = globalThis.window) {
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
