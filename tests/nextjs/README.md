# Firsthand Next.js integration test

This is a separate Next.js application that consumes `@gravityinnovations/firsthand-recorder` through the repository-local npm package. It mirrors the framework-free dashboard test while exercising client-component mounting, App Router API routes, preparation callbacks, and submission callbacks.

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The application uses two host-side route handlers. Browser code never receives reporter credentials.

- `POST /api/prepare` proxies multipart evidence to `TRANSCODER_URL` (default `http://127.0.0.1:4100/v1/prepare`). Set `USE_MOCK_TRANSCODER=1` for the local fixture.
- `POST /api/reports` forwards the reviewed report and video to `REPORTER_URL` (default `http://127.0.0.1:4200/v1/issues`) using server-only `REPORTER_CLIENT_ID` and `REPORTER_CLIENT_SECRET`.

Set the reporter credentials before `npm run dev`. A live final submission stores evidence and creates a GitHub issue through reporter; use the mock transcoder only when you want to avoid local transcription and report transformation.
