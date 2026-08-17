# Firsthand Recorder

Firsthand Recorder is a lightweight, framework-neutral browser widget for collecting a problem description and a narrated screen recording.

It is independent of any particular backend. The host application supplies a submission endpoint and handles the response through callbacks or DOM events.

## Supported integrations

- A CDN-ready JavaScript global and CSS file
- An npm package for Next.js and other bundlers
- An optional jQuery plugin adapter
- Fixed placement in any corner or inline placement inside an existing element

Screen recording requires a secure browser context (`https://` or `localhost`) and explicit user permission.

## Build locally

```bash
npm install
npm run build
```

The build creates:

```text
dist/
  firsthand-recorder.js       # CDN/IIFE build
  firsthand-recorder.esm.js   # ES module entry for npm and bundlers
  firsthand-recorder.css      # Styles
```

## CDN usage

Publish the contents of `dist` to a CDN, then load the stylesheet and global build:

```html
<link rel="stylesheet" href="https://cdn.example.com/firsthand-recorder.css">
<script src="https://cdn.example.com/firsthand-recorder.js"></script>

<script>
  const recorder = FirsthandRecorder.createRecorder({
    position: "bottom-right",
    submission: {
      endpoint: "https://api.example.com/reports"
    },
    callbacks: {
      onSubmitSuccess({ result, report }) {
        console.log("Created report", result.body, report);
      },
      onSubmitError({ error }) {
        console.error("Submission failed", error);
      }
    }
  });
</script>
```

## npm and Next.js usage

Install the package after it has been published:

```bash
npm install @gravityinnovations/firsthand-recorder
```

Import the stylesheet from a global stylesheet entry or layout:

```js
import "@gravityinnovations/firsthand-recorder/styles.css";
```

Mount the recorder from a client component:

```jsx
"use client";

import { useEffect } from "react";
import { createRecorder } from "@gravityinnovations/firsthand-recorder";

export function ProblemReporter() {
  useEffect(() => {
    const recorder = createRecorder({
      position: "bottom-right",
      submission: {
        endpoint: "/api/reports",
        headers: async () => ({
          Authorization: `Bearer ${await getShortLivedReportToken()}`
        })
      },
      metadata: {
        application: "customer-portal"
      }
    });

    return () => recorder.destroy();
  }, []);

  return null;
}
```

The package is safe to import during server rendering, but it must be mounted in a browser client component because recording depends on browser APIs.

## Inline placement

```html
<div id="support-actions"></div>

<script>
  FirsthandRecorder.createRecorder({
    position: "inline",
    target: "#support-actions",
    submission: {
      endpoint: "/api/reports"
    }
  });
</script>
```

Valid positions are:

- `bottom-right`
- `bottom-left`
- `top-right`
- `top-left`
- `inline`

## jQuery usage

When jQuery exists before the CDN script loads, the adapter registers automatically:

```html
<div id="support-actions"></div>

<script>
  $("#support-actions").firsthandRecorder({
    submission: {
      endpoint: "/api/reports"
    }
  });

  $("#support-actions").firsthandRecorder("open");
</script>
```

For module usage, call `registerJQueryPlugin($)` explicitly.

## Configuration

```js
createRecorder({
  position: "bottom-right",
  target: null,
  className: "my-recorder",
  closeOnSuccess: false,
  maxRecordingMs: 120000,

  features: {
    video: true,
    description: true,
    microphone: true,
    systemAudio: true
  },

  capture: {
    preferCurrentTab: true,
    displaySurface: "browser",
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    systemAudio: "include",
    windowAudio: "system"
  },

  labels: {
    trigger: "Report a problem",
    dialogTitle: "Report a problem",
    prepare: "Prepare report",
    submit: "Submit report"
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

  metadata: {
    application: "customer-portal",
    release: "2026.08"
  },

  submission: {
    endpoint: "/api/reports",
    method: "POST",
    credentials: "same-origin",
    headers: {}
  },

  transcoder: {
    endpoint: "/api/prepare",
    method: "POST",
    credentials: "same-origin",
    headers: {}
  },

  callbacks: {
    onOpen() {},
    onClose() {},
    onPermissionCheck({ permissions }) {},
    onCaptureStart({ type, hasAudio, microphone, permissions }) {},
    onCaptureStop({ type, recording }) {},
    onCaptureError({ type, error }) {},
    onPrepareStart({ report }) {},
    onPrepareSuccess({ result, prepared, report }) {},
    onPrepareError({ error, report }) {},
    onPreparedChange({ prepared, stale }) {},
    onSubmitStart({ report }) {},
    onSubmitSuccess({ result, report }) {},
    onSubmitError({ error, report }) {},
    onResponse({ result, report }) {}
  }
});
```

`submission.headers` and `transcoder.headers` may be objects or asynchronous functions. A function is useful for obtaining a short-lived host-issued token immediately before a request. Never place permanent API, storage, or GitHub credentials in browser configuration.

The generated elements use `fhr-` prefixed class names. Supply `className` for an additional root class and override the distributed CSS when deeper customisation is needed.

## Recording flow

The initial trigger checks microphone and capture support on every attempt, then starts capture directly. A blocked microphone permission produces an actionable error before the display chooser opens. After the user selects a source, recording continues in the background and the trigger changes to **Stop recording**. Selecting it stops capture and opens the dialog with a playable video preview.

The default capture settings ask compatible browsers to prefer the current browser tab and keep it available in the chooser. These values are browser hints rather than enforced selections. The [Screen Capture specification](https://www.w3.org/TR/screen-capture/#dom-mediadevices-getdisplaymedia) requires the browser to let the user choose a display surface for every capture, so a web page cannot bypass the chooser or silently select the current tab. Browsers that do not support a hint ignore it.

For narration, the user must allow microphone permission. To capture tab or system sound as well, the user must also enable the browser's audio-sharing option in the native chooser when it is offered.

## Preparation contract

When `transcoder.endpoint` is configured, submission is gated behind a preparation step. The recorder posts the current multipart report to that endpoint and displays its JSON response in the dialog's right column. The button text defaults to **Prepare report** and is configurable with `labels.prepare`.

The endpoint may return the prepared fields directly or wrap them in a `prepared` property. Editing the description, removing the video, or replacing the video invalidates the prepared result. **Submit report** is hidden until the latest evidence has been prepared again.

## Submission contract

The recorder sends one `multipart/form-data` request to `submission.endpoint`. The browser sets the multipart boundary, so the host must not configure the `Content-Type` header manually.

| Field | Type | Description |
| --- | --- | --- |
| `description` | text | The problem description entered by the user. |
| `metadata` | JSON text | Page, browser, viewport, configured metadata, and evidence summary. |
| `video` | file | Optional WebM screen recording with narration. |
| `prepared` | JSON text | Optional prepared developer report returned by the transcoder. |

Example parsed metadata:

```json
{
  "capturedAt": "2026-08-17T12:00:00.000Z",
  "pageUrl": "https://example.com/account",
  "pageTitle": "Account",
  "userAgent": "...",
  "language": "en-GB",
  "viewport": {
    "width": 1440,
    "height": 900,
    "devicePixelRatio": 1
  },
  "application": "customer-portal",
  "evidence": {
    "hasVideo": true,
    "hasAudio": true,
    "recordingDurationMs": 18420
  }
}
```

The endpoint may return JSON or text. A successful response is exposed as:

```js
{
  status: 201,
  body: {
    reportId: "rpt_123",
    status: "received"
  },
  response: Response
}
```

Non-2xx responses produce a `SubmissionError` containing `status` and the parsed response body.

## DOM events

Callbacks have matching bubbling DOM events on the recorder root:

```text
firsthand:open
firsthand:close
firsthand:permission-check
firsthand:capture-start
firsthand:capture-stop
firsthand:capture-error
firsthand:prepare-start
firsthand:prepare-success
firsthand:prepare-error
firsthand:prepared-change
firsthand:submit-start
firsthand:submit-success
firsthand:submit-error
firsthand:response
```

```js
document.addEventListener("firsthand:response", (event) => {
  console.log(event.detail.result.body);
});
```

## Instance API

`createRecorder()` returns an instance with these public methods:

- `open()`
- `close()`
- `startRecording()`
- `stopRecording()`
- `toggleRecording()`
- `prepare()`
- `getReport()`
- `submit()`
- `reset()`
- `destroy()`

## Browser behaviour

- The browser always asks the user what screen, window, or tab to share.
- Screen capture cannot begin automatically.
- Microphone and system-audio support varies by browser and operating system.
- The host endpoint must decide its own authentication, file-size, retention, privacy, and abuse controls.

## Licence

MIT
