import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tar from "tar-fs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const chromiumEntry = fileURLToPath(import.meta.resolve("@sparticuz/chromium"));
const chromiumRoot = dirname(dirname(chromiumEntry));
const chromiumBin = resolve(chromiumRoot, "bin");
const publicDir = resolve(projectRoot, "public");
const archivePath = resolve(publicDir, "chromium-pack.tar");

await mkdir(publicDir, { recursive: true });
await pipeline(tar.pack(chromiumBin), createWriteStream(archivePath));

console.log("Chromium pack created in public/chromium-pack.tar");
