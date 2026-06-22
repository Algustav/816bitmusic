/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precache,
  precacheAndRoute,
  type PrecacheEntry
} from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

const manifest = self.__WB_MANIFEST;
const htmlEntries = manifest.filter((entry) => {
  const url = typeof entry === "string" ? entry : entry.url;
  return url.endsWith(".html");
});
const assetEntries = manifest.filter((entry) => !htmlEntries.includes(entry));

precache(htmlEntries);
precacheAndRoute(assetEntries, {
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/]
});
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

const cacheableResponse = new CacheableResponsePlugin({ statuses: [200] });
const PAGE_CACHE = "8plus16bit-pages-v2";
const STATIC_CACHE = "8plus16bit-static-v2";
const AUDIO_CACHE = "8plus16bit-audio-runtime-v2";
const CURRENT_RUNTIME_CACHES = new Set([PAGE_CACHE, STATIC_CACHE, AUDIO_CACHE]);

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("8plus16bit-") && !CURRENT_RUNTIME_CACHES.has(name))
          .map((name) => caches.delete(name))
      )
    )
  );
});

const pages = new NetworkFirst({
  cacheName: PAGE_CACHE,
  networkTimeoutSeconds: 4,
  plugins: [cacheableResponse]
});

registerRoute(
  ({ request }) => request.mode === "navigate",
  async (options) => {
    try {
      return await pages.handle(options);
    } catch {
      const pathname = new URL(options.request.url).pathname;
      const fallback =
        pathname.startsWith("/mytools/todo-standalone/")
          ? "/mytools/todo-standalone/index.html"
          : "/index.html";
      return (await matchPrecache(fallback)) ?? Response.error();
    }
  }
);

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    /\.(?:nsfe|wasm|woff2?|png|svg|ico)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: STATIC_CACHE,
    plugins: [
      cacheableResponse,
      new ExpirationPlugin({
        maxEntries: 160,
        purgeOnQuotaError: true
      })
    ]
  })
);

registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    (url.pathname.endsWith("/gme-render-worker.js") ||
      url.pathname.endsWith("/gme-realtime-worklet.js") ||
      url.pathname.endsWith("/Web-GME-Player.js")),
  new CacheFirst({
    cacheName: AUDIO_CACHE,
    plugins: [cacheableResponse]
  })
);
