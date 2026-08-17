# Reporter

The reporter is Firsthand's backend and integration boundary. It coordinates report submission, processing, publication, and conversation synchronisation.

## Responsibilities

- Provide the public report, upload, draft, publication, status, and comment APIs.
- Coordinate private evidence storage without routing large video files through the application API.
- Request structured drafts from the transcoder.
- Create GitHub issues through a GitHub App after explicit confirmation.
- Receive GitHub webhooks and synchronise permitted status and comment changes.
- Post clearly attributed user replies back to the corresponding GitHub issue.

## Boundary

The reporter does not implement browser recording or decide how evidence is interpreted. Those responsibilities belong to the recorder and transcoder respectively.

The initial backend is expected to use Node.js, while its public contracts should remain implementation-neutral.
