import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "dist", "manifest.json"), "utf8"));
for (const name of ["recorder", "transcoder", "reporter"]) {
  await access(resolve(root, "dist", name, "package.json"));
  await access(resolve(root, "dist", name, "dist"));
}
if (!manifest.components?.recorder || !manifest.components?.transcoder || !manifest.components?.reporter) throw new Error("Release manifest is incomplete.");
console.log("Firsthand release layout is valid.");
