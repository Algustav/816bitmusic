import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const [, , inputPath, requestedCount, ...options] = process.argv;
const keepCount = Number.parseInt(requestedCount ?? "", 10);
const titleOptionIndex = options.indexOf("--title");
const replacementTitle = titleOptionIndex >= 0 ? options[titleOptionIndex + 1] : undefined;

if (!inputPath || !Number.isInteger(keepCount) || keepCount < 1 || keepCount > 255) {
  console.error("Usage: node tools/trim-nsfe.mjs <file.nsfe> <tracks-to-keep> [--title <title>]");
  process.exit(1);
}

if (titleOptionIndex >= 0 && !replacementTitle) {
  throw new Error("--title requires a non-empty value.");
}

const source = await readFile(inputPath);
if (source.subarray(0, 4).toString("ascii") !== "NSFE") {
  throw new Error(`${basename(inputPath)} is not an NSFe file.`);
}

const chunks = [];
let offset = 4;

while (offset + 8 <= source.length) {
  const size = source.readUInt32LE(offset);
  const id = source.subarray(offset + 4, offset + 8).toString("ascii");
  const dataStart = offset + 8;
  const dataEnd = dataStart + size;
  if (dataEnd > source.length) throw new Error(`Broken NSFe chunk: ${id}`);
  chunks.push({ id, data: Buffer.from(source.subarray(dataStart, dataEnd)) });
  offset = dataEnd;
  if (id === "NEND") break;
}

const info = chunks.find((chunk) => chunk.id === "INFO");
if (!info || info.data.length < 10) throw new Error("NSFe INFO chunk is missing or invalid.");

const originalTrackCount = info.data[8];
if (keepCount > originalTrackCount) {
  throw new Error(`Cannot keep ${keepCount} tracks; file only declares ${originalTrackCount}.`);
}

info.data[8] = keepCount;
if (info.data[9] >= keepCount) info.data[9] = 0;

for (const chunk of chunks) {
  if (chunk.id === "auth" && replacementTitle) {
    const fields = chunk.data.toString("utf8").split("\0");
    fields[0] = replacementTitle;
    const trailingNull = chunk.data.at(-1) === 0;
    const encoded = fields.join("\0");
    chunk.data = Buffer.from(trailingNull && !encoded.endsWith("\0") ? `${encoded}\0` : encoded, "utf8");
  } else if (chunk.id === "tlbl") {
    const labels = chunk.data.toString("utf8").split("\0").slice(0, keepCount);
    chunk.data = Buffer.from(`${labels.join("\0")}\0`, "utf8");
  } else if (chunk.id === "time" || chunk.id === "fade") {
    chunk.data = chunk.data.subarray(0, Math.min(chunk.data.length, keepCount * 4));
  } else if (chunk.id === "plst") {
    chunk.data = Buffer.from([...chunk.data].filter((track) => track < keepCount).slice(0, keepCount));
  }
}

const outputParts = [Buffer.from("NSFE", "ascii")];
for (const chunk of chunks) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(chunk.data.length, 0);
  header.write(chunk.id, 4, 4, "ascii");
  outputParts.push(header, chunk.data);
}

const output = Buffer.concat(outputParts);
const extension = extname(inputPath);
const stem = basename(inputPath, extension);
const backupPath = join(dirname(inputPath), `${stem}.before-trim${extension}`);
const tempPath = join(dirname(inputPath), `${stem}.trim-tmp${extension}`);

await copyFile(inputPath, backupPath);
await writeFile(tempPath, output);
await rename(tempPath, inputPath);

console.log(
  JSON.stringify(
    {
      file: inputPath,
      backup: backupPath,
      originalTrackCount,
      trackCount: keepCount,
      title: replacementTitle,
      originalBytes: source.length,
      bytes: output.length
    },
    null,
    2
  )
);
