# Local integrations

The test applications exercise the same three boundaries used by a host application:

1. Recorder posts evidence to a host route.
2. The host route proxies preparation to transcoder.
3. After user review, the host route forwards the prepared report and original video to reporter.

The browser never receives OpenAI, GitHub, storage, or reporter-client secrets.

## HTML dashboard

Start reporter on `4200` with `REPORTER_CLIENT_ID`, `REPORTER_CLIENT_SECRET`, storage, and—only for live issue delivery—GitHub configuration. Start transcoder on `4100` for real preparation. Then start the dashboard with matching reporter client credentials:

```powershell
$env:REPORTER_CLIENT_ID = "local-test"
$env:REPORTER_CLIENT_SECRET = "your-local-secret"
node tests/html/server.mjs
```

Open [http://127.0.0.1:4174](http://127.0.0.1:4174). `POST /api/prepare` proxies to `TRANSCODER_URL` (default `http://127.0.0.1:4100/v1/prepare`); `POST /api/reports` proxies to `REPORTER_URL` (default `http://127.0.0.1:4200/v1/issues`). Set `USE_MOCK_TRANSCODER=1` to use the fixture without starting transcoder.

The dashboard uses `local-system-user-001` as its non-sensitive test user identifier. Recording requires browser permission and `localhost` or HTTPS.

## Next.js test

From `tests/nextjs`, install dependencies and start the app with host-only reporter credentials:

```powershell
$env:REPORTER_CLIENT_ID = "local-test"
$env:REPORTER_CLIENT_SECRET = "your-local-secret"
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The App Router routes follow the same defaults and environment variables as the HTML dashboard. Set `USE_MOCK_TRANSCODER=1` to use the local preparation fixture.

Live final submissions store evidence and create GitHub issues through reporter. Use a reporter instance with `GITHUB_ENABLED=false` when you only want to verify the request path without creating an issue.
