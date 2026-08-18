# Generated release artifacts

Run `npm run build:release` from the repository root. It creates independent deployable artifacts:

- `dist/recorder` — npm package artifact
- `dist/transcoder` — Node service artifact
- `dist/reporter` — Node service artifact

`manifest.json` is generated alongside them. Only this guide and `.gitkeep` are tracked; generated output is intentionally ignored.
