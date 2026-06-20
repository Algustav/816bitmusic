/* global createGMEmodule */

importScripts("./Web-GME-Player.js");

const SAMPLE_RATE = 44100;
const VOICE_NAMES = ["Square 1", "Square 2", "Triangle", "Noise", "DMC"];
let modulePromise;
let currentFileId = null;
let renderPcm;

async function getModule() {
  if (!modulePromise) {
    modulePromise = createGMEmodule({
      locateFile(path) {
        return new URL(path, self.location.href).href;
      },
      print() {},
      printErr(message) {
        console.warn("[GME]", message);
      }
    });
  }
  return modulePromise;
}

function monoFromStereoBytes(bytes) {
  const stereo = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const mono = new Int16Array(stereo.length / 2);
  for (let source = 0, target = 0; source < stereo.length; source += 2, target += 1) {
    mono[target] = stereo[source];
  }
  return mono;
}

function detectAudibleLength(channelSamples, sampleRate, fallbackFrames) {
  const threshold = 24;
  const paddingFrames = Math.round(sampleRate * 0.35);
  let lastAudibleFrame = -1;

  for (const samples of channelSamples) {
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      if (Math.abs(samples[index]) > threshold) {
        lastAudibleFrame = Math.max(lastAudibleFrame, index);
        break;
      }
    }
  }

  if (lastAudibleFrame < 0) return fallbackFrames;
  return Math.min(fallbackFrames, lastAudibleFrame + 1 + paddingFrames);
}

self.onmessage = async (event) => {
  const { fileData, fileId, track } = event.data;

  try {
    const gme = await getModule();
    const isDifferentFile = currentFileId !== fileId;
    if (isDifferentFile) {
      gme.FS.writeFile("/home/web_user/input", new Uint8Array(fileData));
      currentFileId = fileId;
    }

    gme.FS.writeFile("voices.txt", new TextEncoder().encode(VOICE_NAMES.join("\n")));
    renderPcm ??= gme.cwrap(
      "generatePCMfileAndReturnInfo",
      "string",
      ["number", "number", "boolean", "boolean", "boolean"]
    );

    const info = renderPcm(track, 100, isDifferentFile, true, false).split(", ");
    const metadataDurationMs = Number.parseInt(info[0], 10);
    const loopStartMs = Number.parseInt(info[1], 10);
    const rendered = {};

    for (const voiceName of VOICE_NAMES) {
      rendered[voiceName] = monoFromStereoBytes(gme.FS.readFile(`/${voiceName}.raw`));
    }

    rendered.Rest = monoFromStereoBytes(gme.FS.readFile("/theRest.raw"));

    const fallbackFrames = Math.max(...Object.values(rendered).map((samples) => samples.length));
    const audibleFrames = detectAudibleLength(
      VOICE_NAMES.map((name) => rendered[name]),
      SAMPLE_RATE,
      fallbackFrames
    );
    const durationWasEstimated = metadataDurationMs >= 150000 && audibleFrames === fallbackFrames;
    const channels = {};
    const transfer = [];

    for (const [name, samples] of Object.entries(rendered)) {
      const trimmed = samples.slice(0, audibleFrames);
      channels[name] = trimmed.buffer;
      transfer.push(trimmed.buffer);
    }

    const durationMs = Math.round((audibleFrames / SAMPLE_RATE) * 1000);

    self.postMessage(
      {
        type: "rendered",
        sampleRate: SAMPLE_RATE,
        durationMs,
        durationWasEstimated,
        loopStartMs,
        channels
      },
      transfer
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
