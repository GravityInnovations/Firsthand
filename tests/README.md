# Local integration tests

This directory contains two independent integrations:

- `html` loads the CDN/classic-script build in a framework-free dashboard.
- `nextjs` consumes the recorder through its npm/ESM package from a Next.js client component.

The `html` test is a framework-free dashboard that loads the recorder from the repository's local `recorder/dist` build. Its `POST /api/prepare` route proxies multipart evidence to the locally running transcoder and maps its response into the recorder's prepared-report contract. Final report submission remains an in-memory mock; it does not upload or retain the recording.

From two terminals, run:

```bash
cd transcoder
npm run dev
```

Then, from the repository root:

```bash
node tests/html/server.mjs
```

Then open [http://127.0.0.1:4174](http://127.0.0.1:4174).

Test the fixed recorder trigger and the dashboard's **Record a problem** button. The first click checks capture permissions and starts screen recording; the second stops it. Review the video, add a description, select **Prepare report**, inspect the local transcoder result, and submit it. Editing the text or replacing the video makes the prepared result stale and requires preparation again.

By default, preparation is proxied to `http://127.0.0.1:4100/v1/prepare`. Set `TRANSCODER_URL` to use a different local address. Set `USE_MOCK_TRANSCODER=1` only when you intentionally want the old fixture response from `html/transcoder-response.json`.

Screen recording and microphone narration require browser permission. `localhost` is treated as a secure browser context for these APIs.
## Recording storage

The local HTML submission endpoint forwards the captured video, prepared report, and test system-user identifier to the separate reporter's `POST /v1/issues`. Configure `REPORTER_CLIENT_ID` and `REPORTER_CLIENT_SECRET` on the reporter and this local test server. Configure GitHub delivery on the reporter; preparation remains usable without it.
