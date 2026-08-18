---
name: firsthand-deploy
description: Create Firsthand deployment-ready packages and infrastructure plans in dist without publishing or deploying. Use when preparing recorder, transcoder, or reporter delivery artifacts.
---

# Firsthand deployment packaging

Never deploy, publish, create cloud resources, alter DNS, or call a package registry. This skill asks the user for deployment choices, then creates deployment-ready files only under the root `dist` folder.

First determine the requested components and intended target. Keep the three boundaries independent:

- `recorder` is a browser/npm package and never contains AI, GitHub, storage, or application credentials.
- `transcoder` prepares reports and receives only its own transformer/transcription credentials.
- `reporter` stores evidence, owns GitHub credentials, and manages system-user issue mappings.

Ask one material question at a time. Start by confirming whether the user wants a package for **recorder**, **transcoder**, **reporter**, or a combination, then ask for the intended target platform and environment. Build the release layout with `npm run build:release` before generating target-specific files.

## Routing

- For recorder npm delivery, prepare `dist/recorder`; ask for registry, package name/version, and access level, then generate only the package metadata and publish instructions.
- For AWS Lambda transcoder or reporter, read [AWS Lambda packaging](references/aws-lambda.md) before generating IaC templates, environment-variable templates, and a deployment checklist under `dist/deployments/aws-lambda/`.
- For containers, prepare independent `dist/transcoder` and `dist/reporter` container assets; do not combine their environment variables.

## Secrets and generated output

Ask the user which secret manager or host environment they intend to use. Never request secrets in chat or put API keys, GitHub tokens, storage credentials, or reporter client secrets in source, package artifacts, or browser configuration. Generate placeholder names and setup instructions only.

## Verification

After packaging, run `npm run check:release`. Validate generated templates and manifests locally. Do not run deployment commands or create real GitHub issues.
