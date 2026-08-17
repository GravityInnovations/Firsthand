# Firsthand

Firsthand is a lightweight, embeddable reporting system that turns user-recorded evidence into developer-ready GitHub issues and supports controlled two-way communication.

The project is at an early MVP stage. The recorder has an initial browser implementation; the transcoder and reporter remain at the boundary-definition stage.

## Project structure

Firsthand is organised into three independently developed areas:

| Folder | Responsibility |
| --- | --- |
| [`recorder`](./recorder/) | Browser-side JavaScript and CSS for capturing screen recordings, microphone audio, screenshots, user notes, and page context. |
| [`transcoder`](./transcoder/) | Converts uploaded evidence into a structured, reviewable issue draft using a configurable transformation agent. |
| [`reporter`](./reporter/) | Provides the backend API, evidence storage orchestration, GitHub App integration, webhooks, issue publication, and conversation synchronisation. |

Each area owns a clear boundary and should be usable without depending on its neighbours' internal implementation.

## Intended workflow

1. The recorder captures user evidence and uploads it through the reporter API.
2. The reporter stores the evidence and asks the transcoder to prepare an issue draft.
3. The transcoder returns structured issue details without publishing anything.
4. After confirmation, the reporter creates the GitHub issue through a GitHub App.
5. The reporter synchronises approved developer responses and user replies through its API.

## Guiding principles

- Keep the browser integration lightweight and framework-neutral.
- Keep credentials, GitHub operations, and AI-provider access out of browser code.
- Separate evidence capture, interpretation, and issue publication.
- Require an explicit review step before creating an issue.
- Keep storage, transformation, and issue destinations replaceable behind defined contracts.
- Allow the backend to be deployed independently from the applications using it.

## Status

The recorder's initial submission contract is documented in [`recorder/README.md`](./recorder/README.md). The transcoder and reporter contracts will be defined independently as those components are developed.

## Licence

Firsthand is available under the [MIT License](./LICENSE).
