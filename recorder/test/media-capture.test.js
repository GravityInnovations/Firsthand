import test from "node:test";
import assert from "node:assert/strict";

import {
  checkCapturePermissions,
  combineStreams,
  createDisplayMediaOptions
} from "../src/media-capture.js";

test("display capture options prefer the current browser tab", () => {
  assert.deepEqual(createDisplayMediaOptions({
    audio: true,
    preferCurrentTab: true,
    displaySurface: "browser",
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    systemAudio: "include",
    windowAudio: "system"
  }), {
    video: { displaySurface: "browser" },
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    systemAudio: "include",
    windowAudio: "system"
  });
});

test("capture permissions are checked before every recording attempt", async () => {
  let permissionChecks = 0;
  const windowObject = {
    isSecureContext: true,
    navigator: {
      permissions: {
        query: async ({ name }) => {
          assert.equal(name, "microphone");
          permissionChecks += 1;
          return { state: "granted" };
        }
      },
      mediaDevices: {
        getDisplayMedia: async () => {},
        getUserMedia: async () => {}
      }
    }
  };

  assert.deepEqual(await checkCapturePermissions({ microphone: true }, windowObject), {
    display: "prompt",
    microphone: "granted"
  });
  assert.deepEqual(await checkCapturePermissions({ microphone: true }, windowObject), {
    display: "prompt",
    microphone: "granted"
  });
  assert.equal(permissionChecks, 2);
});

test("blocked microphone permission fails before display capture", async () => {
  await assert.rejects(
    () => checkCapturePermissions({ microphone: true }, {
      isSecureContext: true,
      navigator: {
        permissions: { query: async () => ({ state: "denied" }) },
        mediaDevices: {
          getDisplayMedia: async () => {},
          getUserMedia: async () => {}
        }
      }
    }),
    /Microphone permission is blocked/
  );
});

test("a single captured audio track is preserved without audio processing", async () => {
  const videoTrack = { kind: "video" };
  const audioTrack = { kind: "audio" };
  class MockMediaStream {
    constructor(tracks) { this.tracks = tracks; }
    getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
    getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
  }
  const displayStream = {
    getVideoTracks: () => [videoTrack],
    getAudioTracks: () => [audioTrack]
  };

  const combined = await combineStreams(displayStream, null, {
    MediaStream: MockMediaStream,
    AudioContext: class ShouldNotBeUsed {}
  });

  assert.deepEqual(combined.stream.getVideoTracks(), [videoTrack]);
  assert.deepEqual(combined.stream.getAudioTracks(), [audioTrack]);
});
