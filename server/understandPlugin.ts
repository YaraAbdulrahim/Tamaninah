import type { IncomingMessage, ServerResponse } from "node:http";

import { MAX_BODY_BYTES, handleUnderstand, type UnderstandEnv } from "./http/understand";
import { liveQuranWarmEnabled, scheduleQuranPublishedWarm } from "./content/quranPublishedWarm";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
type ServerLike = { middlewares: { use: (fn: Middleware) => void } };

/**
 * Dev/preview adapter for POST /api/understand: converts Node req/res to a web Request/Response
 * and delegates to the same `handleUnderstand` the Netlify Function uses.
 */
export function understandApiPlugin(env: UnderstandEnv & { QURAN_LIVE_WARM?: string }) {
  const handle: Middleware = (req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (path !== "/api/understand") {
      next();
      return;
    }
    void respond(req, res, env);
  };

  const attach = (server: ServerLike) => {
    server.middlewares.use(handle);
    // Optional live refresh of Quran items; the committed snapshot is always loaded first.
    if (liveQuranWarmEnabled(env)) scheduleQuranPublishedWarm();
  };

  return {
    name: "tamaninah-understand",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

async function respond(req: IncomingMessage, res: ServerResponse, env: UnderstandEnv) {
  try {
    const request = await toWebRequest(req);
    const response = await handleUnderstand(request, env, { clientIp: req.socket.remoteAddress ?? undefined });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(response.status === 204 ? "" : await response.text());
  } catch {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
    }
    res.end(JSON.stringify({ ok: false, error: "upstream" }));
  }
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });

  // Read at most MAX_BODY_BYTES + 1 so oversized bodies are rejected without buffering them.
  const body = await readCapped(req, MAX_BODY_BYTES + 1);
  headers.delete("content-length");
  return new Request(url, { method, headers, body });
}

function readCapped(req: IncomingMessage, cap: number): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const bytes = Buffer.concat(chunks);
      resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    };
    req.on("data", (chunk: Buffer) => {
      if (finished) return;
      const room = cap - size;
      if (chunk.length >= room) {
        chunks.push(chunk.subarray(0, room));
        size = cap;
        // Keep the stream flowing and drop the rest (the guard above). Pausing here left the
        // unread bytes on a keep-alive socket, so the client's next request on it never got answered.
        finish();
        return;
      }
      chunks.push(chunk);
      size += chunk.length;
    });
    req.on("end", finish);
    req.on("error", (error) => {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });
  });
}
