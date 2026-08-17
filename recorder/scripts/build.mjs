import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const recorderRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(recorderRoot, "src");
const outputDirectory = path.join(recorderRoot, "dist");
const moduleNames = [
  "options.js",
  "submission.js",
  "preparation.js",
  "media-capture.js",
  "index.js"
];

function convertModuleToClassicScript(source) {
  return source
    .replace(/^import .*?;\r?\n/gm, "")
    .replace(/^export \{.*?\} from .*?;\r?\n/gm, "")
    .replace(/^export default .*?;\r?\n/gm, "")
    .replace(/\bexport (async function|class|const|function)\b/g, "$1");
}

const sources = await Promise.all(
  moduleNames.map((name) => readFile(path.join(sourceDirectory, name), "utf8"))
);

const classicBundle = `/* Firsthand Recorder v0.1.0 | MIT License */
(function attachFirsthandRecorder(global) {
  "use strict";

${sources.map(convertModuleToClassicScript).join("\n")}

  global.FirsthandRecorder = Object.freeze({
    FirsthandRecorder,
    PreparationError,
    SubmissionError,
    buildFormData,
    collectBrowserMetadata,
    createRecorder,
    DEFAULT_OPTIONS,
    normalizeOptions,
    prepareReport,
    registerJQueryPlugin,
    submitReport
  });
})(globalThis);
`;

const esmEntry = `export * from "../src/index.js";\nexport { default } from "../src/index.js";\n`;

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, "firsthand-recorder.js"), classicBundle),
  writeFile(path.join(outputDirectory, "firsthand-recorder.esm.js"), esmEntry),
  copyFile(
    path.join(sourceDirectory, "styles.css"),
    path.join(outputDirectory, "firsthand-recorder.css")
  )
]);
