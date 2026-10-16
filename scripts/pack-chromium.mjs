import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const chromiumEntry = fileURLToPath(import.meta.resolve("@sparticuz/chromium"));
const chromiumRoot = dirname(dirname(chromiumEntry));
const chromiumBin = resolve(chromiumRoot, "bin");
const publicDir = resolve(projectRoot, "public");
const archivePath = resolve(publicDir, "chromium-pack.tar");

await mkdir(publicDir, { recursive: true });
execFileSync("tar", ["-cf", archivePath, "-C", chromiumBin, "."], {
  stdio: "inherit",
});

console.log("Chromium pack created in public/chromium-pack.tar");
