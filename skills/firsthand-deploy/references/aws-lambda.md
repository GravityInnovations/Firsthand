# AWS Lambda packaging

Prepare transcoder and reporter as separate Lambda functions behind separate API Gateway routes. Generate files only under `dist/deployments/aws-lambda/`; do not deploy them. Use Linux-compatible dependency builds for native modules and binaries.

## Transcoder

The transcoder includes local Whisper/ONNX and ffmpeg. Confirm whether the user accepts Lambda cold starts, model download/cache behaviour, request size limits, and Lambda memory/timeout costs. A container-image Lambda is usually more practical than a zip deployment for these dependencies. Keep `TRANSFORMER_*` secrets in AWS Secrets Manager or Lambda environment encryption, never in the recorder.

## Reporter

Do not package the current SQLite mapping as ordinary Lambda local storage: Lambda filesystems are ephemeral and concurrent invocations do not share a database. Ask the user to choose one before generating assets:

- RDS/Aurora or another managed SQL database;
- DynamoDB with an equivalent issue/comment mapping design; or
- EFS for a low-scale transitional deployment.

Use S3/R2/HTTP storage for evidence, not host filesystem storage. Keep `GITHUB_*`, `REPORTER_CLIENT_*`, and storage credentials server-side. The reporter needs an externally reachable recording URL if that URL is included in GitHub issues.

## Before generating Lambda assets

Ask one item at a time: AWS region, API Gateway auth and CORS policy, target environment, persistent reporter datastore, evidence destination, and secret-manager choice. Generate IaC and deployment instructions with placeholder resource identifiers only. Never execute deployment commands.
