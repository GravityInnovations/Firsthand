import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "dist");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packages = ["recorder", "transcoder", "reporter"];

for (const name of packages) await rm(resolve(root, name, "dist"), { recursive: true, force: true });
for (const name of packages) execFileSync(npm, ["run", "build"], { cwd: resolve(root, name), stdio: "inherit", shell: process.platform === "win32" });
await mkdir(output, { recursive: true });

await Promise.all([
  ...packages.map((name) => rm(resolve(output, name), { recursive: true, force: true })),
  rm(resolve(output, "github-pages"), { recursive: true, force: true }),
  rm(resolve(output, "manifest.json"), { force: true })
]);

for (const name of packages) {
  const source = resolve(root, name);
  const destination = resolve(output, name);
  await mkdir(destination, { recursive: true });
  await cp(resolve(source, "dist"), resolve(destination, "dist"), { recursive: true });
  await cp(resolve(source, "package.json"), resolve(destination, "package.json"));
  for (const file of ["package-lock.json", "README.md", "LICENSE"]) {
    try { await cp(resolve(source, file), resolve(destination, file)); } catch { /* optional package artifact */ }
  }
}

await cp(resolve(root, "site"), resolve(output, "github-pages"), { recursive: true });

const manifest = {
  name: "Firsthand release",
  createdAt: new Date().toISOString(),
  components: Object.fromEntries(await Promise.all(packages.map(async (name) => {
    const metadata = JSON.parse(await readFile(resolve(root, name, "package.json"), "utf8"));
    return [name, { name: metadata.name, version: metadata.version, artifact: `${name}/` }];
  }))),
  githubPages: { artifact: "github-pages/", entrypoint: "github-pages/index.html" }
};
await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Firsthand release artifacts created in ${output}`);
