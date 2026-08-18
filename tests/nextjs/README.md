# Firsthand Next.js integration test

This is a separate Next.js application that consumes `@gravityinnovations/firsthand-recorder` through the repository-local npm package. It mirrors the framework-free dashboard test while exercising client-component mounting, App Router API routes, preparation callbacks, and submission callbacks.

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The application uses two local route handlers:

- `POST /api/prepare` returns the project's local mock prepared report from `data/transcoder-response.json`.
- `POST /api/reports` verifies that a prepared result is present and returns a mock receipt.

No recording or report is uploaded or retained externally.
