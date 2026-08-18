---
name: firsthand-deploy
description: Package and deploy Firsthand recorder, transcoder, and reporter components, including npm distribution and AWS Lambda options. Use when configuring Firsthand delivery or deployment.
---

# Firsthand deployment

First determine the requested components and deployment target. Keep the three boundaries independent:

- `recorder` is a browser/npm package and never contains AI, GitHub, storage, or application credentials.
- `transcoder` prepares reports and receives only its own transformer/transcription credentials.
- `reporter` stores evidence, owns GitHub credentials, and manages system-user issue mappings.

Ask one material question at a time. Start by confirming whether the user wants to deploy **recorder**, **transcoder**, **reporter**, or a combination, then ask for target platform and environment. Build the release layout with `npm run build:release` before packaging or deployment.

## Routing

- For recorder npm publishing, package `dist/recorder`; confirm registry, package name/version, access level, and whether publishing is authorised.
- For AWS Lambda transcoder or reporter, read [AWS Lambda deployment](references/aws-lambda.md) before proposing infrastructure or requesting credentials.
- For containers, deploy `dist/transcoder` and `dist/reporter` independently; do not combine their environment variables.

## Secrets and external writes

Ask the user to set secrets in the host, CI, or secret manager. Never put API keys, GitHub tokens, storage credentials, or reporter client secrets in source, package artifacts, or browser configuration. Before publishing, deploying, creating cloud resources, changing DNS, or writing repository secrets, state the exact target and request confirmation.

## Verification

After packaging, run `npm run check:release`. For deployed services, verify `/health` and then use a non-publishing prepared-report or reporter route check where possible. Creating real GitHub issues requires explicit user approval.
