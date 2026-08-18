# Firsthand

Firsthand is a lightweight, embeddable reporting system that turns user-recorded evidence into developer-ready GitHub issues and supports controlled two-way communication.

The recorder, transcoder, and reporter are independently deployable Node.js/browser components.

## Project structure

Firsthand is organised into three independently developed areas:

| Folder | Responsibility |
| --- | --- |
| [`recorder`](./recorder/) | Browser-side JavaScript and CSS for capturing screen recordings, microphone audio, screenshots, user notes, and page context. |
| [`transcoder`](./transcoder/) | Converts uploaded evidence into a structured, reviewable issue draft using a configurable transformation agent. |
| [`reporter`](./reporter/) | Stores evidence, maps system users to GitHub issues in SQLite, creates issues, and synchronises comments. |

Each area owns a clear boundary and should be usable without depending on its neighbours' internal implementation.

## Release artifacts

Run `npm run build:release` from the repository root to create independent artifacts in [`dist`](./dist/README.md): `dist/recorder`, `dist/transcoder`, `dist/reporter`, and the GitHub Pages-ready marketing site at `dist/github-pages`. Its public implementation guide is at `dist/github-pages/docs/`. Validate the generated layout with `npm run check:release`.

The reusable [`firsthand-deploy`](./skills/firsthand-deploy/SKILL.md) skill asks for packaging choices and creates deployment-ready artifacts under `dist`; it never deploys or publishes.

## Intended workflow

1. The recorder captures user evidence and sends it to the transcoder for preparation.
2. The transcoder returns structured issue details without storing or publishing the evidence.
3. The user reviews and edits the prepared report.
4. After confirmation, the recorder sends the report and evidence to the reporter.
5. The reporter stores the evidence and creates the GitHub issue using configured GitHub token or GitHub App credentials.
6. The reporter synchronises approved developer responses and user replies through its API.

## Guiding principles

- Keep the browser integration lightweight and framework-neutral.
- Keep credentials, GitHub operations, and AI-provider access out of browser code.
- Separate evidence capture, interpretation, and issue publication.
- Require an explicit review step before creating an issue.
- Keep storage, transformation, and issue destinations replaceable behind defined contracts.
- Allow the backend to be deployed independently from the applications using it.

## Status

The recorder's submission contract is documented in [`recorder/README.md`](./recorder/README.md). The transcoder's preparation API and provider configuration are documented in [`transcoder/README.md`](./transcoder/README.md). The independent issue and evidence API is documented in [`reporter/README.md`](./reporter/README.md).

## Licence

Firsthand is available under the [MIT License](./LICENSE).
