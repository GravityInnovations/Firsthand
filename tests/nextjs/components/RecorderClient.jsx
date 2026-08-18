"use client";

import { useEffect, useRef, useState } from "react";
import { createRecorder } from "@gravityinnovations/firsthand-recorder";

function formatEvent(name, value) {
  const detail = value ? `\n${JSON.stringify(value, null, 2)}` : "";
  return `[${new Date().toLocaleTimeString()}] ${name}${detail}`;
}

export function RecorderClient() {
  const recorderRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState(["Ready. Firsthand is mounted through the npm package."]);

  const addEvent = (name, value) => {
    setEvents((current) => [formatEvent(name, value), ...current].slice(0, 12));
  };

  useEffect(() => {
    const recorder = createRecorder({
      position: "bottom-right",
      maxRecordingMs: 60000,
      submission: { endpoint: "/api/reports" },
      transcoder: { endpoint: "/api/prepare" },
      metadata: { application: "firsthand-nextjs-test", framework: "nextjs" },
      labels: {
        trigger: "Record problem",
        dialogTitle: "Tell us what went wrong",
        dialogDescription: "Review the recording, describe the problem, then prepare the report.",
        prepare: "Prepare report"
      },
      theme: { primaryColor: "#6554e8", borderRadius: "12px" },
      callbacks: {
        onPermissionCheck: ({ permissions }) => addEvent("Permissions checked", permissions),
        onCaptureStart: ({ hasAudio, microphone }) => {
          setRecording(true);
          addEvent("Recording started", { hasAudio, microphone });
        },
        onCaptureStop: ({ recording: result }) => {
          setRecording(false);
          addEvent("Recording stopped", {
            bytes: result.blob.size,
            durationMs: result.durationMs,
            hasAudio: result.hasAudio
          });
        },
        onCaptureError: ({ error }) => {
          setRecording(false);
          addEvent("Capture failed", { message: error.message });
        },
        onPrepareSuccess: ({ prepared }) => addEvent("Report prepared", prepared),
        onSubmitSuccess: ({ result }) => addEvent("Report submitted", result.body)
      }
    });

    recorderRef.current = recorder;
    return () => {
      recorderRef.current = null;
      recorder.destroy();
    };
  }, []);

  return (
    <>
      <div className="heading">
        <div><p className="eyebrow">Next.js package integration</p><h1>Workspace overview</h1><p>A separate application consuming Firsthand through its ESM package.</p></div>
        <button className={recording ? "recordButton recording" : "recordButton"} type="button" onClick={() => recorderRef.current?.toggleRecording()}>
          {recording ? "Stop recording" : "Record a problem"}
        </button>
      </div>

      <section className="card testPanel">
        <div><h2>Recorder event output</h2><p>Permission, audio, preparation, and submission callbacks appear here.</p></div>
        <pre>{events.join("\n\n")}</pre>
      </section>
    </>
  );
}
