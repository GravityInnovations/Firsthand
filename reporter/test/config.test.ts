import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config.js";

describe("reporter configuration", () => {
  it("keeps storage and GitHub configuration inside the reporter", () => {
    const config = loadConfig({
      REPORTER_CLIENT_ID: "test-client", REPORTER_CLIENT_SECRET: "test-secret",
      STORAGE_PROVIDERS: "host", STORAGE_HOST_ROOT_PATH: ".evidence", STORAGE_HOST_PUBLIC_BASE_URL: "http://localhost/evidence",
      GITHUB_ENABLED: "true", GITHUB_AUTH_MODE: "token", GITHUB_TOKEN: "token", GITHUB_OWNER: "GravityInnovations", GITHUB_REPOSITORY: "Firsthand"
    });
    assert.equal(config.port, 4200);
    assert.deepEqual(config.storage.providers, ["host"]);
    assert.equal(config.github.repository, "Firsthand");
    assert.equal(config.reporter.initialStatus, "submitted");
    assert.equal(config.reporter.initialStatusLabel, "Developer review required");
  });
});
