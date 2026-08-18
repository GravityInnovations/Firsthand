# Generated release artifacts

Run `npm run build:release` from the repository root. It creates independent deployment-ready artifacts:

- `dist/recorder` — npm package artifact
- `dist/transcoder` — Node service artifact
- `dist/reporter` — Node service artifact
- `dist/github-pages` — static Firsthand marketing site ready for GitHub Pages

`manifest.json` is generated alongside them. These are local packaging artifacts only: this command never publishes or deploys. Only this guide and `.gitkeep` are tracked; generated output is intentionally ignored.
