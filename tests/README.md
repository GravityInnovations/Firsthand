# Local integration tests

The `html` test is a framework-free dashboard that loads the recorder from the repository's local `recorder/dist` build. Its mock endpoint accepts the multipart request in memory and returns a test response; it does not upload or retain the recording.

From the repository root, run:

```bash
node tests/html/server.mjs
```

Then open [http://127.0.0.1:4174](http://127.0.0.1:4174).

Test the fixed recorder trigger and the dashboard's **Record a problem** button. The first click checks capture permissions and starts screen recording; the second stops it. Review the video, add a description, select **Prepare report**, inspect the mock transcoder result, and submit it. Editing the text or replacing the video makes the prepared result stale and requires preparation again.

The local `POST /api/prepare` route returns `html/transcoder-response.json`. This simulates the future transcoder without calling an external service.

Screen recording and microphone narration require browser permission. `localhost` is treated as a secure browser context for these APIs.
