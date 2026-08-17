# Transcoder

The transcoder converts raw report evidence into a structured issue draft that a person can review before publication.

## Responsibilities

- Accept evidence metadata, transcripts, selected images, and user-provided text.
- Use configurable provider, model, instructions, and output-schema settings.
- Produce structured issue details such as title, summary, steps, expected behaviour, actual behaviour, environment, and uncertainties.
- Distinguish supplied evidence from model inference and avoid inventing missing facts.

## Boundary

The transcoder does not upload recordings, create GitHub issues, or manage conversations. It returns a draft to the reporter through a defined contract.

No AI provider or processing implementation has been selected yet.
