# Firsthand Reporter

The reporter is an independent Node.js API: it receives a user-approved prepared report and original video, stores the video, creates a GitHub issue, and keeps the system-user-to-issue mapping in SQLite. It never calls the transcoder or an LLM.

## Run locally

```powershell
cd reporter
npm install
$env:REPORTER_CLIENT_ID = "local-test"
$env:REPORTER_CLIENT_SECRET = "use-a-long-random-secret"
$env:STORAGE_PROVIDERS = "host"
$env:STORAGE_HOST_ROOT_PATH = ".evidence"
$env:STORAGE_HOST_PUBLIC_BASE_URL = "http://127.0.0.1:4200/v1/evidence-files"
$env:GITHUB_ENABLED = "true"
$env:GITHUB_AUTH_MODE = "token"
$env:GITHUB_TOKEN = "your-fine-grained-token"
$env:GITHUB_OWNER = "GravityInnovations"
$env:GITHUB_REPOSITORY = "Firsthand"
npm run dev
```

Use a fine-grained GitHub token restricted to the selected repository with **Issues: read and write**. All environment variables are listed in [`.env.example`](./.env.example); do not put real values in that file or browser code.

`REPORTER_INITIAL_STATUS` and `REPORTER_INITIAL_STATUS_LABEL` control the host workflow value returned for new reports. Their defaults are `submitted` and `Developer review required`. This is distinct from GitHub's own `state`, which remains `open` until a developer closes the issue in GitHub.

## API

Every endpoint except `/health` needs HTTP Basic auth using `REPORTER_CLIENT_ID` and `REPORTER_CLIENT_SECRET`.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/issues` | Multipart `userIdentifier`, `prepared` JSON, `metadata` JSON, optional `video`; stores evidence and creates the issue. |
| `GET /v1/users/:userIdentifier/issues` | Returns issues belonging to that system user and application. |
| `GET /v1/issues/:reportId/comments?userIdentifier=...` | Refreshes and returns comments for that user's issue. |
| `POST /v1/issues/:reportId/comments` | Posts `{ "userIdentifier", "body" }` to the linked issue. |
| `GET /v1/evidence-files/*` | Local-host storage only; exposes a returned recording URL for development. |

Evidence destinations are independent and configurable through `STORAGE_PROVIDERS`: `host`, `ftp`, `s3`, `r2`, and `http`. Production host storage should be served through authenticated downloads or a controlled public URL.

New issue responses and user-scoped issue listings include both `workflowStatus` / `workflowStatusLabel` for the host experience and `state` for GitHub's issue state.

## Boundary

The browser calls the transcoder first for `POST /v1/prepare`. Only after the user reviews that returned report does it submit the report and original recording here. The reporter does not depend on the transcoder's source, runtime, or credentials.
