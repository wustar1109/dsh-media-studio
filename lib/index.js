// src/host/studio.ts
import fs7 from "node:fs";
import path7 from "node:path";

// src/host/library.ts
import fs2 from "node:fs";
import path2 from "node:path";

// src/host/util.ts
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
function homeDir() {
  return process.env.USERPROFILE ?? process.env.HOME ?? os.homedir();
}
function dataDir() {
  return path.join(homeDir(), ".dsh-media-studio");
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function canonical(target) {
  const abs = path.resolve(target);
  try {
    return fs.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
function foldPath(value) {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function isInside(target, root) {
  const t = foldPath(canonical(target));
  const r = foldPath(canonical(root));
  return t === r || t.startsWith(r.endsWith(path.sep) ? r : r + path.sep);
}
function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
}
function shortHash(data) {
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return void 0;
  }
}
function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}
`, "utf8");
  fs.renameSync(tmp, file);
}
var MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".json": "application/json",
  ".txt": "text/plain"
};
function mimeOf(file) {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}
function sniffImageMime(data) {
  if (data.length < 12) return void 0;
  if (data[0] === 137 && data.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (data[0] === 255 && data[1] === 216) return "image/jpeg";
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (data.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (data.toString("ascii", 4, 8) === "ftyp") {
    const brand = data.toString("ascii", 8, 12);
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif";
    return "video/mp4";
  }
  if (data[0] === 26 && data[1] === 69 && data[2] === 223 && data[3] === 163) return "video/webm";
  return void 0;
}
function imageSize(data) {
  try {
    if (data[0] === 137 && data.toString("ascii", 1, 4) === "PNG" && data.length > 24) {
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (data.toString("ascii", 0, 4) === "GIF8" && data.length > 10) {
      return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
    }
    if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP" && data.length > 30) {
      const chunk = data.toString("ascii", 12, 16);
      if (chunk === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
      if (chunk === "VP8 " && data.length > 30) return { width: data.readUInt16LE(26) & 16383, height: data.readUInt16LE(28) & 16383 };
      if (chunk === "VP8L" && data.length > 25) {
        const bits = data.readUInt32LE(21);
        return { width: (bits & 16383) + 1, height: (bits >> 14 & 16383) + 1 };
      }
    }
    if (data[0] === 255 && data[1] === 216) {
      let offset = 2;
      while (offset + 9 < data.length) {
        if (data[offset] !== 255) {
          offset += 1;
          continue;
        }
        const marker = data[offset + 1];
        if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
          return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) };
        }
        offset += 2 + data.readUInt16BE(offset + 2);
      }
    }
  } catch {
  }
  return void 0;
}
function redact(text, secret) {
  let out = text;
  if (secret !== void 0 && secret.length >= 6) out = out.split(secret).join("[redacted]");
  return out.replace(/(authorization|api[-_]?key|x-goog-api-key)(["'\s:=]+)([^\s"',}]{8,})/gi, "$1$2[redacted]");
}
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${String(timeoutMs)}ms`)), timeoutMs);
  timer.unref?.();
  const onAbort = () => controller.abort(init.signal?.reason);
  if (init.signal !== void 0 && init.signal !== null) {
    if (init.signal.aborted) controller.abort(init.signal.reason);
    else init.signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener?.("abort", onAbort);
  }
}
async function readBounded(response, maxBytes) {
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (; ; ) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) throw new Error(`response exceeded ${String(maxBytes)} bytes`);
      chunks.push(Buffer.from(next.value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, bytes);
}
async function errorBody(response, secret) {
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }
  const clean = redact(text, secret).replace(/\s+/g, " ").trim();
  return clean.length > 800 ? `${clean.slice(0, 800)}\u2026` : clean;
}
async function postJson(url, body, headers, timeoutMs, signal) {
  let last;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      ...signal === void 0 ? {} : { signal }
    }, timeoutMs);
    if (response.status !== 429 && response.status < 500) return response;
    last = response;
    if (attempt === 0) await sleep(600 + Math.random() * 600);
  }
  return last;
}
async function getWithRetry(url, headers, timeoutMs, signal) {
  let last;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(url, { headers, ...signal === void 0 ? {} : { signal } }, timeoutMs);
    if (response.status !== 429 && response.status < 500) return response;
    last = response;
    if (attempt === 0) await sleep(600 + Math.random() * 600);
  }
  return last;
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new Error("cancelled"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function joinUrl(base4, suffix) {
  return `${base4.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}
function dataUrl(data, mime) {
  return `data:${mime};base64,${data.toString("base64")}`;
}
async function download(url, maxBytes, signal, headers) {
  const response = await fetchWithTimeout(url, { redirect: "follow", ...signal === void 0 ? {} : { signal }, ...headers === void 0 ? {} : { headers } }, 18e4);
  if (!response.ok) throw new Error(`download failed: HTTP ${String(response.status)}`);
  const data = await readBounded(response, maxBytes);
  const header = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const mime = sniffImageMime(data) ?? (header.length > 0 ? header : mimeOf(url));
  return { data, mime };
}

// src/host/library.ts
var MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif|bmp|mp4|m4v|webm|mov|mkv|mp3|wav|flac|m4a|ogg)$/i;
function kindOf(file) {
  const ext = path2.extname(file).toLowerCase();
  if (/^\.(png|jpe?g|webp|gif|avif|bmp)$/.test(ext)) return "image";
  if (/^\.(mp4|m4v|webm|mov|mkv)$/.test(ext)) return "video";
  if (/^\.(mp3|wav|flac|m4a|ogg)$/.test(ext)) return "audio";
  return "file";
}
function indexFile() {
  return path2.join(dataDir(), "library", "index.json");
}
var AssetLibrary = class {
  constructor(roots, logger) {
    this.roots = roots;
    this.logger = logger;
    this.load();
  }
  roots;
  logger;
  assets = /* @__PURE__ */ new Map();
  byPath = /* @__PURE__ */ new Map();
  saveTimer;
  load() {
    const stored = readJson(indexFile());
    for (const asset of stored?.assets ?? []) {
      if (typeof asset.id !== "string" || typeof asset.path !== "string") continue;
      this.assets.set(asset.id, asset);
      this.byPath.set(asset.path, asset.id);
    }
    this.logger?.info?.(`[media-studio] \u7D20\u6750\u5E93\u8F7D\u5165 ${String(this.assets.size)} \u6761`);
  }
  scheduleSave() {
    if (this.saveTimer !== void 0) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = void 0;
      this.saveNow();
    }, 150);
    this.saveTimer.unref?.();
  }
  saveNow() {
    ensureDir(path2.dirname(indexFile()));
    writeJson(indexFile(), { version: 1, assets: [...this.assets.values()] });
  }
  remember(asset) {
    this.assets.set(asset.id, asset);
    this.byPath.set(asset.path, asset.id);
    this.writeSidecar(asset);
    this.scheduleSave();
    return asset;
  }
  writeSidecar(asset) {
    try {
      writeJson(`${asset.path}.meta.json`, { ...asset, sidecar: true });
    } catch {
    }
  }
  /** Existing record for a path, if any. */
  getByPath(file) {
    const id = this.byPath.get(path2.resolve(file));
    return id === void 0 ? void 0 : this.assets.get(id);
  }
  get(id) {
    return this.assets.get(id);
  }
  list(filter = {}) {
    const query = filter.query?.trim().toLowerCase() ?? "";
    let items = [...this.assets.values()];
    if (filter.kind !== void 0 && filter.kind !== "" && filter.kind !== "all") items = items.filter((item) => item.kind === filter.kind);
    if (filter.favorite === true) items = items.filter((item) => item.favorite === true);
    if (filter.jobId !== void 0 && filter.jobId !== "") items = items.filter((item) => item.jobId === filter.jobId);
    if (query !== "") {
      items = items.filter((item) => {
        const haystack = [item.name, item.prompt, item.negativePrompt, item.model, item.channelId, ...item.tags ?? []].join(" ").toLowerCase();
        return haystack.includes(query);
      });
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    const total = items.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 200;
    return { total, items: items.slice(offset, offset + limit) };
  }
  /** Index an existing file without copying it. */
  register(file, meta = {}) {
    const abs = path2.resolve(file);
    const existing = this.getByPath(abs);
    if (existing !== void 0) {
      const merged = { ...existing, ...stripUndefined(meta) };
      return this.remember(merged);
    }
    const stat = fs2.statSync(abs);
    const head = readHead(abs, 64 * 1024);
    const kind = kindOf(abs);
    const dimensions = kind === "image" ? imageSize(head) : void 0;
    const asset = {
      id: makeId("as"),
      path: abs,
      name: path2.basename(abs),
      kind,
      mime: sniffImageMime(head) ?? mimeOf(abs),
      bytes: stat.size,
      createdAt: stat.birthtimeMs || Date.now(),
      origin: "imported",
      ...dimensions === void 0 ? {} : { width: dimensions.width, height: dimensions.height },
      ...stripUndefined(meta)
    };
    return this.remember(asset);
  }
  /** Write bytes into the library and index the result. */
  addBuffer(data, options) {
    const kind = options.kind ?? "image";
    const ext = options.ext ?? extOfKind(kind);
    const stamp = /* @__PURE__ */ new Date();
    const sub = path2.join(String(stamp.getFullYear()), String(stamp.getMonth() + 1).padStart(2, "0"));
    const dir = options.dir ?? path2.join(this.roots[0] ?? path2.join(dataDir(), "outputs"), sub);
    ensureDir(dir);
    const base4 = sanitizeName(options.name ?? "asset");
    const file = path2.join(dir, `${base4}-${shortHash(data)}${ext}`);
    if (!fs2.existsSync(file)) fs2.writeFileSync(file, data);
    const dimensions = kind === "image" ? imageSize(data) : void 0;
    const asset = {
      id: makeId("as"),
      path: file,
      name: path2.basename(file),
      kind,
      mime: sniffImageMime(data) ?? mimeOf(file),
      bytes: data.length,
      createdAt: Date.now(),
      origin: "generated",
      ...dimensions === void 0 ? {} : { width: dimensions.width, height: dimensions.height },
      ...stripUndefined(options.meta ?? {})
    };
    return this.remember(asset);
  }
  setFavorite(id, favorite) {
    const asset = this.assets.get(id);
    if (asset === void 0) return void 0;
    asset.favorite = favorite;
    this.writeSidecar(asset);
    this.scheduleSave();
    return asset;
  }
  update(id, patch) {
    const asset = this.assets.get(id);
    if (asset === void 0) return void 0;
    const next = { ...asset, ...stripUndefined(patch) };
    return this.remember(next);
  }
  remove(id, options = {}) {
    const asset = this.assets.get(id);
    if (asset === void 0) return false;
    if (options.deleteFile !== false && asset.origin !== "imported") {
      try {
        fs2.rmSync(asset.path, { force: true });
      } catch {
      }
      try {
        fs2.rmSync(`${asset.path}.meta.json`, { force: true });
      } catch {
      }
    }
    this.assets.delete(id);
    this.byPath.delete(asset.path);
    this.scheduleSave();
    return true;
  }
  /** Index untracked media under the configured roots. */
  scan(limit = 1e3) {
    let added = 0;
    const walk = (dir, depth) => {
      if (added >= limit || depth > 3) return;
      let entries;
      try {
        entries = fs2.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (added >= limit) return;
        if (entry.name.startsWith(".")) continue;
        const full = path2.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
          continue;
        }
        if (!MEDIA_EXT.test(entry.name)) continue;
        if (this.byPath.has(full)) continue;
        try {
          this.register(full);
          added += 1;
        } catch {
        }
      }
    };
    for (const root of this.roots) walk(root, 0);
    return added;
  }
};
function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== void 0));
}
function readHead(file, bytes) {
  try {
    const fd = fs2.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(bytes);
      const read = fs2.readSync(fd, buffer, 0, bytes, 0);
      return buffer.subarray(0, read);
    } finally {
      fs2.closeSync(fd);
    }
  } catch {
    return Buffer.alloc(0);
  }
}
function sanitizeName(name2) {
  return name2.trim().replace(/\.[a-z0-9]+$/i, "").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 48) || "asset";
}
function extOfKind(kind) {
  switch (kind) {
    case "image":
      return ".png";
    case "video":
      return ".mp4";
    case "audio":
      return ".mp3";
    default:
      return ".bin";
  }
}

// src/host/jobs.ts
import fs3 from "node:fs";
import path3 from "node:path";
var KEEP_JOBS = 200;
var JobManager = class {
  constructor(logger) {
    this.logger = logger;
    this.load();
  }
  logger;
  jobs = /* @__PURE__ */ new Map();
  controllers = /* @__PURE__ */ new Map();
  dir() {
    return path3.join(dataDir(), "jobs");
  }
  load() {
    ensureDir(this.dir());
    const files = fs3.readdirSync(this.dir()).filter((file) => file.endsWith(".json"));
    const records = [];
    for (const file of files) {
      const record = readJson(path3.join(this.dir(), file));
      if (record !== void 0 && typeof record.id === "string") records.push(record);
    }
    records.sort((a, b) => b.createdAt - a.createdAt);
    for (const record of records.slice(0, KEEP_JOBS)) this.jobs.set(record.id, record);
    for (const job of this.jobs.values()) {
      if (job.state === "running" || job.state === "queued") {
        job.state = "failed";
        job.error = "\u5BBF\u4E3B\u91CD\u542F\uFF0C\u4EFB\u52A1\u4E2D\u65AD";
        job.finishedAt = Date.now();
        this.persist(job);
      }
    }
  }
  persist(job) {
    try {
      ensureDir(this.dir());
      fs3.writeFileSync(path3.join(this.dir(), `${job.id}.json`), `${JSON.stringify(job, null, 2)}
`, "utf8");
    } catch (error) {
      this.logger?.warn(`[media-studio] \u4EFB\u52A1\u843D\u76D8\u5931\u8D25\uFF1A${String(error)}`);
    }
  }
  list(filter = {}) {
    let items = [...this.jobs.values()];
    if (filter.state !== void 0 && filter.state !== "") items = items.filter((job) => job.state === filter.state);
    if (filter.kind !== void 0 && filter.kind !== "") items = items.filter((job) => job.kind === filter.kind);
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items.slice(0, filter.limit ?? 100);
  }
  get(id) {
    return this.jobs.get(id);
  }
  cancel(id) {
    const job = this.jobs.get(id);
    if (job === void 0) return false;
    const controller = this.controllers.get(id);
    if (controller !== void 0) controller.abort(new Error("cancelled by user"));
    if (job.state === "queued" || job.state === "running") {
      job.state = "cancelled";
      job.finishedAt = Date.now();
      job.error = "\u5DF2\u53D6\u6D88";
      this.persist(job);
    }
    return true;
  }
  /**
   * Start a job. `task` must resolve to the produced assets; the manager owns
   * state transitions, cancellation and persistence.
   */
  start(init, task) {
    const job = {
      id: makeId("job"),
      kind: init.kind,
      state: "queued",
      createdAt: Date.now(),
      ...init.prompt === void 0 ? {} : { prompt: init.prompt },
      ...init.channelId === void 0 ? {} : { channelId: init.channelId },
      ...init.provider === void 0 ? {} : { provider: init.provider },
      ...init.model === void 0 ? {} : { model: init.model },
      ...init.params === void 0 ? {} : { params: init.params },
      ...init.parentId === void 0 ? {} : { parentId: init.parentId },
      ...init.shots === void 0 ? {} : { shots: init.shots }
    };
    this.jobs.set(job.id, job);
    this.trim();
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    const context = {
      job,
      signal: controller.signal,
      progress: (stage, value, max) => {
        if (job.state !== "running" && job.state !== "queued") return;
        job.progress = { stage, ...value === void 0 ? {} : { value }, ...max === void 0 ? {} : { max } };
      }
    };
    queueMicrotask(() => {
      if (job.state === "cancelled") return;
      job.state = "running";
      job.startedAt = Date.now();
      this.persist(job);
      void task(context).then((result) => {
        if (job.state === "cancelled") return;
        job.state = "succeeded";
        job.finishedAt = Date.now();
        job.assets = result.assets ?? [];
        if (result.shots !== void 0) job.shots = result.shots;
        delete job.error;
        this.persist(job);
        this.logger?.info?.(`[media-studio] \u4EFB\u52A1 ${job.id} \u5B8C\u6210\uFF08${String(job.assets.length)} \u4E2A\u4EA7\u7269\uFF09`);
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (job.state === "cancelled") {
          this.persist(job);
          return;
        }
        job.state = message === "cancelled" ? "cancelled" : "failed";
        job.error = message;
        job.finishedAt = Date.now();
        this.persist(job);
        this.logger?.warn?.(`[media-studio] \u4EFB\u52A1 ${job.id} \u5931\u8D25\uFF1A${message}`);
      }).finally(() => {
        this.controllers.delete(job.id);
      });
    });
    return job;
  }
  /** Drop the oldest settled records beyond the cap, memory and disk. */
  trim() {
    const settled = [...this.jobs.values()].filter((job) => job.state !== "running" && job.state !== "queued").sort((a, b) => a.createdAt - b.createdAt);
    const excess = Math.max(0, this.jobs.size - KEEP_JOBS);
    for (const job of settled.slice(0, excess)) {
      this.jobs.delete(job.id);
      try {
        fs3.rmSync(path3.join(this.dir(), `${job.id}.json`), { force: true });
      } catch {
      }
    }
  }
  /** Block until a job settles (tools with `wait: true`). */
  async wait(id, timeoutMs) {
    const started = Date.now();
    for (; ; ) {
      const job = this.jobs.get(id);
      if (job === void 0) throw new Error(`\u6CA1\u6709\u8FD9\u4E2A\u4EFB\u52A1\uFF1A${id}`);
      if (job.state !== "running" && job.state !== "queued") return job;
      if (Date.now() - started > timeoutMs) return job;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  activeCount() {
    return [...this.jobs.values()].filter((job) => job.state === "running" || job.state === "queued").length;
  }
  stateOf(id) {
    return this.jobs.get(id)?.state;
  }
};

// src/host/comfy.ts
import fs4 from "node:fs";
import path4 from "node:path";
function workflowsDir() {
  return path4.join(dataDir(), "workflows");
}
function metaPath(id) {
  return path4.join(workflowsDir(), `${id}.meta.json`);
}
function workflowPath(id) {
  return path4.join(workflowsDir(), `${id}.json`);
}
function safeWorkflowId(name2) {
  return name2.trim().replace(/[\\/:*?"<>|#]/g, "-").replace(/\s+/g, "-").slice(0, 80) || "workflow";
}
function listWorkflows() {
  const dir = workflowsDir();
  ensureDir(dir);
  const entries = [];
  const broken = [];
  for (const file of fs4.readdirSync(dir)) {
    if (!file.endsWith(".json") || file.endsWith(".meta.json")) continue;
    const id = file.slice(0, -5);
    const workflow = readJson(path4.join(dir, file));
    if (workflow === void 0 || typeof workflow !== "object" || Object.keys(workflow).length === 0) {
      broken.push(id);
      continue;
    }
    entries.push({ id, workflow, meta: readJson(metaPath(id)) ?? {} });
  }
  return { entries, broken };
}
function getWorkflow(id) {
  const workflow = readJson(workflowPath(id));
  if (workflow === void 0) return void 0;
  return { id, workflow, meta: readJson(metaPath(id)) ?? {} };
}
function saveWorkflow(id, workflow, meta) {
  ensureDir(workflowsDir());
  const clean = safeWorkflowId(id);
  writeJson(workflowPath(clean), workflow);
  writeJson(metaPath(clean), { ...meta, updatedAt: Date.now() });
  return clean;
}
function deleteWorkflow(id) {
  try {
    fs4.rmSync(workflowPath(id));
    fs4.rmSync(metaPath(id), { force: true });
    return true;
  } catch {
    return false;
  }
}
function assertApiWorkflow(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("\u5DE5\u4F5C\u6D41\u5FC5\u987B\u662F API \u683C\u5F0F JSON \u5BF9\u8C61");
  const bag = value;
  if (Array.isArray(bag.nodes)) throw new Error("\u8FD9\u662F UI \u683C\u5F0F\u5DE5\u4F5C\u6D41\u3002\u8BF7\u5728 ComfyUI \u91CC\u7528 \u201CSave (API Format)\u201D \u5BFC\u51FA\uFF0C\u6216\u5F00\u542F \u201CDev mode\u201D \u540E\u91CD\u65B0\u5BFC\u51FA\u3002");
  const nodes = {};
  for (const [id, raw] of Object.entries(bag)) {
    if (raw === null || typeof raw !== "object") continue;
    const node = raw;
    if (typeof node.class_type !== "string") continue;
    nodes[id] = raw;
  }
  if (Object.keys(nodes).length === 0) throw new Error("\u5DE5\u4F5C\u6D41\u91CC\u6CA1\u6709\u4EFB\u4F55 class_type \u8282\u70B9\uFF0C\u4E0D\u662F API \u683C\u5F0F");
  return nodes;
}
var INTERNAL_INPUT = [/^model$/i, /^vae$/i, /^clip$/i, /^lora/i, /^batch_size$/i, /^filename_prefix$/i, /^noise_seed$/i, /^control_after_generate$/i, /^upload$/i];
function isLink(value) {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number";
}
function textOf(workflow, start) {
  if (!isLink(start)) return void 0;
  const nodeId = String(start[0]);
  const node = workflow[nodeId];
  if (node === void 0) return void 0;
  const inputs = node.inputs ?? {};
  if (typeof inputs.text === "string") return { nodeId, key: "text" };
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === "string" && !isLink(value)) return { nodeId, key };
    if (isLink(value)) {
      const nested = textOf(workflow, value);
      if (nested !== void 0) return nested;
    }
  }
  return void 0;
}
function placeholderNames(value) {
  if (typeof value !== "string") return [];
  const names = [];
  for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) names.push(match[1]);
  return names;
}
function inferSurface(id, workflow, meta) {
  const entries = Object.entries(workflow);
  const sampler = entries.find(([, node]) => /sampler/i.test(node.class_type ?? "") && node.inputs?.positive !== void 0 && node.inputs?.negative !== void 0);
  const positive = sampler === void 0 ? void 0 : textOf(workflow, sampler[1].inputs.positive);
  const negative = sampler === void 0 ? void 0 : textOf(workflow, sampler[1].inputs.negative);
  const promptSources = /* @__PURE__ */ new Map();
  const markSource = (target, kind) => {
    const text = textOf(workflow, target);
    if (text !== void 0) {
      const key = `${text.nodeId}.${text.key}`;
      if (!promptSources.has(key)) promptSources.set(key, kind);
    }
  };
  if (positive !== void 0) promptSources.set(`${positive.nodeId}.${positive.key}`, "prompt");
  if (negative !== void 0) promptSources.set(`${negative.nodeId}.${negative.key}`, "negative_prompt");
  for (const [nodeId, node] of entries) {
    const inputs = node.inputs ?? {};
    const title = node._meta?.title ?? "";
    for (const [key, value] of Object.entries(inputs)) {
      const isNegative = /^negative/i.test(key);
      const isPositive = /^(prompt|text|positive|positive_prompt)$/i.test(key);
      if (!isNegative && !isPositive) continue;
      if (isLink(value)) {
        markSource(value, isNegative ? "negative_prompt" : "prompt");
      } else if (isPositive && typeof value === "string" && value !== "" && /condition|guider|encode/i.test(node.class_type ?? "")) {
        if (!promptSources.has(`${nodeId}.${key}`)) promptSources.set(`${nodeId}.${key}`, "prompt");
      }
    }
    if (/prompt|text/i.test(title)) {
      const textKey = ["value", "text", "string"].find((candidate) => typeof inputs[candidate] === "string");
      if (textKey !== void 0 && !promptSources.has(`${nodeId}.${textKey}`)) {
        promptSources.set(`${nodeId}.${textKey}`, /negative/i.test(title) ? "negative_prompt" : "prompt");
      }
    }
  }
  const slots = [];
  const taken = /* @__PURE__ */ new Map();
  const add = (slot) => {
    const existing = taken.get(slot.name);
    if (existing !== void 0) {
      if (existing.type === slot.type && existing.value === slot.value) return;
      let suffix = 2;
      let candidate = `${slot.name}_${String(suffix)}`;
      while (taken.has(candidate)) {
        suffix += 1;
        candidate = `${slot.name}_${String(suffix)}`;
      }
      slot.name = candidate;
    }
    taken.set(slot.name, slot);
    slots.push(slot);
  };
  let imageCount = 0;
  for (const [nodeId, node] of entries) {
    const inputs = node.inputs ?? {};
    const className = node.class_type ?? "";
    for (const [key, value] of Object.entries(inputs)) {
      if (isLink(value)) continue;
      if (INTERNAL_INPUT.some((pattern) => pattern.test(key))) continue;
      const placeholders = placeholderNames(value);
      for (const name3 of placeholders) {
        add({ name: name3, type: "string", nodeId, input: key, required: true, value: typeof value === "string" ? value : void 0, label: key });
      }
      if (placeholders.length > 0) continue;
      const isImage = /loadimage|loadimages|imageinput/i.test(className) && /image/i.test(key);
      if (isImage) {
        const required = (typeof value === "string" ? value.trim() : "") === "";
        imageCount += 1;
        add({ name: "image", type: "image", nodeId, input: key, required, value: typeof value === "string" ? value : "", label: `\u53C2\u8003\u56FE ${String(imageCount)}` });
        continue;
      }
      let name2 = promptSources.get(`${nodeId}.${key}`);
      if (name2 === void 0 && typeof value === "number" && /duration|seconds|length/i.test(node._meta?.title ?? "") && /^(value|duration|seconds|length)$/i.test(key)) {
        name2 = "duration";
      }
      if (name2 === void 0) {
        if (key === "seed" || key === "noise_seed") name2 = "seed";
        else if (key === "width") name2 = "width";
        else if (key === "height") name2 = "height";
        else if (key === "steps") name2 = "steps";
        else if (key === "cfg") name2 = "cfg";
        else if (key === "denoise") name2 = "denoise";
        else if (key === "text") name2 = "text";
      }
      if (name2 === void 0) continue;
      const type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
      const label = name2 === "prompt" ? "\u63D0\u793A\u8BCD" : name2 === "negative_prompt" ? "\u8D1F\u9762\u63D0\u793A\u8BCD" : name2 === "duration" ? "\u65F6\u957F\uFF08\u79D2\uFF09" : node._meta?.title ?? key;
      add({ name: name2, type, nodeId, input: key, required: false, value, label });
    }
  }
  const order = ["prompt", "negative_prompt", "image", "duration", "width", "height", "seed", "steps", "cfg", "denoise"];
  const rank = (name2) => {
    for (const [index, prefix] of order.entries()) {
      if (name2 === prefix || name2.startsWith(`${prefix}_`)) return index;
    }
    return 99;
  };
  slots.sort((a, b) => rank(a.name) - rank(b.name));
  const outputs = [];
  const referenced = /* @__PURE__ */ new Set();
  for (const [, node] of entries) {
    for (const value of Object.values(node.inputs ?? {})) if (isLink(value)) referenced.add(value[0]);
  }
  for (const [nodeId, node] of entries) {
    if (referenced.has(nodeId)) continue;
    const className = node.class_type ?? "";
    if (!/save|preview|combine|output|video/i.test(className)) continue;
    outputs.push({
      nodeId,
      kind: /video|gif|animated|h264|mp4/i.test(className) ? "video" : "image",
      label: node._meta?.title ?? className
    });
  }
  return {
    workflowId: id,
    title: meta.title ?? id,
    description: meta.description ?? "",
    enabled: meta.enabled !== false,
    slots,
    outputs,
    nodeCount: entries.length
  };
}
function applyVars(workflow, surface, vars) {
  const clone = JSON.parse(JSON.stringify(workflow));
  const known = new Set(surface.slots.map((slot) => slot.name));
  const unknown = Object.keys(vars).filter((key) => !known.has(key));
  const byName = new Map(surface.slots.map((slot) => [slot.name, slot]));
  const applied = [];
  for (const [name2, raw] of Object.entries(vars)) {
    const slot = byName.get(name2);
    if (slot === void 0) continue;
    const node = clone[slot.nodeId];
    if (node === void 0) continue;
    node.inputs = node.inputs ?? {};
    node.inputs[slot.input] = coerce(slot, raw);
    applied.push(name2);
  }
  for (const [, node] of Object.entries(clone)) {
    for (const [key, value] of Object.entries(node.inputs ?? {})) {
      if (typeof value !== "string") continue;
      node.inputs[key] = value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, name2) => {
        const raw = vars[name2];
        return raw === void 0 || raw === null ? whole : String(raw);
      });
    }
  }
  const missing = surface.slots.filter((slot) => slot.required && slot.type !== "image" && (vars[slot.name] === void 0 || vars[slot.name] === "")).map((slot) => slot.name);
  if (missing.length > 0) throw new Error(`\u5DE5\u4F5C\u6D41\u7F3A\u5C11\u5FC5\u586B\u53D8\u91CF\uFF1A${missing.join("\u3001")}\u3002\u53EF\u7528\u53D8\u91CF\uFF1A${surface.slots.map((slot) => slot.name).join("\u3001")}`);
  return { workflow: clone, applied, unknown };
}
function coerce(slot, raw) {
  if (slot.type === "number") {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n)) throw new Error(`\u53D8\u91CF ${slot.name} \u9700\u8981\u6570\u5B57\uFF0C\u6536\u5230 ${JSON.stringify(raw)}`);
    return n;
  }
  if (slot.type === "boolean") return raw === true || raw === "true" || raw === "1";
  return String(raw);
}
var ComfyClient = class {
  constructor(baseUrl, headers = {}, logger) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.logger = logger;
  }
  baseUrl;
  headers;
  logger;
  async request(pathname, init = {}, timeoutMs = 3e4) {
    const url = pathname.startsWith("http") ? pathname : joinUrl(this.baseUrl, pathname);
    try {
      return await fetchWithTimeout(url, { ...init, headers: { ...this.headers, ...init.headers } }, timeoutMs);
    } catch (error) {
      this.logger?.warn(`[media-studio] ComfyUI \u8BF7\u6C42\u5931\u8D25 ${url}: ${String(error)}`);
      throw new Error(`\u8FDE\u4E0D\u4E0A ComfyUI\uFF08${this.baseUrl}\uFF09\uFF1A\u786E\u8BA4\u670D\u52A1\u5728\u8FD0\u884C\uFF0C\u6216\u5230\u9762\u677F\u300C\u901A\u9053\u300D\u91CC\u6539\u5730\u5740\u3002`);
    }
  }
  async systemStats() {
    try {
      const response = await this.request("system_stats", { method: "GET" }, 8e3);
      if (!response.ok) return { ok: false, error: `HTTP ${String(response.status)}` };
      const system = await response.json();
      return { ok: true, system };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  async objectInfo() {
    const response = await this.request("object_info", { method: "GET" }, 6e4);
    if (!response.ok) throw new Error(`\u62C9\u53D6 /object_info \u5931\u8D25\uFF1AHTTP ${String(response.status)}`);
    return await response.json();
  }
  async queuePrompt(workflow) {
    const response = await this.request("prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: `media-studio-${String(process.pid)}` })
    }, 6e4);
    if (response.status === 400) {
      const body = await response.text();
      throw new Error(`ComfyUI \u62D2\u7EDD\u4E86\u8FD9\u4EFD\u5DE5\u4F5C\u6D41\uFF1A${body.slice(0, 600)}`);
    }
    if (!response.ok) throw new Error(`\u63D0\u4EA4\u5DE5\u4F5C\u6D41\u5931\u8D25\uFF1AHTTP ${String(response.status)} ${await errorBody(response)}`);
    const payload = await response.json();
    const promptId = typeof payload.prompt_id === "string" ? payload.prompt_id : "";
    if (promptId === "") throw new Error("ComfyUI \u6CA1\u6709\u8FD4\u56DE prompt_id");
    const warnings = payload.node_errors !== void 0 && payload.node_errors !== null && Object.keys(payload.node_errors).length > 0 ? [`ComfyUI \u62A5\u544A\u8282\u70B9\u8B66\u544A\uFF1A${JSON.stringify(payload.node_errors).slice(0, 400)}`] : [];
    return { promptId, warnings };
  }
  async history(promptId) {
    const response = await this.request(`history/${encodeURIComponent(promptId)}`, { method: "GET" }, 3e4);
    if (response.status === 404) return void 0;
    if (!response.ok) throw new Error(`\u67E5\u8BE2 /history \u5931\u8D25\uFF1AHTTP ${String(response.status)}`);
    const payload = await response.json();
    const entry = payload[promptId];
    return entry !== null && typeof entry === "object" ? entry : void 0;
  }
  async view(ref) {
    const query = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder ?? "", type: ref.type ?? "output" });
    const response = await this.request(`view?${query.toString()}`, { method: "GET" }, 18e4);
    if (!response.ok) throw new Error(`\u53D6\u4EA7\u7269\u5931\u8D25\uFF1AHTTP ${String(response.status)}\uFF08${ref.filename}\uFF09`);
    return Buffer.from(await response.arrayBuffer());
  }
  async uploadImage(data, filename) {
    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(data)], { type: "image/png" }), filename);
    form.append("overwrite", "true");
    const response = await this.request("upload/image", { method: "POST", body: form }, 12e4);
    if (!response.ok) throw new Error(`\u4E0A\u4F20\u53C2\u8003\u56FE\u5931\u8D25\uFF1AHTTP ${String(response.status)}`);
    const payload = await response.json();
    const name2 = typeof payload.name === "string" ? payload.name : "";
    if (name2 === "") throw new Error("ComfyUI \u6CA1\u6709\u8FD4\u56DE\u4E0A\u4F20\u540E\u7684\u6587\u4EF6\u540D");
    return typeof payload.subfolder === "string" && payload.subfolder !== "" ? `${payload.subfolder}/${name2}` : name2;
  }
};
function historyFiles(entry) {
  const outputs = entry.outputs;
  const files = [];
  if (outputs === null || typeof outputs !== "object") return files;
  for (const nodeOutput of Object.values(outputs)) {
    if (nodeOutput === null || typeof nodeOutput !== "object") continue;
    for (const [key, value] of Object.entries(nodeOutput)) {
      if (!Array.isArray(value)) continue;
      const kind = /gif|video/i.test(key) ? "video" : "image";
      for (const item of value) {
        if (item === null || typeof item !== "object") continue;
        const file = item;
        if (typeof file.filename !== "string" || file.filename === "") continue;
        files.push({
          filename: file.filename,
          subfolder: typeof file.subfolder === "string" ? file.subfolder : "",
          type: typeof file.type === "string" ? file.type : "output",
          kind: /\.(mp4|webm|mov|mkv)$/i.test(file.filename) ? "video" : kind
        });
      }
    }
  }
  return files;
}
function historyState(entry) {
  const status = entry.status;
  if (status !== null && typeof status === "object") {
    const bag = status;
    if (bag.status_str === "error") {
      const messages = Array.isArray(bag.messages) ? bag.messages : [];
      const text = messages.map((item) => JSON.stringify(item)).join(" ").slice(0, 500);
      return { state: "failed", message: text === "" ? "ComfyUI \u6267\u884C\u62A5\u9519" : text };
    }
    if (bag.completed === true) return { state: "succeeded" };
    return { state: "running" };
  }
  return { state: "running" };
}

// src/host/config.ts
import fs5 from "node:fs";
import path5 from "node:path";
function configFile() {
  return path5.join(dataDir(), "config.json");
}
var BUILTINS = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    imageModel: "gpt-image-1",
    videoModel: "sora-2",
    models: { image: ["gpt-image-1", "gpt-image-1-mini"], video: ["sora-2", "sora-2-pro"] }
  },
  {
    id: "google",
    label: "Google Gemini / Veo",
    kind: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnv: "GEMINI_API_KEY",
    imageModel: "gemini-2.5-flash-image",
    videoModel: "veo-3.0-fast-generate-001",
    models: {
      image: ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
      video: ["veo-3.0-fast-generate-001", "veo-3.0-generate-001"]
    }
  },
  {
    id: "dashscope",
    label: "\u963F\u91CC\u4E91\u767E\u70BC Qwen / Wan",
    kind: "dashscope",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    imageModel: "qwen-image-plus",
    videoModel: "wan2.2-i2v-flash",
    models: {
      image: ["qwen-image-plus", "qwen-image-edit"],
      video: ["wan2.2-i2v-flash", "wan2.2-t2v-plus"]
    }
  },
  {
    id: "ark",
    label: "\u706B\u5C71\u65B9\u821F Seedream / Seedance",
    kind: "ark",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    apiKeyEnv: "ARK_API_KEY",
    imageModel: "doubao-seedream-4-0-250828",
    videoModel: "doubao-seedance-1-0-pro-250528",
    models: {
      image: ["doubao-seedream-4-0-250828", "doubao-seedream-3-0-t2i-250415"],
      video: ["doubao-seedance-1-0-pro-250528", "doubao-seedance-1-0-lite-i2v-250428"]
    }
  },
  {
    id: "xai",
    label: "xAI Grok Imagine",
    kind: "xai",
    baseUrl: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    imageModel: "grok-imagine-image",
    videoModel: "grok-imagine-video",
    models: { image: ["grok-imagine-image"], video: ["grok-imagine-video"] }
  },
  {
    id: "comfyui",
    label: "ComfyUI\uFF08\u672C\u673A / \u53CD\u4EE3\uFF09",
    kind: "comfyui",
    // Intentionally empty: no host is shipped in the repository. The user
    // fills this in the panel; an empty address keeps the channel not-ready.
    baseUrl: "",
    enabled: true
  }
];
function emptyConfig() {
  return {
    channels: BUILTINS.map((channel) => ({ ...channel, models: channel.models === void 0 ? void 0 : { ...channel.models } })),
    defaults: {},
    outputDir: null,
    libraryRoots: [],
    maxImageBytes: 40 * 1024 * 1024,
    maxVideoBytes: 512 * 1024 * 1024,
    videoTimeoutMs: 40 * 6e4,
    comfyTimeoutMs: 20 * 6e4,
    ffmpegPath: null,
    importRoots: [],
    locale: "auto"
  };
}
var CAPABILITIES = {
  openai: ["image", "video"],
  "openai-compat": ["image"],
  google: ["image", "video"],
  dashscope: ["image", "video"],
  ark: ["image", "video"],
  xai: ["image", "video"],
  comfyui: ["image", "video", "workflow"]
};
function capabilitiesOf(channel) {
  return CAPABILITIES[channel.kind] ?? [];
}
function apiKeyOf(channel) {
  const inline = channel.apiKey?.trim() ?? "";
  if (inline !== "") return inline;
  const env = channel.apiKeyEnv?.trim() ?? "";
  if (env !== "") return (process.env[env] ?? "").trim();
  return "";
}
function isReady(channel) {
  if (channel.enabled === false) return false;
  if (channel.kind === "comfyui") return (channel.baseUrl ?? "").trim() !== "";
  return apiKeyOf(channel) !== "";
}
function asNumber(value, fallback) {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function asChannel(raw) {
  if (raw === null || typeof raw !== "object") return void 0;
  const item = raw;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (id === "") return void 0;
  const kind = String(item.kind ?? "");
  if (!(kind in CAPABILITIES)) return void 0;
  return { id, kind, label: typeof item.label === "string" && item.label.trim() !== "" ? item.label.trim() : id, ...fieldsOf(item) };
}
function normalizeBaseUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed === "") return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}
function fieldsOf(item) {
  const modelsRaw = item.models;
  const models = {};
  if (modelsRaw !== null && typeof modelsRaw === "object") {
    const bag = modelsRaw;
    if (Array.isArray(bag.image)) models.image = bag.image.filter((v) => typeof v === "string");
    if (Array.isArray(bag.video)) models.video = bag.video.filter((v) => typeof v === "string");
  }
  return {
    ...typeof item.label === "string" && item.label.trim() !== "" ? { label: item.label.trim() } : {},
    ...typeof item.enabled === "boolean" ? { enabled: item.enabled } : {},
    ...typeof item.baseUrl === "string" ? { baseUrl: normalizeBaseUrl(item.baseUrl) } : {},
    ...typeof item.apiKey === "string" ? { apiKey: item.apiKey } : {},
    ...typeof item.apiKeyEnv === "string" ? { apiKeyEnv: item.apiKeyEnv } : {},
    ...typeof item.imageModel === "string" ? { imageModel: item.imageModel } : {},
    ...typeof item.videoModel === "string" ? { videoModel: item.videoModel } : {},
    ...Object.keys(models).length > 0 ? { models } : {},
    ...item.headers !== null && typeof item.headers === "object" ? { headers: Object.fromEntries(Object.entries(item.headers).filter(([, v]) => typeof v === "string")) } : {},
    ...item.options !== null && typeof item.options === "object" ? { options: item.options } : {},
    ...item.extraBody !== null && typeof item.extraBody === "object" ? { extraBody: item.extraBody } : {},
    ...typeof item.timeoutMs === "number" ? { timeoutMs: item.timeoutMs } : {}
  };
}
function mergeConfig(base4, patch) {
  if (patch === null || typeof patch !== "object") return base4;
  const input = patch;
  const merged = { ...base4, channels: base4.channels.map((channel) => ({ ...channel })), defaults: { ...base4.defaults } };
  if (Array.isArray(input.channels)) {
    for (const raw of input.channels) {
      if (raw === null || typeof raw !== "object") continue;
      const item = raw;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const index = id === "" ? -1 : merged.channels.findIndex((channel2) => channel2.id === id);
      if (index >= 0) {
        merged.channels[index] = { ...merged.channels[index], ...fieldsOf(item) };
        continue;
      }
      const channel = asChannel(raw);
      if (channel !== void 0) merged.channels.push(channel);
    }
  }
  if (input.defaults !== null && typeof input.defaults === "object") {
    const bag = input.defaults;
    if (typeof bag.image === "string") merged.defaults.image = bag.image;
    if (typeof bag.video === "string") merged.defaults.video = bag.video;
    if (typeof bag.comfyWorkflow === "string") merged.defaults.comfyWorkflow = bag.comfyWorkflow;
  }
  if (typeof input.outputDir === "string" || input.outputDir === null) merged.outputDir = input.outputDir;
  if (Array.isArray(input.libraryRoots)) merged.libraryRoots = input.libraryRoots.filter((v) => typeof v === "string" && v.trim() !== "");
  if (Array.isArray(input.importRoots)) merged.importRoots = input.importRoots.filter((v) => typeof v === "string" && v.trim() !== "");
  if (typeof input.ffmpegPath === "string" || input.ffmpegPath === null) merged.ffmpegPath = input.ffmpegPath;
  merged.maxImageBytes = asNumber(input.maxImageBytes, merged.maxImageBytes);
  merged.maxVideoBytes = asNumber(input.maxVideoBytes, merged.maxVideoBytes);
  merged.videoTimeoutMs = asNumber(input.videoTimeoutMs, merged.videoTimeoutMs);
  merged.comfyTimeoutMs = asNumber(input.comfyTimeoutMs, merged.comfyTimeoutMs);
  if (input.locale === "zh" || input.locale === "en" || input.locale === "auto") merged.locale = input.locale;
  return merged;
}
function loadStoredConfig() {
  const stored = readJson(configFile());
  if (stored === void 0) return emptyConfig();
  return mergeConfig(emptyConfig(), stored);
}
function saveStoredConfig(config) {
  ensureDir(dataDir());
  writeJson(configFile(), config);
}
function findChannel(config, needle) {
  const key = needle?.trim().toLowerCase() ?? "";
  if (key === "") return void 0;
  return config.channels.find((channel) => channel.id.toLowerCase() === key || channel.label.toLowerCase() === key);
}
function resolveChannel(config, capability, requested, options = {}) {
  const allowed = (channel) => options.cloudOnly !== true || channel.kind !== "comfyui";
  if (requested !== void 0 && requested.trim() !== "") {
    const explicit = findChannel(config, requested);
    if (explicit === void 0) return { error: `\u6CA1\u6709 id \u6216\u540D\u79F0\u4E3A \u201C${requested}\u201D \u7684\u901A\u9053\u3002` };
    if (!capabilitiesOf(explicit).includes(capability)) return { error: `\u901A\u9053 \u201C${explicit.label}\u201D \u4E0D\u652F\u6301${capability === "image" ? "\u56FE\u50CF" : "\u89C6\u9891"}\u751F\u6210\u3002` };
    if (!allowed(explicit)) return { error: `\u901A\u9053 \u201C${explicit.label}\u201D \u662F ComfyUI\uFF0C\u8BF7\u6539\u7528 media_comfy_run \u5E76\u5148\u9009\u5B9A\u5DE5\u4F5C\u6D41\u3002` };
    if (explicit.enabled === false) return { error: `\u901A\u9053 \u201C${explicit.label}\u201D \u5DF2\u88AB\u5173\u95ED\u3002` };
    if (!isReady(explicit)) return { error: `\u901A\u9053 \u201C${explicit.label}\u201D \u8FD8\u6CA1\u914D\u7F6E API Key\uFF08${explicit.apiKeyEnv ?? "\u9762\u677F \u2192 \u901A\u9053"}\uFF09\u3002` };
    return { channel: explicit };
  }
  const preferred = config.defaults[capability];
  if (preferred !== void 0) {
    const channel = findChannel(config, preferred);
    if (channel !== void 0 && capabilitiesOf(channel).includes(capability) && isReady(channel) && allowed(channel)) return { channel };
  }
  const candidates = config.channels.filter((channel) => capabilitiesOf(channel).includes(capability) && isReady(channel) && allowed(channel));
  if (candidates.length === 0) {
    return { error: `\u6CA1\u6709\u53EF\u7528\u7684${capability === "image" ? "\u56FE\u50CF" : "\u89C6\u9891"}\u901A\u9053\u3002\u5728\u9762\u677F\u300C\u901A\u9053\u300D\u91CC\u586B\u4E00\u4E2A API Key\uFF0C\u6216\u914D\u7F6E\u672C\u673A ComfyUI\uFF08ComfyUI \u8BF7\u7528\u5DE5\u4F5C\u6D41\u5DE5\u5177\uFF09\u3002` };
  }
  return { channel: candidates[0] };
}
function resolveModel(channel, capability, requested) {
  const explicit = requested?.trim() ?? "";
  if (explicit !== "") return explicit;
  const fixed = capability === "image" ? channel.imageModel : channel.videoModel;
  if (fixed !== void 0 && fixed.trim() !== "") return fixed.trim();
  const list = capability === "image" ? channel.models?.image : channel.models?.video;
  return list?.[0] ?? (capability === "image" ? "gpt-image-1" : "sora-2");
}
function looksInternal(dir) {
  const norm = dir.replace(/\\/g, "/").toLowerCase();
  return !fs5.existsSync(dir) || norm.includes("/.dsh/profiles/") || norm.includes("/.dsh/plugins/") || norm.includes("/node_modules/") || norm.endsWith("/.dsh");
}
function workspaceDirOf(ctx) {
  const env = process.env.DSH_WORKSPACE?.trim() ?? "";
  if (env !== "") return path5.resolve(env);
  try {
    const wd = ctx.get?.("workingDirectory");
    const dir = wd?.defaultDirectory;
    if (typeof dir === "string" && dir !== "" && !looksInternal(dir)) return path5.resolve(dir);
  } catch {
  }
  try {
    const service = ctx.get?.("workspaceRegistry");
    const raw = typeof service?.list === "function" ? service.list() : [];
    const paths = Array.isArray(raw) ? raw.map((item) => item !== null && typeof item === "object" ? item.path : void 0).filter((item) => typeof item === "string" && item !== "") : [];
    if (paths.length > 0) {
      const cwd2 = foldPath(process.cwd().replace(/\\/g, "/").replace(/\/+$/, ""));
      const related = paths.map((item) => ({ item, target: foldPath(item.replace(/\\/g, "/").replace(/\/+$/, "")) })).filter(({ target }) => cwd2 === target || cwd2.startsWith(`${target}/`)).sort((a, b) => b.target.length - a.target.length)[0]?.item;
      return path5.resolve(related ?? paths[0]);
    }
  } catch {
  }
  const cwd = process.cwd();
  return cwd !== "" && !looksInternal(cwd) ? cwd : void 0;
}
function resolveOutputDir(config, ctx) {
  const configured = config.outputDir?.trim() ?? "";
  if (configured !== "") return { dir: canonical(configured), source: "config" };
  const workspace = workspaceDirOf(ctx);
  if (workspace !== void 0) return { dir: path5.join(workspace, "media-studio"), source: "workspace" };
  return { dir: path5.join(dataDir(), "outputs"), source: "data" };
}
function importRootsOf(config, ctx) {
  const roots = /* @__PURE__ */ new Set();
  const workspace = workspaceDirOf(ctx);
  if (workspace !== void 0) roots.add(canonical(workspace));
  roots.add(canonical(dataDir()));
  roots.add(canonical(resolveOutputDir(config, ctx).dir));
  for (const root of config.importRoots) {
    if (root.trim() !== "") roots.add(canonical(root));
  }
  return [...roots];
}
function assertImportable(config, ctx, target) {
  const abs = canonical(target);
  if (!fs5.existsSync(abs)) throw new Error(`\u6587\u4EF6\u4E0D\u5B58\u5728\uFF1A${abs}`);
  if (!isInside(abs, dataDir()) && !importRootsOf(config, ctx).some((root) => isInside(abs, root))) {
    throw new Error(`\u62D2\u7EDD\u5BFC\u5165\u5DE5\u4F5C\u533A\u4E4B\u5916\u7684\u8DEF\u5F84\uFF1A${abs}\u3002\u628A\u5B83\u7684\u4E0A\u7EA7\u76EE\u5F55\u52A0\u5230\u914D\u7F6E importRoots \u91CC\u518D\u8BD5\u3002`);
  }
  const stat = fs5.statSync(abs);
  if (!stat.isFile()) throw new Error(`\u4E0D\u662F\u6587\u4EF6\uFF1A${abs}`);
  return abs;
}
function ensureDataLayout() {
  for (const dir of ["", "workflows", "jobs", "library", "cache"]) ensureDir(path5.join(dataDir(), dir));
}

// src/host/ffmpeg.ts
import { execFile, execFileSync } from "node:child_process";
import fs6 from "node:fs";
import path6 from "node:path";
import { promisify } from "node:util";
var run = promisify(execFile);
var cached;
function detectFfmpeg(configured) {
  if (cached !== void 0 && (configured === void 0 || configured === null || configured === cached.ffmpeg)) return cached;
  const candidates = [];
  if (configured !== void 0 && configured !== null && configured.trim() !== "") candidates.push(configured.trim());
  const env = process.env.FFMPEG_PATH?.trim();
  if (env !== void 0 && env !== "") candidates.push(env);
  const exe = process.platform === "win32" ? ".exe" : "";
  const dirs = [
    path6.join(dataDir(), "bin"),
    process.platform === "win32" ? "C:\\ffmpeg\\bin" : "/usr/local/bin",
    process.platform === "win32" ? "C:\\Program Files\\ffmpeg\\bin" : "/opt/homebrew/bin",
    "/usr/bin",
    "/usr/local/bin"
  ];
  for (const dir of dirs) candidates.push(path6.join(dir, `ffmpeg${exe}`));
  for (const candidate of candidates) {
    try {
      if (fs6.existsSync(candidate) && fs6.statSync(candidate).isFile()) {
        const probe2 = path6.join(path6.dirname(candidate), `ffprobe${exe}`);
        cached = { ffmpeg: candidate, ...fs6.existsSync(probe2) ? { ffprobe: probe2 } : {} };
        return cached;
      }
    } catch {
    }
  }
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const stdout = execFileSync(finder, ["ffmpeg"], { encoding: "utf8", timeout: 4e3 });
    const first = stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line !== "");
    if (first !== void 0) {
      const probe2 = path6.join(path6.dirname(first), `ffprobe${exe}`);
      cached = { ffmpeg: first, ...fs6.existsSync(probe2) ? { ffprobe: probe2 } : {} };
      return cached;
    }
  } catch {
  }
  cached = { error: "\u627E\u4E0D\u5230 ffmpeg\u3002\u628A\u5B83\u653E\u8FDB PATH\uFF0C\u6216\u5728\u9762\u677F\u300C\u901A\u9053 \u2192 \u9AD8\u7EA7\u300D\u91CC\u586B\u5199 ffmpegPath\u3002" };
  return cached;
}
async function probe(file, configured) {
  const info = detectFfmpeg(configured);
  if (info.ffprobe === void 0) return {};
  try {
    const { stdout } = await run(info.ffprobe, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { timeout: 2e4, maxBuffer: 4 * 1024 * 1024 });
    const payload = JSON.parse(stdout);
    const video = payload.streams?.find((stream) => stream.codec_type === "video");
    const duration = Number.parseFloat(payload.format?.duration ?? "");
    return {
      ...video?.width === void 0 ? {} : { width: video.width },
      ...video?.height === void 0 ? {} : { height: video.height },
      ...Number.isFinite(duration) ? { duration } : {},
      hasAudio: payload.streams?.some((stream) => stream.codec_type === "audio") === true
    };
  } catch {
    return {};
  }
}
async function concatVideos(options) {
  if (options.inputs.length === 0) throw new Error("\u6CA1\u6709\u53EF\u62FC\u63A5\u7684\u7247\u6BB5");
  if (options.inputs.length === 1) throw new Error("\u81F3\u5C11\u9700\u8981\u4E24\u6BB5\u89C6\u9891");
  for (const file of options.inputs) {
    if (!fs6.existsSync(file)) throw new Error(`\u7247\u6BB5\u4E0D\u5B58\u5728\uFF1A${file}`);
  }
  const info = detectFfmpeg(options.ffmpegPath);
  if (info.ffmpeg === void 0) throw new Error(info.error ?? "ffmpeg \u4E0D\u53EF\u7528");
  let width = 1280;
  let height = 720;
  if (options.size !== void 0 && options.size !== "") {
    const match = /^(\d{2,5})x(\d{2,5})$/.exec(options.size);
    if (match !== null) {
      width = Number(match[1]);
      height = Number(match[2]);
    }
  } else {
    const first = await probe(options.inputs[0], options.ffmpegPath);
    if (first.width !== void 0 && first.height !== void 0) {
      const long = Math.max(first.width, first.height);
      const scale = long > 1920 ? 1920 / long : 1;
      width = Math.round(first.width * scale / 2) * 2;
      height = Math.round(first.height * scale / 2) * 2;
    }
  }
  const fps = options.fps ?? 30;
  const filters = [];
  const labels = [];
  options.inputs.forEach((_, index) => {
    filters.push(`[${String(index)}:v]scale=${String(width)}:${String(height)}:force_original_aspect_ratio=decrease,pad=${String(width)}:${String(height)}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${String(fps)}[v${String(index)}]`);
    labels.push(`[v${String(index)}]`);
  });
  filters.push(`${labels.join("")}concat=n=${String(options.inputs.length)}:v=1:a=0[out]`);
  ensureDir(options.outputDir);
  const output = path6.join(options.outputDir, `concat-${makeId("v")}.mp4`);
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const file of options.inputs) args.push("-i", file);
  args.push("-filter_complex", filters.join(";"), "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  args.push("-an", output);
  options.onProgress?.(`\u62FC\u63A5 ${String(options.inputs.length)} \u6BB5\u89C6\u9891\u2026`);
  try {
    await run(info.ffmpeg, args, { timeout: 30 * 6e4, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    const message = error instanceof Error && "stderr" in error ? String(error.stderr ?? "").slice(0, 800) : String(error);
    throw new Error(`ffmpeg \u62FC\u63A5\u5931\u8D25\uFF1A${message}`);
  }
  return { file: output, width, height };
}
async function extractLastFrame(input, outputDir, ffmpegPath) {
  const info = detectFfmpeg(ffmpegPath);
  if (info.ffmpeg === void 0) throw new Error(info.error ?? "ffmpeg \u4E0D\u53EF\u7528");
  ensureDir(outputDir);
  const output = path6.join(outputDir, `tail-${makeId("f")}.png`);
  const attempts = [];
  const probed = await probe(input, ffmpegPath);
  if (probed.duration !== void 0 && probed.duration > 0.2) {
    attempts.push(["-ss", (probed.duration - 0.2).toFixed(2), "-i", input, "-frames:v", "1"]);
  }
  attempts.push(["-sseof", "-1", "-i", input, "-frames:v", "1"]);
  attempts.push(["-i", input, "-update", "1", "-frames:v", "1"]);
  let lastError;
  for (const args of attempts) {
    try {
      await run(info.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...args, output], { timeout: 12e4, maxBuffer: 4 * 1024 * 1024 });
      if (fs6.existsSync(output) && fs6.statSync(output).size > 0) return output;
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "\u672A\u77E5\u9519\u8BEF");
  throw new Error(`\u53D6\u5C3E\u5E27\u5931\u8D25\uFF1A${detail.slice(0, 300)}`);
}

// src/host/providers/common.ts
function bearer(apiKey, extra) {
  return { authorization: `Bearer ${apiKey}`, ...extra };
}
function imagesFromPayload(payload) {
  const bag = payload;
  const list = Array.isArray(bag?.data) ? bag.data : Array.isArray(bag?.images) ? bag.images : Array.isArray(bag?.output) ? bag.output : [];
  const out = [];
  for (const item of list) {
    if (item === null || typeof item !== "object") continue;
    const record = item;
    const b64 = typeof record.b64_json === "string" && record.b64_json.length > 0 ? record.b64_json : void 0;
    const url = typeof record.url === "string" && record.url.length > 0 ? record.url : void 0;
    const mime = typeof record.mime_type === "string" ? record.mime_type : void 0;
    if (b64 === void 0 && url === void 0) continue;
    out.push({
      ...b64 === void 0 ? {} : { b64 },
      ...url === void 0 ? {} : { url },
      ...typeof record.revised_prompt === "string" ? { revised: record.revised_prompt } : {},
      ...mime === void 0 ? {} : { mime }
    });
  }
  return out;
}
async function decodeImages(payload, maxBytes, signal, secret) {
  const entries = imagesFromPayload(payload);
  if (entries.length === 0) throw new Error("the provider returned no image");
  const images = [];
  for (const entry of entries) {
    if (entry.b64 !== void 0) {
      const data = Buffer.from(entry.b64.replace(/\s+/g, ""), "base64");
      if (data.length === 0) throw new Error("the provider returned empty base64 image data");
      if (data.length > maxBytes) throw new Error(`image exceeded ${String(maxBytes)} bytes`);
      images.push({
        data,
        mime: sniffImageMime(data) ?? entry.mime ?? "image/png",
        ...entry.revised === void 0 ? {} : { revisedPrompt: entry.revised }
      });
      continue;
    }
    if (entry.url !== void 0) {
      if (entry.url.startsWith("data:")) {
        const match = /^data:([^;]+);base64,(.*)$/s.exec(entry.url);
        if (match === null) throw new Error("the provider returned a malformed data URL");
        const data = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
        images.push({ data, mime: sniffImageMime(data) ?? match[1], ...entry.revised === void 0 ? {} : { revisedPrompt: entry.revised } });
        continue;
      }
      const downloaded = await download(entry.url, maxBytes, signal);
      images.push({ data: downloaded.data, mime: downloaded.mime, ...entry.revised === void 0 ? {} : { revisedPrompt: entry.revised } });
    }
  }
  return images;
}
function pixelsOf(size, aspectRatio) {
  if (size !== void 0 && size !== "") return size.replace("*", "x");
  return aspectToPixels(aspectRatio);
}
function aspectToPixels(aspectRatio) {
  switch (aspectRatio) {
    case "1:1":
      return "1024x1024";
    case "3:2":
      return "1536x1024";
    case "2:3":
      return "1024x1536";
    case "4:3":
      return "1280x960";
    case "3:4":
      return "960x1280";
    case "4:5":
      return "1024x1280";
    case "5:4":
      return "1280x1024";
    case "16:9":
      return "1536x864";
    case "9:16":
      return "864x1536";
    case "21:9":
      return "1680x720";
    default:
      return "1024x1024";
  }
}
async function pollUntil(read, options) {
  const started = Date.now();
  let attempt = 0;
  for (; ; ) {
    if (options.signal.aborted) throw new Error("cancelled");
    const result = await read();
    if (result.done) return result.value;
    if (result.note !== void 0) options.onProgress?.(result.note);
    else options.onProgress?.(`${options.label}\uFF1A\u7B49\u5F85\u4E0A\u6E38\u5B8C\u6210\uFF08\u7B2C ${String(attempt + 1)} \u6B21\u67E5\u8BE2\uFF09`);
    if (Date.now() - started > options.deadlineMs) throw new Error(`${options.label} timed out after ${String(Math.round(options.deadlineMs / 1e3))}s`);
    const wait = attempt === 0 ? 1500 : attempt === 1 ? 3e3 : options.intervalMs;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, wait);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("cancelled"));
      };
      if (options.signal.aborted) {
        clearTimeout(timer);
        reject(new Error("cancelled"));
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    });
    attempt += 1;
  }
}
async function failure(response, label, secret) {
  return new Error(`${label} failed (HTTP ${String(response.status)}): ${await errorBody(response, secret) || response.statusText}`);
}
function refDataUrl(ref) {
  return dataUrl(ref.data, ref.mime);
}
function clampSeconds(value, min, max) {
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}
function videoResult(data, mime, sourceUrl, poster) {
  return { data, mime, ...sourceUrl === void 0 ? {} : { sourceUrl }, ...poster === void 0 ? {} : { poster } };
}

// src/host/providers/openai.ts
var ERROR_LIMIT_NOTE = "check the model id, size and whether the gateway supports this endpoint";
function soraSize(aspectRatio, resolution) {
  const hd = resolution.toUpperCase() === "1080P";
  if (aspectRatio === "9:16") return hd ? "1080x1920" : "720x1280";
  return hd ? "1920x1080" : "1280x720";
}
async function generateOpenAIImage(request) {
  const base4 = (request.channel.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (request.channel.imageModel ?? "").trim();
  if (model === "") throw new Error("OpenAI \u901A\u9053\u6CA1\u6709\u914D\u7F6E imageModel");
  const size = pixelsOf(request.size, request.aspectRatio);
  const headers = bearer(request.apiKey, request.channel.headers);
  let response;
  if (request.refs.length > 0) {
    const form = new FormData();
    const field = request.refs.length > 1 ? "image[]" : "image";
    request.refs.forEach((ref, index) => {
      form.append(field, new Blob([new Uint8Array(ref.data)], { type: ref.mime }), `reference-${String(index + 1)}.png`);
    });
    form.append("prompt", request.prompt);
    form.append("model", model);
    form.append("n", String(request.n));
    form.append("size", size);
    if (request.quality !== void 0 && request.quality !== "") form.append("quality", request.quality);
    if (!model.startsWith("gpt-image")) form.append("response_format", "b64_json");
    for (const [key, value] of Object.entries(request.channel.extraBody ?? {})) form.append(key, String(value));
    response = await fetchWithTimeout(joinUrl(base4, "images/edits"), {
      method: "POST",
      headers,
      // boundary must be generated by fetch itself
      body: form,
      signal: request.signal
    }, 3e5);
  } else {
    response = await postJson(joinUrl(base4, "images/generations"), {
      model,
      prompt: request.prompt,
      n: request.n,
      size,
      ...request.quality === void 0 || request.quality === "" ? {} : { quality: request.quality },
      ...model.startsWith("gpt-image") ? {} : { response_format: "b64_json" },
      ...request.channel.extraBody
    }, headers, 3e5, request.signal);
  }
  if (!response.ok) throw await failure(response, "OpenAI \u56FE\u50CF\u751F\u6210", request.apiKey);
  const payload = await response.json();
  const images = await decodeImages(payload, request.maxBytes, request.signal, request.apiKey);
  if (images.length > request.n) images.length = request.n;
  return images;
}
async function generateOpenAIVideo(request) {
  const base4 = (request.channel.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (request.channel.videoModel ?? "").trim();
  if (model === "") throw new Error("OpenAI \u901A\u9053\u6CA1\u6709\u914D\u7F6E videoModel");
  const headers = bearer(request.apiKey, request.channel.headers);
  const size = soraSize(request.aspectRatio, request.resolution);
  const submit = () => {
    if (request.refs.length === 0) {
      return postJson(joinUrl(base4, "videos"), {
        model,
        prompt: request.prompt,
        seconds: String(clampSeconds(request.seconds, 4, 12)),
        size,
        ...request.channel.extraBody
      }, headers, 12e4, request.signal);
    }
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", request.prompt);
    form.append("seconds", String(clampSeconds(request.seconds, 4, 12)));
    form.append("size", size);
    form.append("input_reference", new Blob([new Uint8Array(request.refs[0].data)], { type: request.refs[0].mime }), "reference.png");
    for (const [key, value] of Object.entries(request.channel.extraBody ?? {})) form.append(key, String(value));
    return fetchWithTimeout(joinUrl(base4, "videos"), { method: "POST", headers, body: form, signal: request.signal }, 12e4);
  };
  const response = await submit();
  if (!response.ok) throw await failure(response, "OpenAI \u89C6\u9891\u63D0\u4EA4", request.apiKey);
  const created = await response.json();
  const id = typeof created.id === "string" ? created.id : "";
  if (id === "") throw new Error(`OpenAI \u89C6\u9891\u63D0\u4EA4\u6CA1\u6709\u8FD4\u56DE id\uFF08${ERROR_LIMIT_NOTE}\uFF09`);
  request.onProgress?.("\u89C6\u9891\u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u6E32\u67D3");
  return pollUntil(async () => {
    const poll = await getWithRetry(joinUrl(base4, `videos/${encodeURIComponent(id)}`), headers, 6e4, request.signal);
    if (!poll.ok) {
      if (poll.status === 404) throw new Error("OpenAI \u89C6\u9891\u4EFB\u52A1\u4E0D\u5B58\u5728\uFF08\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF09");
      throw new Error(`OpenAI \u89C6\u9891\u67E5\u8BE2\u5931\u8D25\uFF1AHTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`);
    }
    const body = await poll.json();
    const status = String(body.status ?? "").toLowerCase();
    if (status === "failed" || status === "cancelled") {
      const message = body.error !== null && typeof body.error === "object" ? JSON.stringify(body.error) : "\u89C6\u9891\u751F\u6210\u5931\u8D25";
      throw new Error(message);
    }
    if (status === "completed" || status === "succeeded") {
      const content = await getWithRetry(joinUrl(base4, `videos/${encodeURIComponent(id)}/content`), headers, 3e5, request.signal);
      if (!content.ok) throw new Error(`\u4E0B\u8F7D OpenAI \u89C6\u9891\u5931\u8D25\uFF1AHTTP ${String(content.status)}`);
      const data = await readBounded(content, request.maxBytes);
      return { done: true, value: videoResult(data, content.headers.get("content-type")?.split(";")[0] ?? "video/mp4", joinUrl(base4, `videos/${encodeURIComponent(id)}/content`)) };
    }
    const progress = typeof body.progress === "number" ? `\uFF08${String(Math.round(body.progress * 100))}%\uFF09` : "";
    return { done: false, note: `\u6E32\u67D3\u4E2D${progress}` };
  }, { deadlineMs: 40 * 6e4, intervalMs: 5e3, signal: request.signal, onProgress: request.onProgress, label: "OpenAI \u89C6\u9891" });
}

// src/host/providers/google.ts
function googleHeaders(request) {
  return { "x-goog-api-key": request.apiKey, ...request.channel.headers };
}
function bareModel(model) {
  return model.replace(/^models\//, "");
}
async function generateGoogleImage(request) {
  const base4 = (request.channel.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const model = bareModel((request.channel.imageModel ?? "").trim());
  if (model === "") throw new Error("Google \u901A\u9053\u6CA1\u6709\u914D\u7F6E imageModel");
  const parts = [];
  for (const ref of request.refs) {
    parts.push({ inlineData: { mimeType: ref.mime, data: ref.data.toString("base64") } });
  }
  parts.push({ text: request.prompt });
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      candidateCount: request.n,
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        ...request.aspectRatio === void 0 || request.aspectRatio === "" ? {} : { aspectRatio: request.aspectRatio }
      }
    }
  };
  const response = await postJson(joinUrl(base4, `models/${encodeURIComponent(model)}:generateContent`), body, googleHeaders(request), 3e5, request.signal);
  if (!response.ok) throw await failure(response, "Gemini \u56FE\u50CF\u751F\u6210", request.apiKey);
  const payload = await response.json();
  const images = [];
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.thought === true) continue;
      const inline = part.inlineData ?? part.inline_data;
      if (typeof inline?.data !== "string" || inline.data === "") continue;
      const data = Buffer.from(inline.data, "base64");
      if (data.length === 0) continue;
      if (data.length > request.maxBytes) throw new Error(`Gemini \u8FD4\u56DE\u7684\u56FE\u7247\u8D85\u8FC7 ${String(request.maxBytes)} \u5B57\u8282`);
      const declared = typeof inline.mimeType === "string" ? inline.mimeType : typeof inline.mime_type === "string" ? inline.mime_type : void 0;
      images.push({ data, mime: sniffImageMime(data) ?? declared ?? "image/png" });
    }
  }
  if (images.length === 0) throw new Error("Gemini \u6CA1\u6709\u8FD4\u56DE\u56FE\u7247\uFF1A\u786E\u8BA4\u6A21\u578B\u652F\u6301\u56FE\u50CF\u8F93\u51FA\uFF08gemini-*-image\uFF09\uFF0C\u4E14\u8D26\u53F7\u5DF2\u5F00\u901A\u8BE5\u6A21\u578B");
  return images;
}
async function generateGoogleVideo(request) {
  const base4 = (request.channel.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
  const model = bareModel((request.channel.videoModel ?? "").trim());
  if (model === "") throw new Error("Google \u901A\u9053\u6CA1\u6709\u914D\u7F6E videoModel");
  const instance = { prompt: request.prompt };
  const first = request.refs[0];
  if (first !== void 0) {
    instance.image = { bytesBase64Encoded: first.data.toString("base64"), mimeType: first.mime };
  }
  const body = {
    instances: [instance],
    parameters: {
      aspectRatio: request.aspectRatio === "" ? "16:9" : request.aspectRatio,
      durationSeconds: clampSeconds(request.seconds, 4, 8),
      personGeneration: "allow_adult",
      ...request.channel.extraBody
    }
  };
  const submitted = await postJson(joinUrl(base4, `models/${encodeURIComponent(model)}:predictLongRunning`), body, googleHeaders(request), 12e4, request.signal);
  if (!submitted.ok) throw await failure(submitted, "Veo \u89C6\u9891\u63D0\u4EA4", request.apiKey);
  const operation = await submitted.json();
  const name2 = typeof operation.name === "string" ? operation.name : "";
  if (name2 === "") throw new Error("Veo \u63D0\u4EA4\u6CA1\u6709\u8FD4\u56DE operation name");
  request.onProgress?.("Veo \u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u6E32\u67D3");
  return pollUntil(async () => {
    const poll = await getWithRetry(joinUrl(base4, name2), googleHeaders(request), 6e4, request.signal);
    if (!poll.ok) throw new Error(`Veo \u67E5\u8BE2\u5931\u8D25\uFF1AHTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`);
    const payload = await poll.json();
    if (payload.error !== void 0) throw new Error(payload.error.message ?? "Veo \u6E32\u67D3\u5931\u8D25");
    if (payload.done !== true) return { done: false, note: "Veo \u6E32\u67D3\u4E2D" };
    const response = payload.response ?? {};
    const uri = response.generatedVideos?.[0]?.video?.uri ?? response.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? response.videos?.[0]?.uri ?? response.videos?.[0]?.gcsUri;
    if (typeof uri !== "string" || uri === "") throw new Error("Veo \u5DF2\u5B8C\u6210\u4F46\u6CA1\u6709\u8FD4\u56DE\u89C6\u9891\u5730\u5740");
    const download2 = await fetchWithTimeout(uri, { headers: googleHeaders(request), signal: request.signal }, 3e5);
    if (!download2.ok) throw new Error(`\u4E0B\u8F7D Veo \u89C6\u9891\u5931\u8D25\uFF1AHTTP ${String(download2.status)}`);
    const data = await readBounded(download2, request.maxBytes);
    return { done: true, value: videoResult(data, download2.headers.get("content-type")?.split(";")[0] ?? "video/mp4", uri) };
  }, { deadlineMs: 40 * 6e4, intervalMs: 5e3, signal: request.signal, onProgress: request.onProgress, label: "Veo" });
}

// src/host/providers/dashscope.ts
function base(request) {
  return (request.channel.baseUrl ?? "https://dashscope.aliyuncs.com/api/v1").replace(/\/+$/, "");
}
function dashHeaders(apiKey, extra = {}) {
  return { authorization: `Bearer ${apiKey}`, ...extra };
}
function wanSize(aspectRatio, resolution) {
  const long = resolution === "1080P" || resolution === "1080p" ? "1920*1080" : resolution === "480P" || resolution === "480p" ? "832*480" : "1280*720";
  if (aspectRatio === "9:16") return long === "832*480" ? "480*832" : long === "1920*1080" ? "1080*1920" : "720*1280";
  if (aspectRatio === "1:1") return resolution === "1080P" ? "1080*1080" : "960*960";
  return long;
}
function wanDuration(seconds) {
  return clampSeconds(seconds, 5, 10) <= 7 ? 5 : 10;
}
async function generateDashScopeImage(request) {
  const model = (request.channel.imageModel ?? "").trim();
  if (model === "") throw new Error("DashScope \u901A\u9053\u6CA1\u6709\u914D\u7F6E imageModel");
  const content = request.refs.map((ref) => ({ image: refDataUrl(ref) }));
  content.push({ text: request.prompt });
  const size = (request.size ?? "").replace("*", "x");
  const body = {
    model,
    input: { messages: [{ role: "user", content }] },
    parameters: {
      ...size === "" ? {} : { size: size.replace("x", "*") },
      watermark: false,
      prompt_extend: true,
      n: request.n,
      ...request.channel.extraBody
    }
  };
  const response = await postJson(joinUrl(base(request), "services/aigc/multimodal-generation/generation"), body, dashHeaders(request.apiKey, request.channel.headers), 3e5, request.signal);
  if (!response.ok) throw await failure(response, "DashScope \u56FE\u50CF\u751F\u6210", request.apiKey);
  const payload = await response.json();
  const urls = [];
  for (const choice of payload.output?.choices ?? []) {
    for (const item of choice.message?.content ?? []) {
      const url = typeof item.image === "string" ? item.image : typeof item.image_url === "string" ? item.image_url : typeof item.url === "string" ? item.url : "";
      if (url !== "") urls.push(url);
    }
  }
  if (urls.length === 0) throw new Error(`DashScope \u6CA1\u6709\u8FD4\u56DE\u56FE\u7247\uFF1A${payload.message ?? payload.code ?? "\u54CD\u5E94\u91CC\u6CA1\u6709 image \u5B57\u6BB5"}`);
  const images = [];
  for (const url of urls.slice(0, request.n)) {
    const downloaded = url.startsWith("data:") ? (() => {
      const match = /^data:([^;]+);base64,(.*)$/s.exec(url);
      return { data: Buffer.from(match?.[2] ?? "", "base64"), mime: match?.[1] ?? "image/png" };
    })() : await download(url, request.maxBytes, request.signal);
    images.push({ data: downloaded.data, mime: downloaded.mime });
  }
  return images;
}
async function generateDashScopeVideo(request) {
  const model = (request.channel.videoModel ?? "").trim();
  if (model === "") throw new Error("DashScope \u901A\u9053\u6CA1\u6709\u914D\u7F6E videoModel");
  const first = request.refs[0];
  const input = { prompt: request.prompt };
  if (first !== void 0) input.img_url = refDataUrl(first);
  if (request.negative !== void 0 && request.negative !== "") input.negative_prompt = request.negative;
  const body = {
    model,
    input,
    parameters: {
      size: wanSize(request.aspectRatio === "" ? "16:9" : request.aspectRatio, request.resolution),
      duration: wanDuration(request.seconds),
      prompt_extend: true,
      watermark: false,
      ...request.channel.extraBody
    }
  };
  const response = await postJson(
    joinUrl(base(request), "services/aigc/video-generation/video-synthesis"),
    body,
    dashHeaders(request.apiKey, { "X-DashScope-Async": "enable", ...request.channel.headers }),
    12e4,
    request.signal
  );
  if (!response.ok) throw await failure(response, "DashScope \u89C6\u9891\u63D0\u4EA4", request.apiKey);
  const submitted = await response.json();
  const taskId = typeof submitted.output?.task_id === "string" ? submitted.output.task_id : "";
  if (taskId === "") throw new Error(`DashScope \u89C6\u9891\u63D0\u4EA4\u6CA1\u6709\u8FD4\u56DE task_id\uFF1A${submitted.message ?? "\u68C0\u67E5\u6A21\u578B\u662F\u5426\u5F00\u901A"}`);
  request.onProgress?.("Wan \u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u6E32\u67D3");
  return pollUntil(async () => {
    const poll = await getWithRetry(joinUrl(base(request), `tasks/${encodeURIComponent(taskId)}`), dashHeaders(request.apiKey, request.channel.headers), 6e4, request.signal);
    if (!poll.ok) throw new Error(`DashScope \u4EFB\u52A1\u67E5\u8BE2\u5931\u8D25\uFF1AHTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`);
    const payload = await poll.json();
    const status = String(payload.output?.task_status ?? "").toUpperCase();
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      throw new Error(`Wan \u6E32\u67D3\u5931\u8D25\uFF1A${String(payload.output?.message ?? payload.output?.code ?? payload.message ?? status)}`);
    }
    if (status === "SUCCEEDED") {
      const url = typeof payload.output?.video_url === "string" ? payload.output.video_url : "";
      if (url === "") throw new Error("Wan \u5DF2\u5B8C\u6210\u4F46\u6CA1\u6709\u8FD4\u56DE video_url");
      const downloaded = await download(url, request.maxBytes, request.signal);
      return { done: true, value: videoResult(downloaded.data, downloaded.mime, url) };
    }
    return { done: false, note: `Wan \u6E32\u67D3\u4E2D\uFF08${status || "PENDING"}\uFF09` };
  }, { deadlineMs: 40 * 6e4, intervalMs: 5e3, signal: request.signal, onProgress: request.onProgress, label: "Wan" });
}

// src/host/providers/ark.ts
function base2(request) {
  return (request.channel.baseUrl ?? "https://ark.cn-beijing.volces.com/api/v3").replace(/\/+$/, "");
}
async function generateArkImage(request) {
  const model = (request.channel.imageModel ?? "").trim();
  if (model === "") throw new Error("Ark \u901A\u9053\u6CA1\u6709\u914D\u7F6E imageModel");
  const size = request.size !== void 0 && request.size !== "" ? request.size : request.aspectRatio === void 0 || request.aspectRatio === "" ? "2048x2048" : { "1:1": "2048x2048", "4:3": "2304x1728", "3:4": "1728x2304", "16:9": "2560x1440", "9:16": "1440x2560", "3:2": "2496x1664", "2:3": "1664x2496", "21:9": "3024x1296" }[request.aspectRatio] ?? "2048x2048";
  const body = {
    model,
    prompt: request.prompt,
    ...request.refs.length === 0 ? {} : { image: request.refs.map((ref) => refDataUrl(ref)) },
    size,
    response_format: "b64_json",
    watermark: false,
    sequential_image_generation: "disabled",
    ...request.channel.extraBody
  };
  const response = await postJson(joinUrl(base2(request), "images/generations"), body, bearer(request.apiKey, request.channel.headers), 3e5, request.signal);
  if (!response.ok) throw await failure(response, "Seedream \u56FE\u50CF\u751F\u6210", request.apiKey);
  const payload = await response.json();
  return (await decodeImages(payload, request.maxBytes, request.signal, request.apiKey)).slice(0, request.n);
}
async function generateArkVideo(request) {
  const model = (request.channel.videoModel ?? "").trim();
  if (model === "") throw new Error("Ark \u901A\u9053\u6CA1\u6709\u914D\u7F6E videoModel");
  const content = [{ type: "text", text: request.prompt }];
  const asImage = (ref) => ({
    type: "image_url",
    image_url: { url: refDataUrl(ref) }
  });
  if (request.mode === "keyframe") {
    if (request.refs[0] !== void 0) content.push({ ...asImage(request.refs[0]), role: "first_frame" });
    if (request.refs[1] !== void 0) content.push({ ...asImage(request.refs[1]), role: "last_frame" });
  } else if (request.mode === "reference") {
    for (const ref of request.refs) content.push({ ...asImage(ref), role: "reference_image" });
  } else if (request.refs[0] !== void 0) {
    content.push({ ...asImage(request.refs[0]), role: "first_frame" });
  }
  const body = {
    model,
    content,
    resolution: request.resolution.toLowerCase() === "1080p" ? "1080p" : request.resolution.toLowerCase() === "480p" ? "480p" : "720p",
    duration: clampSeconds(request.seconds, 2, 15),
    ratio: request.aspectRatio === "" ? "16:9" : request.aspectRatio,
    watermark: false,
    ...request.seed === void 0 ? {} : { seed: request.seed },
    ...request.channel.extraBody
  };
  if (!/seedance[-_.]?1/i.test(model)) body.generate_audio = false;
  const response = await postJson(joinUrl(base2(request), "contents/generations/tasks"), body, bearer(request.apiKey, request.channel.headers), 12e4, request.signal);
  if (!response.ok) throw await failure(response, "Seedance \u89C6\u9891\u63D0\u4EA4", request.apiKey);
  const submitted = await response.json();
  const id = typeof submitted.id === "string" ? submitted.id : "";
  if (id === "") throw new Error("Seedance \u63D0\u4EA4\u6CA1\u6709\u8FD4\u56DE\u4EFB\u52A1 id\uFF08\u786E\u8BA4\u6A21\u578B id \u4E0E\u8BA1\u8D39\u5F00\u901A\u72B6\u6001\uFF09");
  request.onProgress?.("Seedance \u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u6E32\u67D3");
  return pollUntil(async () => {
    const poll = await getWithRetry(joinUrl(base2(request), `contents/generations/tasks/${encodeURIComponent(id)}`), bearer(request.apiKey, request.channel.headers), 6e4, request.signal);
    if (!poll.ok) throw new Error(`Seedance \u4EFB\u52A1\u67E5\u8BE2\u5931\u8D25\uFF1AHTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`);
    const payload = await poll.json();
    const status = String(payload.status ?? "").toLowerCase();
    if (status === "failed" || status === "cancelled") throw new Error(`Seedance \u6E32\u67D3\u5931\u8D25\uFF1A${payload.error?.message ?? status}`);
    if (status === "succeeded") {
      const url = typeof payload.content?.video_url === "string" ? payload.content.video_url : "";
      if (url === "") throw new Error("Seedance \u5DF2\u5B8C\u6210\u4F46\u6CA1\u6709\u8FD4\u56DE video_url");
      const downloaded = await download(url, request.maxBytes, request.signal);
      let poster;
      if (typeof payload.content?.last_frame_url === "string" && payload.content.last_frame_url !== "") {
        poster = await download(payload.content.last_frame_url, 20 * 1024 * 1024, request.signal).then((item) => item.data).catch(() => void 0);
      }
      return { done: true, value: videoResult(downloaded.data, downloaded.mime, url, poster) };
    }
    return { done: false, note: `Seedance \u6E32\u67D3\u4E2D\uFF08${status || "queued"}\uFF09` };
  }, { deadlineMs: 40 * 6e4, intervalMs: 5e3, signal: request.signal, onProgress: request.onProgress, label: "Seedance" });
}

// src/host/providers/xai.ts
function base3(request) {
  return (request.channel.baseUrl ?? "https://api.x.ai/v1").replace(/\/+$/, "");
}
async function generateXaiImage(request) {
  const model = (request.channel.imageModel ?? "").trim();
  if (model === "") throw new Error("xAI \u901A\u9053\u6CA1\u6709\u914D\u7F6E imageModel");
  const body = {
    model,
    prompt: request.prompt,
    n: request.n,
    response_format: "b64_json",
    ...request.aspectRatio === void 0 || request.aspectRatio === "" ? {} : { aspect_ratio: request.aspectRatio },
    ...request.size === void 0 || request.size === "" ? {} : { size: request.size },
    ...request.channel.extraBody
  };
  const response = await postJson(joinUrl(base3(request), "images/generations"), body, bearer(request.apiKey, request.channel.headers), 3e5, request.signal);
  if (!response.ok) throw await failure(response, "Grok \u56FE\u50CF\u751F\u6210", request.apiKey);
  const payload = await response.json();
  return (await decodeImages(payload, request.maxBytes, request.signal, request.apiKey)).slice(0, request.n);
}
async function generateXaiVideo(request) {
  const model = (request.channel.videoModel ?? "").trim();
  if (model === "") throw new Error("xAI \u901A\u9053\u6CA1\u6709\u914D\u7F6E videoModel");
  const first = request.refs[0];
  const body = {
    model,
    prompt: request.prompt,
    duration: clampSeconds(request.seconds, 1, 15),
    resolution: request.resolution.toLowerCase(),
    ...request.aspectRatio === "" ? {} : { aspect_ratio: request.aspectRatio },
    ...first === void 0 ? {} : { image: { url: refDataUrl(first) } },
    ...request.channel.extraBody
  };
  const response = await postJson(joinUrl(base3(request), "videos/generations"), body, bearer(request.apiKey, request.channel.headers), 12e4, request.signal);
  if (!response.ok) throw await failure(response, "Grok \u89C6\u9891\u63D0\u4EA4", request.apiKey);
  const submitted = await response.json();
  const id = typeof submitted.request_id === "string" ? submitted.request_id : typeof submitted.id === "string" ? submitted.id : "";
  if (id === "") throw new Error("Grok \u89C6\u9891\u63D0\u4EA4\u6CA1\u6709\u8FD4\u56DE request_id");
  request.onProgress?.("Grok \u4EFB\u52A1\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u6E32\u67D3");
  return pollUntil(async () => {
    const poll = await getWithRetry(joinUrl(base3(request), `videos/${encodeURIComponent(id)}`), bearer(request.apiKey, request.channel.headers), 6e4, request.signal);
    if (!poll.ok) throw new Error(`Grok \u89C6\u9891\u67E5\u8BE2\u5931\u8D25\uFF1AHTTP ${String(poll.status)} ${await errorBody(poll, request.apiKey)}`);
    const payload = await poll.json();
    const status = String(payload.status ?? "").toLowerCase();
    if (status === "failed" || status === "error" || status === "expired") {
      const message = typeof payload.error === "string" ? payload.error : payload.error?.message ?? status;
      throw new Error(`Grok \u6E32\u67D3\u5931\u8D25\uFF1A${message}`);
    }
    const url = typeof payload.video?.url === "string" ? payload.video.url : typeof payload.url === "string" ? payload.url : "";
    if (status === "completed" || status === "succeeded" || url !== "" && status === "done") {
      if (url === "") throw new Error("Grok \u5DF2\u5B8C\u6210\u4F46\u6CA1\u6709\u8FD4\u56DE\u89C6\u9891\u5730\u5740");
      const downloaded = await download(url, request.maxBytes, request.signal);
      return { done: true, value: videoResult(downloaded.data, downloaded.mime, url) };
    }
    return { done: false, note: `Grok \u6E32\u67D3\u4E2D\uFF08${status || "pending"}\uFF09` };
  }, { deadlineMs: 40 * 6e4, intervalMs: 5e3, signal: request.signal, onProgress: request.onProgress, label: "Grok" });
}

// src/host/studio.ts
var API_BASE = "/media-studio/api";
function loggerOf(ctx) {
  const raw = ctx.logger;
  if (typeof raw?.info === "function") return raw;
  return { info: (...args) => console.log(...args), warn: (...args) => console.warn(...args), error: (...args) => console.error(...args) };
}
var StudioService = class {
  logger;
  config;
  outputDir;
  outputSource;
  library;
  jobs;
  ctx;
  /** Serialised per-channel key so a panel edit is visible immediately. */
  revision = 0;
  constructor(ctx, entryConfig) {
    this.ctx = ctx;
    this.logger = loggerOf(ctx);
    this.config = mergeConfig(loadStoredConfig(), entryConfig);
    const resolved = resolveOutputDir(this.config, ctx);
    this.outputDir = canonical(resolved.dir);
    this.outputSource = resolved.source;
    ensureDir(this.outputDir);
    const roots = [this.outputDir, ...this.config.libraryRoots.map((root) => canonical(root))];
    this.library = new AssetLibrary(roots, this.logger);
    this.jobs = new JobManager(this.logger);
    this.library.scan(300);
  }
  // ── config ────────────────────────────────────────────────────────────────
  getConfig() {
    return this.config;
  }
  getOutputDir() {
    return { dir: this.outputDir, source: this.outputSource };
  }
  getLibrary() {
    return this.library;
  }
  setEntryConfig(entryConfig) {
    this.config = mergeConfig(this.config, entryConfig);
  }
  /** Merge a panel patch, persist, and forget stale channels. */
  updateConfig(patch) {
    const next = mergeConfig(this.config, patch);
    if (patch !== null && typeof patch === "object" && Array.isArray(patch.channels)) {
      const wanted = patch.channels;
      next.channels = wanted.map((item) => findChannel({ ...next, channels: next.channels }, String(item.id ?? ""))).filter((item) => item !== void 0);
    }
    this.config = next;
    saveStoredConfig(this.config);
    this.revision += 1;
    return this.config;
  }
  channels() {
    return this.config.channels.map((channel) => {
      const inline = channel.apiKey?.trim() ?? "";
      const env = channel.apiKeyEnv?.trim() ?? "";
      const envValue = env === "" ? "" : (process.env[env] ?? "").trim();
      return {
        id: channel.id,
        label: channel.label,
        kind: channel.kind,
        ...channel.enabled === void 0 ? {} : { enabled: channel.enabled },
        ...channel.baseUrl === void 0 ? {} : { baseUrl: channel.baseUrl },
        ...channel.apiKeyEnv === void 0 ? {} : { apiKeyEnv: channel.apiKeyEnv },
        ...channel.imageModel === void 0 ? {} : { imageModel: channel.imageModel },
        ...channel.videoModel === void 0 ? {} : { videoModel: channel.videoModel },
        ...channel.models === void 0 ? {} : { models: channel.models },
        apiKey: inline === "" ? void 0 : maskKey(inline),
        capabilities: capabilitiesOf(channel),
        ready: isReady(channel),
        keyHint: inline !== "" ? maskKey(inline) : envValue !== "" ? `\u73AF\u5883\u53D8\u91CF ${env}` : env !== "" ? `\u672A\u8BBE\u7F6E\uFF08${env}\uFF09` : "\u672A\u914D\u7F6E",
        keySource: inline !== "" ? "inline" : envValue !== "" ? "env" : "none"
      };
    });
  }
  /** Keep the write-only key semantics: masked values sent back are ignored. */
  maskIncomingChannels(raw) {
    if (!Array.isArray(raw)) return raw;
    return raw.map((item) => {
      if (item === null || typeof item !== "object") return item;
      const channel = { ...item };
      if (typeof channel.apiKey === "string" && channel.apiKey.includes("\u2026")) delete channel.apiKey;
      return channel;
    });
  }
  channelById(id) {
    return findChannel(this.config, id);
  }
  /** A client for the configured ComfyUI endpoint, or the reason there is none. */
  comfyClient() {
    const channel = this.config.channels.find((item) => item.kind === "comfyui");
    if (channel === void 0) return { error: "\u6CA1\u6709 ComfyUI \u901A\u9053" };
    const base4 = channel.baseUrl?.trim() ?? "";
    if (base4 === "") return { error: "\u8FD8\u6CA1\u6709\u586B\u5199 ComfyUI \u5730\u5740\uFF08\u9762\u677F \u2192 \u901A\u9053 \u2192 ComfyUI\uFF09" };
    return { client: new ComfyClient(base4, channel.headers, this.logger) };
  }
  /** Live probe for the panel and the `test` route. */
  async testChannel(id) {
    const started = Date.now();
    const channel = this.channelById(id);
    if (channel === void 0) return { ok: false, detail: `\u6CA1\u6709\u901A\u9053 ${id}` };
    if (channel.kind === "comfyui") {
      const built = this.comfyClient();
      if (built.client === void 0) return { ok: false, detail: built.error ?? "ComfyUI \u672A\u914D\u7F6E" };
      const stats = await built.client.systemStats();
      return stats.ok ? { ok: true, detail: `ComfyUI \u5728\u7EBF${systemSummary(stats.system)}`, latencyMs: Date.now() - started } : { ok: false, detail: stats.error ?? "\u8FDE\u4E0D\u4E0A" };
    }
    const key = apiKeyOf(channel);
    if (key === "") return { ok: false, detail: `\u8FD8\u6CA1\u6709 API Key\uFF08${channel.apiKeyEnv ?? "\u9762\u677F\u91CC\u586B\u5199"}\uFF09` };
    const base4 = (channel.baseUrl ?? "").replace(/\/+$/, "");
    if (base4 === "") return { ok: false, detail: "\u7F3A\u5C11 baseUrl" };
    const url = channel.kind === "google" ? `${base4}/models?key=${encodeURIComponent(key)}` : channel.kind === "dashscope" ? `${base4}/models` : `${base4}/models`;
    try {
      const headers = channel.kind === "google" ? { "x-goog-api-key": key } : { authorization: `Bearer ${key}` };
      const response = await fetch(url, { headers: { ...headers, ...channel.headers }, signal: AbortSignal.timeout(15e3) });
      if (response.ok) return { ok: true, detail: `\u8FDE\u63A5\u6B63\u5E38\uFF08HTTP ${String(response.status)}\uFF09`, latencyMs: Date.now() - started };
      if (response.status === 401 || response.status === 403) return { ok: false, detail: "\u9274\u6743\u5931\u8D25\uFF1AAPI Key \u65E0\u6548\u6216\u6CA1\u6709\u8BE5\u6A21\u578B\u7684\u6743\u9650" };
      return { ok: response.status === 404, detail: response.status === 404 ? "\u7AEF\u70B9\u53EF\u8FBE\uFF08\u8BE5\u7F51\u5173\u672A\u5B9E\u73B0 /models\uFF0C\u53EF\u76F4\u63A5\u8BD5\u751F\u6210\uFF09" : `HTTP ${String(response.status)}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
  // ── references ────────────────────────────────────────────────────────────
  /** Asset id, absolute path, or path inside the workspace. */
  resolveRef(input) {
    const trimmed = input.trim();
    if (trimmed === "") throw new Error("\u7A7A\u7684\u53C2\u8003\u56FE");
    const asset = this.library.get(trimmed);
    const file = asset?.path ?? trimmed;
    const abs = assertImportable(this.config, this.ctx, path7.isAbsolute(file) ? file : path7.resolve(file));
    const data = fs7.readFileSync(abs);
    if (data.length > 20 * 1024 * 1024) throw new Error(`\u53C2\u8003\u56FE\u8D85\u8FC7 20MB\uFF1A${abs}`);
    return { path: abs, data, mime: sniffImageMime(data) ?? mimeOf(abs) };
  }
  // ── generation ────────────────────────────────────────────────────────────
  adapterFor(channel) {
    switch (channel.kind) {
      case "openai":
      case "openai-compat":
        return { image: generateOpenAIImage, video: generateOpenAIVideo };
      case "google":
        return { image: generateGoogleImage, video: generateGoogleVideo };
      case "dashscope":
        return { image: generateDashScopeImage, video: generateDashScopeVideo };
      case "ark":
        return { image: generateArkImage, video: generateArkVideo };
      case "xai":
        return { image: generateXaiImage, video: generateXaiVideo };
      case "comfyui":
        return { image: void 0, video: void 0 };
      default:
        return { image: void 0, video: void 0 };
    }
  }
  requireChannel(capability, requested) {
    const resolved = resolveChannel(this.config, capability, requested, { cloudOnly: true });
    if (resolved.channel === void 0) throw new Error(resolved.error ?? "\u6CA1\u6709\u53EF\u7528\u901A\u9053");
    return resolved.channel;
  }
  startImage(args) {
    const prompt = args.prompt.trim();
    if (prompt === "") throw new Error("prompt \u4E0D\u80FD\u4E3A\u7A7A");
    const n = Math.max(1, Math.min(10, Math.round(args.n ?? 1)));
    const channel = this.requireChannel("image", args.channel);
    if (channel.kind === "comfyui") throw new Error("ComfyUI \u901A\u9053\u8BF7\u7528 media_comfy_run\uFF08\u9700\u8981\u5148\u9009\u5B9A\u5DE5\u4F5C\u6D41\uFF09");
    const model = resolveModel(channel, "image", args.model);
    const refs = (args.refs ?? []).slice(0, 5).map((ref) => this.resolveRef(ref));
    const key = apiKeyOf(channel);
    if (key === "") throw new Error(`\u901A\u9053 ${channel.label} \u7F3A\u5C11 API Key`);
    return this.jobs.start({
      kind: "image",
      prompt,
      channelId: channel.id,
      provider: channel.kind,
      model,
      params: { n, refs: refs.map((ref) => ref.path), size: args.size, aspectRatio: args.aspectRatio, negative: args.negative }
    }, async (context) => {
      const request = {
        channel: { ...channel, imageModel: model },
        apiKey: key,
        prompt,
        ...args.negative === void 0 ? {} : { negative: args.negative },
        ...args.size === void 0 ? {} : { size: args.size },
        ...args.aspectRatio === void 0 ? {} : { aspectRatio: args.aspectRatio },
        ...args.quality === void 0 ? {} : { quality: args.quality },
        n,
        refs: refs.map((ref) => ({ data: ref.data, mime: ref.mime })),
        signal: context.signal,
        maxBytes: this.config.maxImageBytes
      };
      context.progress("\u6B63\u5728\u8BF7\u6C42\u56FE\u50CF\u6A21\u578B\u2026");
      const adapter = this.adapterFor(channel).image;
      if (adapter === void 0) throw new Error(`\u901A\u9053 ${channel.label} \u4E0D\u652F\u6301\u56FE\u50CF\u751F\u6210`);
      const images = await adapter(request);
      return { assets: this.saveImages(images, { prompt, channel, model, jobId: context.job.id, refs: refs.map((ref) => ref.path), params: { n, aspectRatio: args.aspectRatio, size: args.size } }) };
    });
  }
  startVideo(args) {
    const prompt = args.prompt.trim();
    if (prompt === "") throw new Error("prompt \u4E0D\u80FD\u4E3A\u7A7A");
    const channel = this.requireChannel("video", args.channel);
    if (channel.kind === "comfyui") throw new Error("ComfyUI \u901A\u9053\u8BF7\u7528 media_comfy_run");
    const model = resolveModel(channel, "video", args.model);
    const refs = (args.refs ?? []).slice(0, 5).map((ref) => this.resolveRef(ref));
    const mode = args.mode ?? (refs.length === 0 ? "text" : refs.length >= 2 ? "keyframe" : "image");
    const key = apiKeyOf(channel);
    if (key === "") throw new Error(`\u901A\u9053 ${channel.label} \u7F3A\u5C11 API Key`);
    return this.jobs.start({
      kind: "video",
      prompt,
      channelId: channel.id,
      provider: channel.kind,
      model,
      params: { mode, refs: refs.map((ref) => ref.path), seconds: args.seconds, resolution: args.resolution, aspectRatio: args.aspectRatio }
    }, async (context) => {
      context.progress("\u6B63\u5728\u63D0\u4EA4\u89C6\u9891\u4EFB\u52A1\u2026");
      const adapter = this.adapterFor(channel).video;
      if (adapter === void 0) throw new Error(`\u901A\u9053 ${channel.label} \u4E0D\u652F\u6301\u89C6\u9891\u751F\u6210`);
      const video = await adapter({
        channel: { ...channel, videoModel: model },
        apiKey: key,
        prompt,
        ...args.negative === void 0 ? {} : { negative: args.negative },
        mode,
        refs: refs.map((ref) => ({ data: ref.data, mime: ref.mime })),
        seconds: args.seconds ?? 5,
        resolution: args.resolution ?? "720P",
        aspectRatio: args.aspectRatio ?? "16:9",
        ...args.seed === void 0 ? {} : { seed: args.seed },
        signal: context.signal,
        maxBytes: this.config.maxVideoBytes,
        onProgress: (stage) => context.progress(stage)
      });
      const asset = this.saveVideo(video, { prompt, channel, model, jobId: context.job.id, refs: refs.map((ref) => ref.path), seconds: args.seconds });
      const assets = [asset];
      if (video.poster !== void 0 && video.poster.length > 0) {
        try {
          const poster = this.library.addBuffer(video.poster, { kind: "image", name: `poster-${asset.name.replace(/\.[a-z0-9]+$/i, "")}`, meta: { prompt, channelId: channel.id, provider: channel.kind, model, jobId: context.job.id } });
          asset.extra = { ...asset.extra ?? {}, posterId: poster.id };
          assets.push(poster);
        } catch {
        }
      }
      return { assets };
    });
  }
  startComfy(args) {
    const entry = getWorkflow(args.workflowId);
    if (entry === void 0) throw new Error(`\u6CA1\u6709\u5DE5\u4F5C\u6D41 ${args.workflowId}\u3002\u5148\u5217\u4E00\u4E0B media_comfy_workflows\u3002`);
    if (entry.meta.enabled === false) throw new Error(`\u5DE5\u4F5C\u6D41 ${args.workflowId} \u5DF2\u88AB\u505C\u7528`);
    const channel = findChannel(this.config, "comfyui") ?? this.config.channels.find((item) => item.kind === "comfyui");
    if (channel === void 0) throw new Error("\u6CA1\u6709 ComfyUI \u901A\u9053");
    const built = this.comfyClient();
    if (built.client === void 0) throw new Error(built.error ?? "ComfyUI \u672A\u914D\u7F6E");
    const client = built.client;
    const surface = inferSurface(entry.id, entry.workflow, entry.meta);
    const overrides = normaliseOverrides(args.overrides);
    const vars = { ...args.vars ?? {} };
    const base4 = JSON.parse(JSON.stringify(entry.workflow));
    for (const [key, value] of Object.entries(overrides)) {
      const [nodeId, input] = key.split(".");
      if (nodeId === void 0 || input === void 0) continue;
      if (base4[nodeId]?.inputs !== void 0) base4[nodeId].inputs[input] = value;
    }
    const images = args.images ?? [];
    return this.jobs.start({
      kind: "comfy",
      prompt: String(vars.prompt ?? vars.text ?? surface.title),
      channelId: channel.id,
      provider: "comfyui",
      model: surface.title,
      params: { workflowId: entry.id, vars, overrides }
    }, async (context) => {
      const applied = applyVars(base4, surface, vars);
      const uploaded = await this.uploadComfyImages(client, surface, images, context.signal);
      const missingImages = surface.slots.filter((slot) => slot.type === "image" && slot.required && !uploaded.some(([name2]) => name2 === slot.name)).map((slot) => slot.name);
      if (missingImages.length > 0) throw new Error(`\u5DE5\u4F5C\u6D41\u9700\u8981\u53C2\u8003\u56FE\uFF1A${missingImages.join("\u3001")}\u3002\u7528 images \u53C2\u6570\u4F20\u672C\u673A\u56FE\u7247\u6216\u7D20\u6750\u5E93 id\u3002`);
      for (const [slot, name2] of uploaded) {
        const target = surface.slots.find((item) => item.name === slot);
        if (target !== void 0) {
          applied.workflow[target.nodeId].inputs[target.input] = name2;
          applied.applied.push(slot);
        }
      }
      context.progress("\u6B63\u5728\u63D0\u4EA4\u5230 ComfyUI\u2026");
      const submitted = await client.queuePrompt(applied.workflow);
      context.progress("ComfyUI \u6267\u884C\u4E2D\u2026");
      const assets = [];
      const deadline = Date.now() + this.config.comfyTimeoutMs;
      for (; ; ) {
        if (context.signal.aborted) throw new Error("cancelled");
        const history = await client.history(submitted.promptId);
        if (history !== void 0) {
          const state = historyState(history);
          if (state.state === "failed") throw new Error(state.message ?? "ComfyUI \u6267\u884C\u5931\u8D25");
          if (state.state === "succeeded") {
            const files = historyFiles(history);
            if (files.length === 0) throw new Error("ComfyUI \u6267\u884C\u5B8C\u6210\u4F46\u6CA1\u6709\u4EA7\u7269\uFF08\u5DE5\u4F5C\u6D41\u53EF\u80FD\u6CA1\u6709 SaveImage \u8282\u70B9\uFF09");
            for (const file of files) {
              const data = await client.view(file);
              const asset = file.kind === "video" ? this.library.addBuffer(data, { ext: path7.extname(file.filename) || ".mp4", kind: "video", name: path7.basename(file.filename, path7.extname(file.filename)), meta: { prompt: String(vars.prompt ?? ""), channelId: channel.id, provider: "comfyui", model: surface.title, jobId: context.job.id, origin: "comfy" } }) : this.library.addBuffer(data, { ext: path7.extname(file.filename) || ".png", kind: "image", name: path7.basename(file.filename, path7.extname(file.filename)), meta: { prompt: String(vars.prompt ?? ""), channelId: channel.id, provider: "comfyui", model: surface.title, jobId: context.job.id, origin: "comfy" } });
              assets.push(asset);
            }
            return { assets };
          }
        }
        if (Date.now() > deadline) throw new Error(`ComfyUI \u8D85\u65F6\uFF08${String(Math.round(this.config.comfyTimeoutMs / 1e3))}s\uFF09\u3002\u4EFB\u52A1\u53EF\u80FD\u8FD8\u5728\u8DD1\uFF0C\u53BB ComfyUI \u961F\u5217\u786E\u8BA4\u3002`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    });
  }
  async uploadComfyImages(client, surface, images, signal) {
    const slots = surface.slots.filter((slot) => slot.type === "image");
    if (images.length === 0) return [];
    if (slots.length === 0) throw new Error("\u8FD9\u4E2A\u5DE5\u4F5C\u6D41\u6CA1\u6709\u56FE\u7247\u8F93\u5165\u69FD\u4F4D");
    const result = [];
    let index = 0;
    for (const item of images) {
      if (signal.aborted) throw new Error("cancelled");
      const ref = typeof item === "string" ? this.resolveRef(item) : this.resolveRef(item.path);
      const slot = typeof item === "string" ? slots[index] : slots.find((candidate) => candidate.name === item.slot) ?? slots[index];
      if (slot === void 0) throw new Error("\u56FE\u7247\u6570\u91CF\u8D85\u8FC7\u5DE5\u4F5C\u6D41\u7684\u56FE\u7247\u69FD\u4F4D");
      const name2 = await client.uploadImage(ref.data, `${makeId("ref")}${path7.extname(ref.path) || ".png"}`);
      result.push([slot.name, name2]);
      index += 1;
    }
    return result;
  }
  saveImages(images, meta) {
    return images.map((image, index) => this.library.addBuffer(image.data, {
      kind: "image",
      name: `${meta.channel.id}-${index + 1}`,
      meta: {
        prompt: meta.prompt,
        ...image.revisedPrompt === void 0 ? {} : { extra: { revisedPrompt: image.revisedPrompt } },
        channelId: meta.channel.id,
        provider: meta.channel.kind,
        model: meta.model,
        ...meta.jobId === void 0 ? {} : { jobId: meta.jobId },
        ...meta.refs === void 0 || meta.refs.length === 0 ? {} : { refs: meta.refs },
        tags: [meta.channel.kind, meta.model].filter(Boolean),
        origin: "generated"
      }
    }));
  }
  saveVideo(video, meta) {
    return this.library.addBuffer(video.data, {
      kind: "video",
      ext: extForMime(video.mime),
      name: `${meta.channel.id}-video`,
      meta: {
        prompt: meta.prompt,
        channelId: meta.channel.id,
        provider: meta.channel.kind,
        model: meta.model,
        ...meta.jobId === void 0 ? {} : { jobId: meta.jobId },
        ...meta.refs === void 0 || meta.refs.length === 0 ? {} : { refs: meta.refs },
        ...video.duration === void 0 ? {} : { duration: video.duration },
        ...meta.seconds === void 0 ? {} : { extra: { seconds: meta.seconds, sourceUrl: video.sourceUrl } },
        tags: [meta.channel.kind, meta.model].filter(Boolean),
        origin: "generated"
      }
    });
  }
  // ── storyboard ────────────────────────────────────────────────────────────
  startStoryboard(args) {
    const shots = args.shots.filter((shot) => shot.prompt.trim() !== "");
    if (shots.length === 0) throw new Error("\u5206\u955C\u91CC\u6CA1\u6709\u6709\u6548\u955C\u5934\uFF08\u6BCF\u955C\u90FD\u8981\u6709 prompt\uFF09");
    if (shots.length > 12) throw new Error("\u4E00\u6B21\u6700\u591A 12 \u4E2A\u955C\u5934");
    const channel = this.requireChannel("video", args.channel);
    if (channel.kind === "comfyui") throw new Error("\u5206\u955C\u76EE\u524D\u53EA\u652F\u6301\u4E91\u7AEF\u89C6\u9891\u901A\u9053");
    const model = resolveModel(channel, "video", args.model);
    const key = apiKeyOf(channel);
    if (key === "") throw new Error(`\u901A\u9053 ${channel.label} \u7F3A\u5C11 API Key`);
    return this.jobs.start({
      kind: "storyboard",
      prompt: shots[0].prompt,
      channelId: channel.id,
      provider: channel.kind,
      model,
      params: { shots: shots.map((shot) => shot.prompt), chain: args.chain === true, concat: args.concat !== false },
      shots: shots.map((shot, index) => ({ index, prompt: shot.prompt, state: "queued" }))
    }, async (context) => {
      const assets = [];
      const clips = [];
      let previousTail;
      for (const [index, shot] of shots.entries()) {
        if (context.signal.aborted) throw new Error("cancelled");
        const shotState = context.job.shots?.[index];
        if (shotState !== void 0) shotState.state = "running";
        context.progress(`\u955C\u5934 ${String(index + 1)}/${String(shots.length)}\uFF1A\u751F\u6210\u4E2D`);
        const prompt = args.style === void 0 || args.style.trim() === "" ? shot.prompt : `${args.style.trim()}\uFF0C${shot.prompt.trim()}`;
        let refPath = shot.ref;
        if (refPath === void 0 && args.chain === true) refPath = previousTail;
        const ref = refPath === void 0 ? void 0 : this.resolveRef(refPath);
        const adapter = this.adapterFor(channel).video;
        if (adapter === void 0) throw new Error("\u901A\u9053\u4E0D\u652F\u6301\u89C6\u9891");
        const video = await adapter({
          channel: { ...channel, videoModel: model },
          apiKey: key,
          prompt,
          mode: ref === void 0 ? "text" : "image",
          refs: ref === void 0 ? [] : [{ data: ref.data, mime: ref.mime }],
          seconds: shot.seconds ?? args.seconds ?? 5,
          resolution: args.resolution ?? "720P",
          aspectRatio: args.aspectRatio ?? "16:9",
          signal: context.signal,
          maxBytes: this.config.maxVideoBytes,
          onProgress: (stage) => context.progress(`\u955C\u5934 ${String(index + 1)}/${String(shots.length)}\uFF1A${stage}`)
        });
        const asset = this.saveVideo(video, { prompt, channel, model, jobId: context.job.id, refs: ref === void 0 ? [] : [ref.path], seconds: shot.seconds ?? args.seconds });
        assets.push(asset);
        clips.push(asset.path);
        if (shotState !== void 0) {
          shotState.state = "succeeded";
          shotState.assetId = asset.id;
        }
        if (args.chain === true) {
          try {
            previousTail = await extractLastFrame(asset.path, path7.join(dataDir(), "cache", "frames"), this.config.ffmpegPath);
          } catch (error) {
            context.progress(`\u955C\u5934 ${String(index + 1)} \u53D6\u5C3E\u5E27\u5931\u8D25\uFF0C\u4E0B\u4E00\u955C\u6539\u7528\u6587\u751F\u89C6\u9891\uFF1A${error instanceof Error ? error.message : String(error)}`);
            previousTail = void 0;
          }
        }
      }
      if (args.concat !== false && clips.length > 1) {
        context.progress("\u62FC\u63A5\u5168\u90E8\u955C\u5934\u2026");
        const result = await concatVideos({ inputs: clips, outputDir: path7.join(this.outputDir, "compose"), ffmpegPath: this.config.ffmpegPath, onProgress: (stage) => context.progress(stage) });
        const data = fs7.readFileSync(result.file);
        const final = this.library.addBuffer(data, {
          kind: "video",
          name: "storyboard",
          meta: { prompt: shots.map((shot) => shot.prompt).join(" / "), channelId: channel.id, provider: channel.kind, model, jobId: context.job.id, tags: ["storyboard"], origin: "generated" }
        });
        assets.push(final);
      }
      return { assets, shots: context.job.shots };
    });
  }
  // ── concat ────────────────────────────────────────────────────────────────
  startConcat(input) {
    if (input.ids.length < 2) throw new Error("\u81F3\u5C11\u9009\u4E24\u6BB5\u89C6\u9891");
    const files = input.ids.map((id) => {
      const asset = this.library.get(id);
      if (asset === void 0) throw new Error(`\u7D20\u6750 ${id} \u4E0D\u5B58\u5728`);
      if (asset.kind !== "video") throw new Error(`${asset.name} \u4E0D\u662F\u89C6\u9891`);
      return asset;
    });
    return this.jobs.start({
      kind: "concat",
      prompt: files.map((asset) => asset.name).join(" + "),
      params: { ids: input.ids }
    }, async (context) => {
      const result = await concatVideos({
        inputs: files.map((asset2) => asset2.path),
        outputDir: path7.join(this.outputDir, "compose"),
        ...input.size === void 0 ? {} : { size: input.size },
        ffmpegPath: this.config.ffmpegPath,
        onProgress: (stage) => context.progress(stage)
      });
      const data = fs7.readFileSync(result.file);
      const asset = this.library.addBuffer(data, {
        kind: "video",
        name: "concat",
        meta: { prompt: files.map((item) => item.prompt ?? item.name).join(" | "), tags: ["concat"], jobId: context.job.id, origin: "generated" }
      });
      return { assets: [asset] };
    });
  }
  // ── comfy workflows ───────────────────────────────────────────────────────
  comfyWorkflows() {
    const listed = listWorkflows();
    const channel = this.config.channels.find((item) => item.kind === "comfyui");
    return {
      workflows: listed.entries.map((entry) => inferSurface(entry.id, entry.workflow, entry.meta)),
      broken: listed.broken,
      comfyui: { baseUrl: channel?.baseUrl ?? "", online: false }
    };
  }
  comfyOnline() {
    const built = this.comfyClient();
    if (built.client === void 0) return Promise.resolve({ online: false, detail: built.error ?? "ComfyUI \u672A\u914D\u7F6E" });
    return built.client.systemStats().then((stats) => ({ online: stats.ok, detail: stats.error, system: stats.system }));
  }
  importWorkflow(input) {
    const raw = input.json ?? "";
    if (raw.trim() === "") throw new Error("\u7F3A\u5C11\u5DE5\u4F5C\u6D41 JSON");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("\u5DE5\u4F5C\u6D41 JSON \u89E3\u6790\u5931\u8D25");
    }
    const workflow = assertApiWorkflow(parsed);
    const id = saveWorkflow(input.id ?? input.title ?? `workflow-${String(Date.now())}`, workflow, {
      ...input.title === void 0 ? {} : { title: input.title },
      ...input.description === void 0 ? {} : { description: input.description },
      enabled: true
    });
    return inferSurface(id, workflow, { title: input.title ?? id, description: input.description ?? "", enabled: true });
  }
  importWorkflowFile(file, title) {
    const abs = assertImportable(this.config, this.ctx, file);
    return this.importWorkflow({ json: fs7.readFileSync(abs, "utf8"), ...title === void 0 ? {} : { id: title, title } });
  }
  removeWorkflow(id) {
    return deleteWorkflow(id);
  }
  setWorkflowMeta(id, patch) {
    const entry = getWorkflow(id);
    if (entry === void 0) throw new Error(`\u6CA1\u6709\u5DE5\u4F5C\u6D41 ${id}`);
    const meta = { ...entry.meta, ...patch, updatedAt: Date.now() };
    saveWorkflow(id, entry.workflow, meta);
    return inferSurface(id, entry.workflow, meta);
  }
  // ── library ───────────────────────────────────────────────────────────────
  importAsset(file) {
    const abs = assertImportable(this.config, this.ctx, file);
    return this.library.register(abs);
  }
  /** Save an inline base64 image (pasted from the browser). */
  importBase64(data, name2) {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(data);
    const mime = match?.[1] ?? "image/png";
    const buffer = Buffer.from((match?.[2] ?? data).replace(/\s+/g, ""), "base64");
    if (buffer.length === 0) throw new Error("\u7A7A\u7684\u56FE\u7247\u6570\u636E");
    if (buffer.length > this.config.maxImageBytes) throw new Error("\u56FE\u7247\u592A\u5927");
    const ext = mime.includes("jpeg") ? ".jpg" : mime.includes("webp") ? ".webp" : mime.includes("gif") ? ".gif" : mime.includes("mp4") ? ".mp4" : ".png";
    return this.library.addBuffer(buffer, { kind: mime.startsWith("video") ? "video" : "image", ext, ...name2 === void 0 ? {} : { name: name2 } });
  }
  /** Optional inline attachments for tool results. */
  async attach(assets) {
    const service = this.ctx.get?.("attachments");
    if (typeof service?.saveImage !== "function") return [];
    const blocks = [];
    for (const asset of assets) {
      if (asset.kind !== "image") continue;
      try {
        const data = fs7.readFileSync(asset.path);
        const ref = await service.saveImage({ data: new Uint8Array(data), mediaType: asset.mime, name: asset.name });
        if (ref !== void 0 && ref !== null) blocks.push({ type: "image", attachment: ref });
      } catch (error) {
        this.logger.warn(`[media-studio] \u5185\u8054\u9644\u4EF6\u5931\u8D25\uFF08\u4ECD\u53EF\u7528\u8DEF\u5F84\u9884\u89C8\uFF09\uFF1A${String(error)}`);
      }
    }
    return blocks;
  }
  // ── diagnostics ───────────────────────────────────────────────────────────
  /** Counts for the panel header and the stats tool. */
  libraryStats() {
    const all = this.library.list({ limit: 1e5 }).items;
    return {
      total: all.length,
      images: all.filter((item) => item.kind === "image").length,
      videos: all.filter((item) => item.kind === "video").length,
      bytes: all.reduce((sum, item) => sum + item.bytes, 0),
      favorites: all.filter((item) => item.favorite === true).length,
      activeJobs: this.jobs.activeCount()
    };
  }
  diagnostics() {
    const ffmpeg = detectFfmpeg(this.config.ffmpegPath);
    return {
      plugin: "dsh-media-studio",
      version: "0.1.0",
      configFile: configFile(),
      dataDir: dataDir(),
      outputDir: this.outputDir,
      workspace: workspaceDirOf(this.ctx) ?? null,
      importRoots: importRootsOf(this.config, this.ctx),
      ffmpeg: { found: ffmpeg.ffmpeg !== void 0, path: ffmpeg.ffmpeg ?? null, error: ffmpeg.error ?? null },
      activeJobs: this.jobs.activeCount(),
      revision: this.revision
    };
  }
};
function normaliseOverrides(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^[^.]+\.[^.]+$/.test(key)) throw new Error(`overrides \u7684\u952E\u5FC5\u987B\u5F62\u5982 "6.text"\uFF0C\u6536\u5230 ${key}`);
    out[key] = raw;
  }
  return out;
}
function maskKey(key) {
  if (key.length <= 8) return `${key.slice(0, 2)}\u2026`;
  return `${key.slice(0, 4)}\u2026${key.slice(-4)}`;
}
function extForMime(mime) {
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("quicktime")) return ".mov";
  if (mime.includes("matroska")) return ".mkv";
  return ".mp4";
}
function systemSummary(system) {
  if (system === void 0) return "";
  const devices = system.devices;
  if (Array.isArray(devices) && devices.length > 0) {
    const first = devices[0];
    const vram = typeof first.vram_total === "number" ? ` \xB7 ${String(Math.round(first.vram_total / 1024 / 1024 / 1024))}GB` : "";
    return ` \xB7 ${typeof first.name === "string" ? first.name : "GPU"}${vram}`;
  }
  return "";
}

// src/host/routes.ts
import fs9 from "node:fs";
import path9 from "node:path";

// src/host/tools.ts
import fs8 from "node:fs";
import path8 from "node:path";
function jsonOutput() {
  return {
    schema: { type: "object", additionalProperties: true },
    render: (_args, value) => {
      const blocks = [];
      const marker = "__attachments";
      const bag = value;
      if (bag !== null && typeof bag === "object" && Array.isArray(bag[marker])) {
        for (const item of bag[marker]) blocks.push(item);
        delete bag[marker];
      }
      blocks.unshift({ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) });
      return blocks;
    }
  };
}
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asStringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim() !== "");
  if (typeof value === "string" && value.trim() !== "") return value.split(",").map((item) => item.trim()).filter((item) => item !== "");
  return [];
}
function asInt(value, fallback, min, max) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
function assetView(asset) {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    path: asset.path,
    url: `/media-studio/api/asset/${asset.id}`,
    bytes: asset.bytes,
    ...asset.width === void 0 ? {} : { width: asset.width },
    ...asset.height === void 0 ? {} : { height: asset.height },
    ...asset.duration === void 0 ? {} : { duration: asset.duration },
    prompt: asset.prompt,
    channel: asset.channelId,
    model: asset.model,
    favorite: asset.favorite === true,
    tags: asset.tags ?? [],
    origin: asset.origin,
    createdAt: new Date(asset.createdAt).toISOString()
  };
}
function jobView(job) {
  return {
    jobId: job.id,
    kind: job.kind,
    state: job.state,
    prompt: job.prompt,
    channel: job.channelId,
    model: job.model,
    progress: job.progress?.stage,
    error: job.error,
    createdAt: new Date(job.createdAt).toISOString(),
    ...job.finishedAt === void 0 ? {} : { finishedAt: new Date(job.finishedAt).toISOString() },
    assets: (job.assets ?? []).map(assetView),
    ...job.shots === void 0 ? {} : { shots: job.shots },
    ...job.state === "running" || job.state === "queued" ? { hint: `\u4EFB\u52A1\u8FD8\u5728\u8FDB\u884C\u3002\u7528 media_job { action: "get", jobId: "${job.id}" } \u67E5\u8BE2\uFF0C\u6216 { action: "wait", jobId: "${job.id}" } \u963B\u585E\u7B49\u5F85\u3002` } : {}
  };
}
function buildTools(studio, ctx) {
  const waitFor = async (job, wait, timeoutMs) => {
    const settled = wait ? await studio.jobs.wait(job.id, timeoutMs) : job;
    const view = jobView(settled);
    const attachments = await studio.attach(settled.assets ?? []);
    if (attachments.length > 0) view.__attachments = attachments;
    return view;
  };
  const channelsTool = {
    name: "media_channels",
    description: "\u5217\u51FA\u5A92\u4F53\u5DE5\u4F5C\u53F0\u7684\u901A\u9053\uFF1Aid\u3001\u540D\u79F0\u3001\u534F\u8BAE\u65CF\u3001\u80FD\u529B\uFF08image/video/workflow\uFF09\u3001\u662F\u5426\u5C31\u7EEA\u3001\u9ED8\u8BA4\u6A21\u578B\u3002\u751F\u56FE/\u751F\u89C6\u9891\u524D\u5982\u679C\u4E0D\u786E\u5B9A\u7528\u54EA\u4E2A\u901A\u9053\uFF0C\u5148\u8C03\u5B83\u3002ComfyUI \u7684\u5728\u7EBF\u72B6\u6001\u4E5F\u5728\u8FD9\u91CC\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {}
    },
    output: jsonOutput(),
    async execute() {
      const channels = studio.channels().map((channel) => ({
        id: channel.id,
        label: channel.label,
        kind: channel.kind,
        ready: channel.ready,
        capabilities: channel.capabilities,
        ...channel.imageModel === void 0 ? {} : { imageModel: channel.imageModel },
        ...channel.videoModel === void 0 ? {} : { videoModel: channel.videoModel },
        key: channel.keyHint
      }));
      const comfy = await studio.comfyOnline();
      return {
        ok: true,
        channels,
        defaults: studio.getConfig().defaults,
        comfyui: {
          baseUrl: studio.getConfig().channels.find((item) => item.kind === "comfyui")?.baseUrl ?? "",
          online: comfy.online,
          ...comfy.detail === void 0 ? {} : { detail: comfy.detail }
        },
        hint: channels.some((channel) => channel.ready) ? "ready=false \u7684\u901A\u9053\u7F3A\u5C11 API Key\uFF08\u9762\u677F \u2192 \u901A\u9053\uFF09\u3002ComfyUI \u9700\u8981\u5148\u5BFC\u5165\u5DE5\u4F5C\u6D41\uFF0C\u518D\u7528 media_comfy_run\u3002" : "\u8FD8\u6CA1\u6709\u53EF\u7528\u901A\u9053\uFF1A\u5728\u9762\u677F\u300C\u901A\u9053\u300D\u91CC\u586B\u4E00\u4E2A API Key\uFF0C\u6216\u628A ComfyUI \u5730\u5740\u6307\u5230\u672C\u673A\u5DF2\u542F\u52A8\u7684\u5B9E\u4F8B\u3002"
      };
    }
  };
  const imageTool = {
    name: "media_generate_image",
    description: "\u751F\u6210\u56FE\u7247\uFF08\u6587\u751F\u56FE / \u56FE\u751F\u56FE\uFF09\uFF0C\u652F\u6301\u4E00\u6B21 1\u201310 \u5F20\u3001\u6700\u591A 5 \u5F20\u53C2\u8003\u56FE\u3002\u5F02\u6B65\uFF1A\u9ED8\u8BA4\u7ACB\u5373\u8FD4\u56DE jobId\uFF0C\u4E4B\u540E\u7528 media_job \u67E5\uFF1Bwait=true \u4F1A\u7B49\u5230\u51FA\u56FE\uFF08\u6700\u957F 5 \u5206\u949F\uFF09\u3002\u901A\u9053\u53EF\u7528 openai / google / dashscope / ark / xai / openai-compat\uFF0C\u4E5F\u53EF\u7528 channel \u6307\u5B9A\u9762\u677F\u91CC\u914D\u7F6E\u7684\u4EFB\u610F\u901A\u9053\u3002\u56FE\u7247\u4F1A\u5199\u8FDB\u7D20\u6750\u5E93\u5E76\u8FD4\u56DE\u672C\u5730\u8DEF\u5F84\u4E0E\u9884\u89C8 URL\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "\u753B\u9762\u63CF\u8FF0\uFF1B\u5199\u6E05\u4E3B\u4F53\u3001\u98CE\u683C\u3001\u6784\u56FE\u3001\u5149\u7EBF" },
        negative: { type: "string", description: "\u8D1F\u9762\u63D0\u793A\u8BCD\uFF08\u90E8\u5206\u901A\u9053\u652F\u6301\uFF09" },
        n: { type: "integer", minimum: 1, maximum: 10, description: "\u5F20\u6570\uFF0C\u9ED8\u8BA4 1" },
        channel: { type: "string", description: "\u901A\u9053 id \u6216\u540D\u79F0\uFF1B\u7701\u7565\u7528\u9ED8\u8BA4\u56FE\u50CF\u901A\u9053" },
        model: { type: "string", description: "\u6A21\u578B id\uFF1B\u7701\u7565\u7528\u901A\u9053\u9ED8\u8BA4\u6A21\u578B" },
        size: { type: "string", description: "\u50CF\u7D20\u5C3A\u5BF8\uFF0C\u5982 1024x1024\uFF1B\u4E0E aspect_ratio \u4E8C\u9009\u4E00" },
        aspect_ratio: { type: "string", enum: ["1:1", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4", "16:9", "9:16", "21:9"] },
        quality: { type: "string", description: "quality\uFF08OpenAI \u901A\u9053\uFF1Alow/medium/high\uFF09" },
        refs: {
          oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          description: "\u53C2\u8003\u56FE\uFF1A\u7D20\u6750\u5E93 id\u3001\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u6216\u5DE5\u4F5C\u533A\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF1B\u6700\u591A 5 \u5F20"
        },
        wait: { type: "boolean", description: "true = \u963B\u585E\u5230\u51FA\u56FE\uFF08\u9ED8\u8BA4 false\uFF09" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const job = studio.startImage({
        prompt: asString(args.prompt),
        channel: asString(args.channel) || void 0,
        model: asString(args.model) || void 0,
        negative: asString(args.negative) || void 0,
        size: asString(args.size) || void 0,
        aspectRatio: asString(args.aspect_ratio) || void 0,
        quality: asString(args.quality) || void 0,
        n: asInt(args.n, 1, 1, 10),
        refs: asStringArray(args.refs)
      });
      return waitFor(job, args.wait === true, 5 * 6e4);
    }
  };
  const videoTool = {
    name: "media_generate_video",
    description: "\u751F\u6210\u89C6\u9891\uFF1A\u6587\u751F\u89C6\u9891\u3001\u56FE\u751F\u89C6\u9891\u3001\u9996\u5C3E\u5E27\u3001\u591A\u53C2\u8003\u56FE\u3002\u9ED8\u8BA4\u5F02\u6B65\u8FD4\u56DE jobId\uFF1B\u4E91\u7AEF\u6E32\u67D3\u901A\u5E38 1\u201310 \u5206\u949F\uFF0C\u7528 media_job \u67E5\u8BE2\u3002mode \u7701\u7565\u65F6\u6309\u53C2\u8003\u56FE\u6570\u91CF\u63A8\u65AD\uFF080=text\uFF0C1=image\uFF0C2=keyframe\uFF09\u3002\u8F93\u51FA\u4E3A mp4 \u5E76\u5199\u5165\u7D20\u6750\u5E93\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "\u955C\u5934\u63CF\u8FF0\uFF1A\u4E3B\u4F53\u52A8\u4F5C\u3001\u8FD0\u955C\u3001\u5149\u7EBF\u3001\u65F6\u957F\u5185\u7684\u53D8\u5316" },
        mode: { type: "string", enum: ["text", "image", "keyframe", "reference"] },
        refs: {
          oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }],
          description: "\u53C2\u8003\u56FE\uFF080\u20135 \u5F20\uFF09\uFF1A\u7D20\u6750\u5E93 id \u6216\u672C\u673A\u8DEF\u5F84\u3002keyframe \u6A21\u5F0F\u987A\u5E8F\u4E3A\u9996\u5E27\u3001\u5C3E\u5E27"
        },
        seconds: { type: "number", description: "\u65F6\u957F\uFF08\u79D2\uFF09\uFF0C\u9ED8\u8BA4 5\uFF1B\u5404\u901A\u9053\u4F1A\u5939\u5230\u81EA\u5DF1\u7684\u8303\u56F4" },
        resolution: { type: "string", description: "480P / 720P / 1080P\uFF0C\u9ED8\u8BA4 720P" },
        aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"] },
        channel: { type: "string" },
        model: { type: "string" },
        negative: { type: "string" },
        wait: { type: "boolean", description: "true = \u963B\u585E\u5230\u6E32\u67D3\u5B8C\u6210\uFF08\u6700\u957F 40 \u5206\u949F\uFF09" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const job = studio.startVideo({
        prompt: asString(args.prompt),
        channel: asString(args.channel) || void 0,
        model: asString(args.model) || void 0,
        negative: asString(args.negative) || void 0,
        mode: asString(args.mode) || void 0,
        refs: asStringArray(args.refs),
        seconds: typeof args.seconds === "number" ? args.seconds : void 0,
        resolution: asString(args.resolution) || void 0,
        aspectRatio: asString(args.aspect_ratio) || void 0
      });
      return waitFor(job, args.wait === true, studio.getConfig().videoTimeoutMs);
    }
  };
  const comfyListTool = {
    name: "media_comfy_workflows",
    description: "\u5217\u51FA/\u67E5\u770B\u672C\u673A\u5BFC\u5165\u7684 ComfyUI \u5DE5\u4F5C\u6D41\uFF08API \u683C\u5F0F\uFF09\u3002\u6BCF\u9879\u542B id\u3001\u6807\u9898\u3001\u5907\u6CE8\u3001\u53EF\u586B\u53D8\u91CF\uFF08prompt/negative/width/height/seed/\u2026\uFF09\u3001\u56FE\u7247\u69FD\u4F4D\u4E0E\u8F93\u51FA\u8282\u70B9\u3002action=inspect \u4F20 workflowId \u53EF\u770B\u5355\u4E2A\u5DE5\u4F5C\u6D41\u7684\u5B8C\u6574\u53D8\u91CF\u9ED8\u8BA4\u503C\u3002\u7528\u6237\u6CA1\u6307\u5B9A\u5DE5\u4F5C\u6D41\u65F6\u5148\u5217\u51FA\u6765\u6311\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["list", "inspect"], description: "\u9ED8\u8BA4 list" },
        workflowId: { type: "string", description: "inspect \u65F6\u8981\u770B\u7684\u5DE5\u4F5C\u6D41 id" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const action = asString(args.action, "list");
      const listed = studio.comfyWorkflows();
      const online = await studio.comfyOnline();
      if (action === "inspect") {
        const id = asString(args.workflowId);
        const found = listed.workflows.find((item) => item.workflowId === id);
        if (found === void 0) throw new Error(`\u6CA1\u6709\u5DE5\u4F5C\u6D41 ${id}\uFF1B\u5148 action=list \u770B\u770B\u6709\u54EA\u4E9B`);
        return { ok: true, workflow: found, comfyui: { online: online.online } };
      }
      return {
        ok: true,
        count: listed.workflows.length,
        workflows: listed.workflows.map((item) => ({
          workflowId: item.workflowId,
          title: item.title,
          description: item.description,
          enabled: item.enabled,
          variables: item.slots.map((slot) => ({ name: slot.name, type: slot.type, required: slot.required, ...slot.value === void 0 ? {} : { default: slot.value } })),
          outputs: item.outputs.map((output) => output.kind)
        })),
        ...listed.broken.length > 0 ? { broken: listed.broken } : {},
        comfyui: { online: online.online, ...online.detail === void 0 ? {} : { detail: online.detail } },
        ...listed.workflows.length === 0 ? { hint: "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u6D41\u3002\u5728\u9762\u677F\u300CComfyUI\u300D\u9875\u7B7E\u5BFC\u5165\u4E00\u4EFD API \u683C\u5F0F JSON\uFF08ComfyUI \u2192 Save (API Format)\uFF09\uFF0C\u6216\u628A\u6587\u4EF6\u653E\u8FDB ~/.dsh-media-studio/workflows/" } : {}
      };
    }
  };
  const comfyRunTool = {
    name: "media_comfy_run",
    description: "\u8FD0\u884C\u4E00\u4E2A ComfyUI \u5DE5\u4F5C\u6D41\u3002vars \u91CC\u653E\u53D8\u91CF\uFF08\u5982 prompt\u3001negative\u3001width\u3001height\u3001seed\uFF09\uFF1Bimages \u4F20\u53C2\u8003\u56FE\uFF0C\u6309\u5DE5\u4F5C\u6D41\u7684\u56FE\u7247\u69FD\u4F4D\u987A\u5E8F\u6216 {slot, path} \u6307\u5B9A\u3002\u9ED8\u8BA4\u5F02\u6B65\u8FD4\u56DE jobId\uFF1Bwait=true \u4F1A\u7B49\u5230\u4EA7\u7269\u843D\u76D8\u3002\u5DE5\u4F5C\u6D41\u9700\u8981 ComfyUI \u5728\u7EBF\uFF0C\u79BB\u7EBF\u65F6\u4EFB\u52A1\u4F1A\u76F4\u63A5\u5931\u8D25\u800C\u4E0D\u662F\u5047\u88C5\u6392\u961F\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["workflowId"],
      properties: {
        workflowId: { type: "string" },
        vars: { type: "object", additionalProperties: true, description: "\u53D8\u91CF\u8868\uFF1B\u7701\u7565\u5219\u7528\u5DE5\u4F5C\u6D41\u91CC\u7684\u9ED8\u8BA4\u503C" },
        images: {
          oneOf: [
            { type: "array", items: { type: "string" } },
            { type: "array", items: { type: "object", additionalProperties: true, required: ["path"], properties: { slot: { type: "string" }, path: { type: "string" } } } },
            { type: "string" }
          ],
          description: '\u53C2\u8003\u56FE\uFF08\u7D20\u6750\u5E93 id \u6216\u8DEF\u5F84\uFF09\uFF0C\u53EF\u5199 "6.image" \u4E4B\u5916\u7684\u69FD\u4F4D\u540D'
        },
        overrides: { type: "object", additionalProperties: true, description: '\u9AD8\u7EA7\uFF1A{"\u8282\u70B9id.\u8F93\u5165\u540D": \u503C}\uFF0C\u76F4\u63A5\u6539\u8282\u70B9\u53C2\u6570' },
        wait: { type: "boolean" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const imagesRaw = args.images;
      const images = [];
      if (Array.isArray(imagesRaw)) {
        for (const item of imagesRaw) {
          if (typeof item === "string") {
            images.push(item);
            continue;
          }
          if (item !== null && typeof item === "object" && typeof item.path === "string") {
            const slot = item.slot;
            images.push({ path: item.path, ...typeof slot === "string" ? { slot } : {} });
          }
        }
      } else {
        images.push(...asStringArray(imagesRaw));
      }
      const job = studio.startComfy({
        workflowId: asString(args.workflowId),
        vars: asRecord(args.vars),
        overrides: asRecord(args.overrides),
        images
      });
      return waitFor(job, args.wait === true, studio.getConfig().comfyTimeoutMs);
    }
  };
  const jobTool = {
    name: "media_job",
    description: "\u67E5\u8BE2/\u7B49\u5F85/\u53D6\u6D88\u5A92\u4F53\u4EFB\u52A1\u3002action=list \u5217\u51FA\u6700\u8FD1\u4EFB\u52A1\uFF1Bget \u67E5\u5355\u4E2A\uFF1Bwait \u963B\u585E\u5230\u5B8C\u6210\uFF1Bcancel \u53D6\u6D88\uFF08\u4E91\u7AEF\u6E32\u67D3\u53EF\u80FD\u4ECD\u5728\u8BA1\u8D39\uFF09\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["list", "get", "wait", "cancel"], description: "\u9ED8\u8BA4 list" },
        jobId: { type: "string" },
        state: { type: "string", enum: ["queued", "running", "succeeded", "failed", "cancelled"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        timeoutMs: { type: "integer", minimum: 1e3, maximum: 24e5, description: "wait \u7684\u4E0A\u9650\uFF0C\u9ED8\u8BA4 120000" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const action = asString(args.action, "list");
      const jobId = asString(args.jobId);
      if (action === "list") {
        const jobs = studio.jobs.list({ state: asString(args.state) || void 0, limit: asInt(args.limit, 10, 1, 50) });
        return { ok: true, count: jobs.length, jobs: jobs.map(jobView) };
      }
      if (jobId === "") throw new Error(`${action} \u9700\u8981 jobId`);
      if (action === "cancel") {
        const ok = studio.jobs.cancel(jobId);
        return { ok, jobId, state: studio.jobs.stateOf(jobId), hint: "\u5DF2\u5728\u672C\u673A\u53D6\u6D88\uFF1B\u4E91\u7AEF\u4EFB\u52A1\u672A\u5FC5\u771F\u7684\u505C\u6B62\u8BA1\u8D39\u3002" };
      }
      if (action === "wait") {
        const job2 = await studio.jobs.wait(jobId, asInt(args.timeoutMs, 12e4, 1e3, 24e5));
        const view2 = jobView(job2);
        const attachments2 = await studio.attach(job2.assets ?? []);
        if (attachments2.length > 0) view2.__attachments = attachments2;
        return view2;
      }
      const job = studio.jobs.get(jobId);
      if (job === void 0) throw new Error(`\u6CA1\u6709\u4EFB\u52A1 ${jobId}`);
      const view = jobView(job);
      const attachments = await studio.attach(job.assets ?? []);
      if (attachments.length > 0) view.__attachments = attachments;
      return view;
    }
  };
  const libraryTool = {
    name: "media_library",
    description: "\u7D20\u6750\u5E93\uFF1A\u641C\u7D22/\u6D4F\u89C8\u5DF2\u751F\u6210\u7684\u56FE\u7247\u4E0E\u89C6\u9891\u3001\u67E5\u770B\u8BE6\u60C5\u3001\u6536\u85CF\u3001\u5220\u9664\u3001\u628A\u672C\u673A\u6587\u4EF6\u767B\u8BB0\u8FDB\u6765\u3002\u8FD4\u56DE\u6761\u76EE\u542B id\u3001\u672C\u5730 path\u3001\u9884\u89C8 url \u4E0E\u751F\u6210\u53C2\u6570\uFF1B\u628A id \u4F20\u7ED9 media_generate_image \u7684 refs \u5373\u53EF\u5F53\u53C2\u8003\u56FE\u7EE7\u7EED\u7F16\u8F91\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["list", "get", "import", "favorite", "delete", "stats"], description: "\u9ED8\u8BA4 list" },
        query: { type: "string", description: "\u6309\u63D0\u793A\u8BCD/\u6587\u4EF6\u540D/\u6A21\u578B/\u6807\u7B7E\u641C\u7D22" },
        kind: { type: "string", enum: ["image", "video", "audio", "all"] },
        favorite: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0 },
        id: { type: "string" },
        path: { type: "string", description: "import \u65F6\u7684\u672C\u673A\u8DEF\u5F84" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const action = asString(args.action, "list");
      if (action === "stats") return { ok: true, ...studio.libraryStats() };
      if (action === "import") {
        const file = asString(args.path);
        if (file === "") throw new Error("import \u9700\u8981 path");
        const asset = studio.importAsset(file);
        return { ok: true, asset: assetView(asset) };
      }
      if (action === "get") {
        const id = asString(args.id);
        const asset = studio.getLibrary().get(id);
        if (asset === void 0) throw new Error(`\u6CA1\u6709\u7D20\u6750 ${id}`);
        return { ok: true, asset: assetView(asset) };
      }
      if (action === "favorite") {
        const id = asString(args.id);
        const asset = studio.getLibrary().setFavorite(id, args.favorite !== false);
        if (asset === void 0) throw new Error(`\u6CA1\u6709\u7D20\u6750 ${id}`);
        return { ok: true, asset: assetView(asset) };
      }
      if (action === "delete") {
        const id = asString(args.id);
        const ok = studio.getLibrary().remove(id, { deleteFile: true });
        return { ok, id };
      }
      const listed = studio.getLibrary().list({
        query: asString(args.query) || void 0,
        kind: asString(args.kind) || void 0,
        favorite: args.favorite === true ? true : void 0,
        limit: asInt(args.limit, 40, 1, 200),
        offset: asInt(args.offset, 0, 0, 1e5)
      });
      return { ok: true, total: listed.total, count: listed.items.length, items: listed.items.map(assetView) };
    }
  };
  const storyboardTool = {
    name: "media_storyboard",
    description: "\u4E00\u53E5\u8BDD\u62C6\u6210\u5206\u955C\u5E76\u6279\u91CF\u751F\u6210\u89C6\u9891\uFF1A\u6BCF\u955C\u4E00\u6761 prompt\uFF0C\u6309\u987A\u5E8F\u6E32\u67D3\uFF1Bchain=true \u65F6\u53D6\u4E0A\u4E00\u955C\u5C3E\u5E27\u4F5C\u4E3A\u4E0B\u4E00\u955C\u9996\u5E27\uFF08\u9700\u8981 ffmpeg\uFF0C\u753B\u9762\u66F4\u8FDE\u8D2F\uFF09\uFF1Bconcat=true \u65F6\u81EA\u52A8\u7528\u672C\u673A ffmpeg \u62FC\u6210\u4E00\u6761\u6210\u7247\u3002\u9ED8\u8BA4\u5F02\u6B65\uFF0C\u5148\u8FD4\u56DE jobId\uFF0C\u955C\u5934\u72B6\u6001\u53EF\u5728 media_job \u91CC\u770B\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["shots"],
      properties: {
        shots: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["prompt"],
            properties: {
              prompt: { type: "string" },
              seconds: { type: "number" },
              ref: { type: "string", description: "\u8BE5\u955C\u7684\u53C2\u8003\u56FE\uFF08\u7D20\u6750\u5E93 id \u6216\u8DEF\u5F84\uFF09" }
            }
          }
        },
        style: { type: "string", description: "\u7EDF\u4E00\u98CE\u683C\u524D\u7F00\uFF0C\u4F1A\u62FC\u5230\u6BCF\u955C prompt \u524D\u9762" },
        chain: { type: "boolean", description: "\u63A5\u4E0A\u4E00\u955C\u5C3E\u5E27\uFF08\u9ED8\u8BA4 false\uFF09" },
        concat: { type: "boolean", description: "\u81EA\u52A8\u62FC\u63A5\u6210\u7247\uFF08\u9ED8\u8BA4 true\uFF09" },
        seconds: { type: "number", description: "\u6BCF\u955C\u9ED8\u8BA4\u65F6\u957F" },
        resolution: { type: "string" },
        aspect_ratio: { type: "string" },
        channel: { type: "string" },
        model: { type: "string" },
        wait: { type: "boolean" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const raw = Array.isArray(args.shots) ? args.shots : [];
      const shots = raw.flatMap((item) => {
        if (item === null || typeof item !== "object") return [];
        const shot = item;
        const prompt = asString(shot.prompt);
        if (prompt.trim() === "") return [];
        return [{
          prompt,
          ...typeof shot.seconds === "number" ? { seconds: shot.seconds } : {},
          ...typeof shot.ref === "string" && shot.ref !== "" ? { ref: shot.ref } : {}
        }];
      });
      const job = studio.startStoryboard({
        shots,
        style: asString(args.style) || void 0,
        chain: args.chain === true,
        concat: args.concat !== false,
        seconds: typeof args.seconds === "number" ? args.seconds : void 0,
        resolution: asString(args.resolution) || void 0,
        aspectRatio: asString(args.aspect_ratio) || void 0,
        channel: asString(args.channel) || void 0,
        model: asString(args.model) || void 0
      });
      return waitFor(job, args.wait === true, studio.getConfig().videoTimeoutMs);
    }
  };
  const concatTool = {
    name: "media_concat",
    description: "\u7528\u672C\u673A ffmpeg \u628A\u4E24\u6BB5\u4EE5\u4E0A\u89C6\u9891\u62FC\u6210\u4E00\u6761 MP4\uFF08\u7EDF\u4E00\u5C3A\u5BF8/\u5E27\u7387\u540E\u62FC\u63A5\uFF0C\u65E0\u97F3\u8F68\uFF09\u3002\u4F20\u7D20\u6750\u5E93 id \u6216\u672C\u673A\u8DEF\u5F84\u3002\u4E0D\u6D88\u8017\u4EFB\u4F55\u6A21\u578B\u989D\u5EA6\u3002",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["inputs"],
      properties: {
        inputs: { oneOf: [{ type: "array", items: { type: "string" } }, { type: "string" }], description: "\u4E24\u6BB5\u4EE5\u4E0A\u89C6\u9891\uFF1A\u7D20\u6750\u5E93 id \u6216\u8DEF\u5F84" },
        size: { type: "string", description: "\u8F93\u51FA\u5C3A\u5BF8\uFF0C\u5982 1280x720\uFF1B\u7701\u7565\u6CBF\u7528\u7B2C\u4E00\u6BB5\u7684\u5C3A\u5BF8\uFF08\u957F\u8FB9\u4E0A\u9650 1920\uFF09" },
        wait: { type: "boolean" }
      }
    },
    output: jsonOutput(),
    async execute(args) {
      const inputs = asStringArray(args.inputs).map((id) => {
        const asset = studio.getLibrary().get(id);
        return asset?.kind === "video" ? asset.id : id;
      });
      if (inputs.length < 2) throw new Error("\u81F3\u5C11\u9700\u8981\u4E24\u6BB5\u89C6\u9891");
      const job = studio.startConcat({ ids: inputs, ...asString(args.size) === "" ? {} : { size: asString(args.size) } });
      return waitFor(job, args.wait !== false, 10 * 6e4);
    }
  };
  return [channelsTool, imageTool, videoTool, comfyListTool, comfyRunTool, jobTool, libraryTool, storyboardTool, concatTool];
}
function sanitizeToolValue(value) {
  if (value === null) return null;
  if (value === void 0) return void 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const clean = sanitizeToolValue(item);
      return clean === void 0 ? null : clean;
    });
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      const clean = sanitizeToolValue(item);
      if (clean !== void 0) out[key] = clean;
    }
    return out;
  }
  return value;
}
function sanitizeTool(spec) {
  return {
    ...spec,
    execute: async (args, exec) => {
      const value = await spec.execute(args, exec);
      if (value !== null && typeof value === "object" && Array.isArray(value.__attachments)) {
        const { __attachments, ...rest } = value;
        const clean = sanitizeToolValue(rest);
        if (clean !== null && typeof clean === "object") clean.__attachments = __attachments;
        return clean;
      }
      return sanitizeToolValue(value);
    }
  };
}
function registerTools(studio, ctx, tools) {
  const registered = [];
  const failed = [];
  for (const spec of buildTools(studio, ctx)) {
    try {
      tools.register(sanitizeTool(spec));
      registered.push(spec.name);
    } catch (error) {
      failed.push({ name: spec.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { registered, failed };
}

// src/host/routes.ts
var MAX_BODY = 32 * 1024 * 1024;
function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}
async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY) throw new Error("\u8BF7\u6C42\u4F53\u592A\u5927");
    chunks.push(buffer);
  }
  if (bytes === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON");
  }
}
function serveFile(req, res, file) {
  let stat;
  try {
    stat = fs9.statSync(file);
  } catch {
    sendJson(res, 404, { ok: false, message: "\u6587\u4EF6\u5DF2\u4E0D\u5728\u78C1\u76D8\u4E0A" });
    return;
  }
  const mime = mimeOf(file);
  const range = req.headers.range;
  const baseHeaders = {
    "content-type": mime,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=60"
  };
  if (range === void 0) {
    res.writeHead(200, { ...baseHeaders, "content-length": stat.size });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs9.createReadStream(file).pipe(res);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (match === null) {
    res.writeHead(416, { ...baseHeaders, "content-range": `bytes */${String(stat.size)}` });
    res.end();
    return;
  }
  const start = match[1] === "" ? void 0 : Number(match[1]);
  const end = match[2] === "" ? void 0 : Number(match[2]);
  const from = start ?? Math.max(0, stat.size - (end ?? 0));
  const to = start === void 0 ? stat.size - 1 : Math.min(end ?? stat.size - 1, stat.size - 1);
  if (from > to || from >= stat.size) {
    res.writeHead(416, { ...baseHeaders, "content-range": `bytes */${String(stat.size)}` });
    res.end();
    return;
  }
  res.writeHead(206, {
    ...baseHeaders,
    "content-range": `bytes ${String(from)}-${String(to)}/${String(stat.size)}`,
    "content-length": to - from + 1
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs9.createReadStream(file, { start: from, end: to }).pipe(res);
}
function createRoutes(studio, ctx) {
  const guard = (handler) => handler;
  const routes = [
    { method: "GET", pattern: /^\/$/, handler: () => ({ ok: true, plugin: "dsh-media-studio", version: "0.1.0" }) },
    {
      method: "GET",
      pattern: /^\/config$/,
      handler: () => ({
        ok: true,
        config: publicConfig(studio),
        outputDir: studio.getOutputDir(),
        diagnostics: studio.diagnostics()
      })
    },
    {
      method: "POST",
      pattern: /^\/config$/,
      handler: async ({ body }) => {
        const patch = { ...body };
        patch.channels = studio.maskIncomingChannels(patch.channels);
        studio.updateConfig(patch);
        return { ok: true, config: publicConfig(studio) };
      }
    },
    { method: "GET", pattern: /^\/channels$/, handler: () => ({ ok: true, channels: studio.channels() }) },
    {
      method: "POST",
      pattern: /^\/channels\/test$/,
      handler: async ({ body }) => {
        const id = typeof body.id === "string" ? body.id : "";
        const result = await studio.testChannel(id);
        return { ok: result.ok, detail: result.detail, message: result.detail, latencyMs: result.latencyMs };
      }
    },
    {
      method: "GET",
      pattern: /^\/jobs$/,
      handler: ({ url }) => {
        const state = url.searchParams.get("state") ?? void 0;
        const kind = url.searchParams.get("kind") ?? void 0;
        const limit = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
        return { ok: true, jobs: studio.jobs.list({ ...state === void 0 ? {} : { state }, ...kind === void 0 ? {} : { kind }, limit: Number.isFinite(limit) ? limit : 30 }).map(jobView) };
      }
    },
    {
      method: "GET",
      pattern: /^\/jobs\/([^/]+)$/,
      handler: ({ params }) => {
        const job = studio.jobs.get(params[0]);
        if (job === void 0) return { status: 404, json: { ok: false, message: "\u4EFB\u52A1\u4E0D\u5B58\u5728" } };
        return { ok: true, job: jobView(job), raw: publicJob(job) };
      }
    },
    {
      method: "POST",
      pattern: /^\/jobs\/([^/]+)\/cancel$/,
      handler: ({ params }) => ({ ok: studio.jobs.cancel(params[0]), state: studio.jobs.stateOf(params[0]) })
    },
    {
      method: "POST",
      pattern: /^\/generate\/image$/,
      handler: async ({ body }) => {
        const job = studio.startImage({
          prompt: String(body.prompt ?? ""),
          channel: optional(body.channel),
          model: optional(body.model),
          negative: optional(body.negative),
          size: optional(body.size),
          aspectRatio: optional(body.aspectRatio),
          quality: optional(body.quality),
          n: typeof body.n === "number" ? body.n : void 0,
          refs: stringArray(body.refs)
        });
        return { ok: true, job: jobView(job) };
      }
    },
    {
      method: "POST",
      pattern: /^\/generate\/video$/,
      handler: async ({ body }) => {
        const job = studio.startVideo({
          prompt: String(body.prompt ?? ""),
          channel: optional(body.channel),
          model: optional(body.model),
          mode: optional(body.mode),
          refs: stringArray(body.refs),
          seconds: typeof body.seconds === "number" ? body.seconds : void 0,
          resolution: optional(body.resolution),
          aspectRatio: optional(body.aspectRatio),
          negative: optional(body.negative)
        });
        return { ok: true, job: jobView(job) };
      }
    },
    {
      method: "POST",
      pattern: /^\/storyboard$/,
      handler: async ({ body }) => {
        const shots = Array.isArray(body.shots) ? body.shots.flatMap((item) => {
          if (item === null || typeof item !== "object") return [];
          const shot = item;
          const prompt = String(shot.prompt ?? "").trim();
          if (prompt === "") return [];
          return [{ prompt, ...typeof shot.seconds === "number" ? { seconds: shot.seconds } : {}, ...typeof shot.ref === "string" && shot.ref !== "" ? { ref: shot.ref } : {} }];
        }) : [];
        const job = studio.startStoryboard({
          shots,
          style: optional(body.style),
          chain: body.chain === true,
          concat: body.concat !== false,
          seconds: typeof body.seconds === "number" ? body.seconds : void 0,
          resolution: optional(body.resolution),
          aspectRatio: optional(body.aspectRatio),
          channel: optional(body.channel),
          model: optional(body.model)
        });
        return { ok: true, job: jobView(job) };
      }
    },
    {
      method: "POST",
      pattern: /^\/concat$/,
      handler: async ({ body }) => {
        const job = studio.startConcat({ ids: stringArray(body.ids), ...optional(body.size) === void 0 ? {} : { size: optional(body.size) } });
        return { ok: true, job: jobView(job) };
      }
    },
    {
      method: "POST",
      pattern: /^\/comfy\/run$/,
      handler: async ({ body }) => {
        const images = [];
        if (Array.isArray(body.images)) {
          for (const item of body.images) {
            if (typeof item === "string") {
              images.push(item);
              continue;
            }
            if (item !== null && typeof item === "object" && typeof item.path === "string") {
              const slot = item.slot;
              images.push({ path: item.path, ...typeof slot === "string" ? { slot } : {} });
            }
          }
        }
        const job = studio.startComfy({
          workflowId: String(body.workflowId ?? ""),
          vars: body.vars !== null && typeof body.vars === "object" ? body.vars : {},
          overrides: body.overrides !== null && typeof body.overrides === "object" ? body.overrides : {},
          images
        });
        return { ok: true, job: jobView(job) };
      }
    },
    { method: "GET", pattern: /^\/comfy\/status$/, handler: async () => ({ ok: true, status: await studio.comfyOnline() }) },
    {
      method: "GET",
      pattern: /^\/comfy\/workflows$/,
      handler: async () => {
        const listed = studio.comfyWorkflows();
        const online = await studio.comfyOnline();
        return { ok: true, workflows: listed.workflows, broken: listed.broken, online: online.online, detail: online.detail };
      }
    },
    {
      method: "POST",
      pattern: /^\/comfy\/import$/,
      handler: async ({ body }) => {
        const json = typeof body.json === "string" ? body.json : "";
        const file = typeof body.path === "string" ? body.path : "";
        if (json !== "") {
          const surface = studio.importWorkflow({
            json,
            ...typeof body.id === "string" ? { id: body.id } : {},
            ...typeof body.title === "string" ? { title: body.title } : {},
            ...typeof body.description === "string" ? { description: typeof body.description === "string" ? body.description : "" } : {}
          });
          return { ok: true, workflow: surface };
        }
        if (file !== "") return { ok: true, workflow: studio.importWorkflowFile(file, typeof body.title === "string" ? body.title : void 0) };
        return { status: 400, json: { ok: false, message: "\u9700\u8981 json \u6216 path" } };
      }
    },
    {
      method: "POST",
      pattern: /^\/comfy\/workflows\/([^/]+)$/,
      handler: ({ params, body }) => ({
        ok: true,
        workflow: studio.setWorkflowMeta(decodeURIComponent(params[0]), {
          ...typeof body.enabled === "boolean" ? { enabled: body.enabled } : {},
          ...typeof body.title === "string" ? { title: body.title } : {},
          ...typeof body.description === "string" ? { description: body.description } : {}
        })
      })
    },
    {
      method: "DELETE",
      pattern: /^\/comfy\/workflows\/([^/]+)$/,
      handler: ({ params }) => ({ ok: studio.removeWorkflow(decodeURIComponent(params[0])) })
    },
    {
      method: "GET",
      pattern: /^\/library$/,
      handler: ({ url }) => {
        const limit = Number.parseInt(url.searchParams.get("limit") ?? "60", 10);
        const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
        const favorite = url.searchParams.get("favorite");
        const listed = studio.getLibrary().list({
          query: url.searchParams.get("query") ?? void 0,
          kind: url.searchParams.get("kind") ?? void 0,
          favorite: favorite === "1" || favorite === "true" ? true : void 0,
          limit: Number.isFinite(limit) ? limit : 60,
          offset: Number.isFinite(offset) ? offset : 0
        });
        return { ok: true, total: listed.total, items: listed.items.map(assetView) };
      }
    },
    {
      method: "POST",
      pattern: /^\/library\/scan$/,
      handler: () => ({ ok: true, added: studio.getLibrary().scan(1e3) })
    },
    {
      method: "POST",
      pattern: /^\/library\/import$/,
      handler: async ({ body }) => {
        if (typeof body.dataUrl === "string") {
          return { ok: true, asset: assetView(studio.importBase64(body.dataUrl, typeof body.name === "string" ? body.name : void 0)) };
        }
        const file = typeof body.path === "string" ? body.path : "";
        if (file === "") return { status: 400, json: { ok: false, message: "\u9700\u8981 path \u6216 dataUrl" } };
        return { ok: true, asset: assetView(studio.importAsset(file)) };
      }
    },
    {
      method: "POST",
      pattern: /^\/library\/([^/]+)\/favorite$/,
      handler: ({ params, body }) => {
        const asset = studio.getLibrary().setFavorite(decodeURIComponent(params[0]), body.favorite !== false);
        if (asset === void 0) return { status: 404, json: { ok: false, message: "\u7D20\u6750\u4E0D\u5B58\u5728" } };
        return { ok: true, asset: assetView(asset) };
      }
    },
    {
      method: "DELETE",
      pattern: /^\/library\/([^/]+)$/,
      handler: ({ params }) => ({ ok: studio.getLibrary().remove(decodeURIComponent(params[0]), { deleteFile: true }) })
    },
    {
      method: "GET",
      pattern: /^\/asset\/([^/]+)$/,
      handler: ({ params }) => {
        const asset = studio.getLibrary().get(decodeURIComponent(params[0]));
        if (asset === void 0) return { status: 404, json: { ok: false, message: "\u7D20\u6750\u4E0D\u5B58\u5728" } };
        if (!fs9.existsSync(asset.path)) return { status: 404, json: { ok: false, message: "\u6587\u4EF6\u5DF2\u4E0D\u5728\u78C1\u76D8\u4E0A" } };
        return { file: asset.path };
      }
    },
    {
      method: "GET",
      pattern: /^\/stats$/,
      handler: () => ({ ok: true, ...studio.libraryStats(), ...studio.diagnostics() })
    },
    {
      method: "POST",
      pattern: /^\/reveal$/,
      handler: ({ body }) => {
        const file = typeof body.path === "string" ? body.path : "";
        if (file === "") return { status: 400, json: { ok: false, message: "\u9700\u8981 path" } };
        const asset = studio.getLibrary().getByPath(file);
        if (asset === void 0) assertImportable(studio.getConfig(), ctx, file);
        return { ok: true, path: file, dir: path9.dirname(file) };
      }
    }
  ];
  async function dispatch(req, res) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const sub = url.pathname.slice(API_BASE.length) || "/";
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-methods": "GET,POST,DELETE,OPTIONS", "access-control-allow-headers": "content-type" });
      res.end();
      return;
    }
    const method = req.method === "HEAD" ? "GET" : req.method ?? "GET";
    let matched;
    let methodMismatch = false;
    for (const route of routes) {
      const match = route.pattern.exec(sub);
      if (match === null) continue;
      if (route.method !== method) {
        methodMismatch = true;
        continue;
      }
      matched = { route, params: match.slice(1) };
      break;
    }
    if (matched === void 0) {
      sendJson(res, methodMismatch ? 405 : 404, { ok: false, message: methodMismatch ? "\u65B9\u6CD5\u4E0D\u5141\u8BB8" : `\u6CA1\u6709\u8FD9\u4E2A\u63A5\u53E3\uFF1A${sub}` });
      return;
    }
    try {
      const body = method === "POST" ? await readBody(req) : {};
      const result = await guard(matched.route.handler)({ params: matched.params, body, url, req, res });
      if (typeof result === "object" && result !== null && "file" in result) {
        serveFile(req, res, result.file);
        return;
      }
      const status = typeof result === "object" && result !== null && typeof result.status === "number" ? result.status : 200;
      const json = typeof result === "object" && result !== null && "json" in result ? result.json : result;
      sendJson(res, status, json);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 400, { ok: false, message });
    }
  }
  return { dispatch };
}
function optional(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function stringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim() !== "");
  if (typeof value === "string" && value.trim() !== "") return value.split(",").map((item) => item.trim()).filter((item) => item !== "");
  return [];
}
function publicConfig(studio) {
  const config = studio.getConfig();
  return {
    ...config,
    channels: studio.channels().map((channel) => ({
      ...channel,
      apiKey: channel.keySource === "inline" ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : void 0
    }))
  };
}
function publicJob(job) {
  return { ...job, assets: (job.assets ?? []).map(assetView) };
}

// src/host/index.ts
var name = "dsh-media-studio";
var inject = ["webServer", "tools"];
var SHARED_PROP = "__dshMediaStudio";
function sharedOf(ctx) {
  const anchor = ctx.root ?? ctx;
  let slot = anchor[SHARED_PROP];
  if (slot === void 0) {
    slot = {};
    anchor[SHARED_PROP] = slot;
  }
  return slot;
}
function apply(ctx, config) {
  const shared = sharedOf(ctx);
  ensureDataLayout();
  let service = shared.service;
  if (service === void 0) {
    service = new StudioService(ctx, config);
    shared.service = service;
  } else {
    service.setEntryConfig(config);
  }
  const server = ctx.get?.("webServer");
  if (server === void 0 || typeof server.register !== "function") {
    service.logger.warn("[media-studio] \u62FF\u4E0D\u5230 webServer\uFF0C\u9762\u677F\u63A5\u53E3\u672A\u6CE8\u518C");
  } else if (shared.disposeHttp === void 0) {
    try {
      const routes = createRoutes(service, ctx);
      const dispose = server.register({ kind: "prefix", path: API_BASE, handler: routes.dispatch });
      shared.disposeHttp = typeof dispose === "function" ? dispose : () => void 0;
      service.logger.info(`[media-studio] API \u5C31\u7EEA\uFF1A${API_BASE}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("duplicate prefix route")) {
        service.logger.info("[media-studio] HTTP \u524D\u7F00\u5DF2\u5B58\u5728\uFF08\u70ED\u91CD\u8F7D\uFF09\uFF0C\u6CBF\u7528\u73B0\u6709\u5B9E\u4F8B");
      } else {
        service.logger.warn(`[media-studio] \u6CE8\u518C HTTP \u524D\u7F00\u5931\u8D25\uFF1A${message}`);
      }
    }
  }
  const tools = ctx.get?.("tools");
  if (tools === void 0 || typeof tools.register !== "function") {
    service.logger.warn("[media-studio] \u62FF\u4E0D\u5230 tools \u670D\u52A1\uFF0CAgent \u5DE5\u5177\u672A\u6CE8\u518C");
  } else {
    const report = registerTools(service, ctx, { register: (spec) => tools.register(spec) });
    for (const failure2 of report.failed) service.logger.warn(`[media-studio] \u5DE5\u5177 ${failure2.name} \u672A\u6CE8\u518C\uFF1A${failure2.message}`);
    service.logger.info(`[media-studio] \u5DF2\u6CE8\u518C\u5DE5\u5177\uFF1A${report.registered.join(", ")}`);
  }
  if (typeof ctx.effect === "function") {
    ctx.effect(() => () => {
      shared.disposeHttp?.();
      shared.disposeHttp = void 0;
    }, "media-studio: http");
  }
}
export {
  API_BASE,
  AssetLibrary,
  JobManager,
  StudioService,
  apply,
  applyVars,
  assertApiWorkflow,
  assetView,
  buildTools,
  concatVideos,
  createRoutes,
  detectFfmpeg,
  emptyConfig,
  getWorkflow,
  inferSurface,
  inject,
  jobView,
  listWorkflows,
  mergeConfig,
  name,
  resolveChannel,
  sanitizeToolValue,
  saveWorkflow
};
