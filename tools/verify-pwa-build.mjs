import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const sourceAlbums = resolve(root, "FC_Music_Collection_1_NSFe");
const swPath = resolve(dist, "sw.js");

async function filesWithExtension(directory, extension) {
  return (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(extension));
}

async function requireFile(relativePath) {
  const file = resolve(dist, relativePath);
  const details = await stat(file);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Missing or empty PWA asset: ${relativePath}`);
  }
}

const sw = await readFile(swPath, "utf8");
const sourceNsfe = await filesWithExtension(sourceAlbums, ".nsfe");
const builtNsfe = await filesWithExtension(resolve(dist, "assets"), ".nsfe");
const precachedNsfe = sw.match(/\.nsfe/g)?.length ?? 0;

if (sourceNsfe.length !== builtNsfe.length || builtNsfe.length !== precachedNsfe) {
  throw new Error(
    `NSFe mismatch: source=${sourceNsfe.length}, built=${builtNsfe.length}, precached=${precachedNsfe}`
  );
}

const requiredFiles = [
  "index.html",
  "sw.js",
  "site.webmanifest",
  "audio/gme-realtime-worklet.js",
  "vendor/gme/gme-render-worker.js",
  "vendor/gme/Web-GME-Player.js",
  "vendor/gme/Web-GME-Player.wasm",
  "vendor/gme-realtime/realtime-gme.wasm",
  "mytools/todo-standalone/index.html",
  "icon-192.png",
  "icon-512.png",
  "icon-512-maskable.png"
];
await Promise.all(requiredFiles.map(requireFile));

const requiredManifestMarkers = [
  "site.webmanifest",
  "gme-realtime-worklet.js",
  "gme-render-worker.js",
  "Web-GME-Player.js",
  "Web-GME-Player.wasm",
  "realtime-gme.wasm",
  "mytools/todo-standalone/index.html",
  "silkscreen",
  "ibm-plex-mono",
  "icon-512-maskable.png"
];
for (const marker of requiredManifestMarkers) {
  if (!sw.includes(marker)) throw new Error(`Not precached: ${marker}`);
}

console.log(
  `PWA verification passed: ${precachedNsfe} NSFe albums and all required offline assets are precached.`
);
