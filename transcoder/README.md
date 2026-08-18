# Firsthand Transcoder

The transcoder is an independent Node.js service that converts raw user evidence into a structured, editable developer report. It accepts recordings, optional microphone-only audio, written descriptions, and page metadata. It never creates GitHub issues or permanently stores uploaded media.

## Boundary

The service owns:

- multipart request validation;
- temporary audio extraction from video;
- local, open-source speech-to-text transcription;
- OpenAI report generation;
- validation of the structured report response.

The service does not own browser recording, GitHub authentication, issue creation, comment synchronisation, or the decision to publish a report. Its optional evidence endpoint stores recordings only in explicitly configured destinations.

## Run locally

Requirements:

- Node.js 20 or newer;
- an OpenAI API key for report generation.

```bash
npm install
npm run dev
```

The default address is `http://127.0.0.1:4100`. Check the service with:

```bash
curl http://127.0.0.1:4100/health
```

Copy `.env.example` into your preferred environment configuration mechanism. The service does not automatically load `.env` files; production secrets should be supplied by the host environment.

## Prepare a report

```http
POST /v1/prepare
Content-Type: multipart/form-data
```

Supported fields:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `description` | Text | Conditional | User's written explanation. |
| `metadata` | JSON text | No | Page, application, browser, and viewport context. |
| `language` | Text | No | BCP 47-style transcription language such as `en-US`. |
| `audio` | File | No | Preferred microphone-only audio. |
| `video` | File | Conditional | Recorder-compatible screen recording. |
| `recording` | File | Conditional | Alias for `video`. |

At least one of `description`, `audio`, or `video` is required. Only one audio file and one video file may be supplied. Media files are buffered for this initial server implementation and are limited by `MAX_MEDIA_BYTES`, which defaults to 50 MB per file.

Example:

```bash
curl http://127.0.0.1:4100/v1/prepare \
  -F "description=The save operation never finishes" \
  -F 'metadata={"application":"dashboard","pageUrl":"https://example.com/settings"}' \
  -F "video=@recording.webm;type=video/webm"
```

Response:

```json
{
  "requestId": "prep_778e1a9f-20e3-42c4-8bee-e92cc7fa8b2e",
  "status": "completed",
  "transcription": {
    "provider": "local",
    "language": "en-US",
    "text": "When I click save, the loading indicator never disappears."
  },
  "report": {
    "title": "Save operation remains in progress",
    "summary": "The settings page remains in a loading state after save.",
    "stepsToReproduce": ["Open settings", "Change a value", "Select Save"],
    "expectedBehaviour": "The change should be saved and confirmed.",
    "actualBehaviour": "The loading indicator never disappears.",
    "technicalContext": { "pageUrl": "https://example.com/settings" },
    "uncertainties": [],
    "suggestedLabels": ["bug", "needs-triage"]
  },
  "warnings": []
}
```

If transcription fails but a written description exists, preparation continues and returns a `TRANSCRIPTION_FAILED` warning. If there is no other textual evidence, the request fails rather than inventing a report.

## Transcription providers

For local open-source Whisper transcription:

```text
TRANSCRIPTION_PROVIDER=local
TRANSCRIPTION_MODEL=onnx-community/whisper-base
TRANSCRIPTION_CACHE_DIR=.transformers-cache
TRANSCRIPTION_CHUNK_LENGTH_SECONDS=30
```

The Transformers.js provider runs inside the Node process and sends no audio to an external transcription service. It downloads and caches the configured quantized Whisper base model on first use, so the first request is slower and requires network access. Later requests reuse the loaded pipeline. Long recordings are processed in overlapping 30-second chunks by default. Choose `onnx-community/whisper-small` only when accuracy matters more than download size, memory use, and CPU latency.

The service uses its bundled ffmpeg executable to normalise supplied microphone audio or video audio into temporary mono 16 kHz WAV data. Temporary files are deleted after extraction.

## Transformation providers

GPT-5.6 Luna turns the transcript, written description, and metadata into a developer report. It never receives the recording, extracted audio, or video. This is the configured production path; the `heuristic` fallback remains available when no OpenAI key has been set:

```text
TRANSFORMER_PROVIDER=openai
TRANSFORMER_API_KEY=your-server-side-key
TRANSFORMER_MODEL=gpt-5.6-luna
```

OpenAI is asked for JSON that is validated against the Firsthand prepared-report schema. The browser never sees the API key. `TRANSFORMER_INSTRUCTIONS` can supply additional server-side editorial guidance. `TRANSFORMER_BASE_URL` is optional for an OpenAI-compatible gateway endpoint.

## Boundary

`POST /v1/prepare` is the transcoder's only public workflow. It interprets uploaded evidence and returns a prepared report; it does not store recordings or publish GitHub issues. Send the reviewed report and original video to the independent [`reporter`](../reporter/README.md) API.

## Authentication and CORS

- `API_AUTH_TOKEN` enables bearer-token protection for `/v1/prepare`. `/health` remains public.
- `CORS_ORIGINS` accepts a comma-separated allowlist. It defaults to `*` for local development.
- A token embedded in public frontend JavaScript is not a secret. Production integrations should obtain short-lived or application-scoped authorization from a trusted backend.

## Commands

```bash
npm run dev
npm test
npm run typecheck
npm run build
npm run check
```

The application service and provider interfaces do not depend on Fastify. A future AWS Lambda handler can wrap the same application layer without changing transcription or transformation implementations.
