window.__ModuleLoader__.load({ id: "dsh-media-studio", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  __test: () => __test,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/Studio.tsx
var import_react7 = require("react");

// src/client/api.ts
var BASE = "/media-studio/api";
async function call(path, init) {
  const response = await fetch(BASE + path, {
    ...init,
    headers: { ...init?.body === void 0 ? {} : { "content-type": "application/json" }, ...init?.headers }
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const bag = payload !== null && typeof payload === "object" ? payload : null;
  if (!response.ok || bag?.ok === false) {
    throw new Error(typeof bag?.message === "string" ? bag.message : `\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${String(response.status)}`);
  }
  return payload;
}
var api = {
  config: () => call("/config"),
  saveConfig: (patch) => call("/config", { method: "POST", body: JSON.stringify(patch) }),
  /**
   * A failed probe is a normal answer (`ok: false` + a human detail), not an
   * HTTP error — do not route it through `call()`, or the panel shows
   * "请求失败：HTTP 200" instead of why the connection failed.
   */
  testChannel: async (id) => {
    const response = await fetch(`${BASE}/channels/test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id })
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const bag = payload !== null && typeof payload === "object" ? payload : null;
    if (!response.ok) throw new Error(typeof bag?.message === "string" ? bag.message : `\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${String(response.status)}`);
    return {
      ok: bag?.ok === true,
      detail: typeof bag?.detail === "string" ? bag.detail : typeof bag?.message === "string" ? bag.message : "\u6CA1\u6709\u8FD4\u56DE\u63A2\u6D4B\u7ED3\u679C",
      ...typeof bag?.latencyMs === "number" ? { latencyMs: bag.latencyMs } : {}
    };
  },
  jobs: (query = "") => call(`/jobs${query}`),
  job: (id) => call(`/jobs/${encodeURIComponent(id)}`),
  cancelJob: (id) => call(`/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" }),
  generateImage: (body) => call("/generate/image", { method: "POST", body: JSON.stringify(body) }),
  generateVideo: (body) => call("/generate/video", { method: "POST", body: JSON.stringify(body) }),
  storyboard: (body) => call("/storyboard", { method: "POST", body: JSON.stringify(body) }),
  concat: (body) => call("/concat", { method: "POST", body: JSON.stringify(body) }),
  workflows: () => call("/comfy/workflows"),
  runWorkflow: (body) => call("/comfy/run", { method: "POST", body: JSON.stringify(body) }),
  comfyStatus: () => call("/comfy/status"),
  importWorkflow: (body) => call("/comfy/import", { method: "POST", body: JSON.stringify(body) }),
  updateWorkflow: (id, body) => call(`/comfy/workflows/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify(body) }),
  deleteWorkflow: (id) => call(`/comfy/workflows/${encodeURIComponent(id)}`, { method: "DELETE" }),
  library: (query = {}) => call(`/library?${new URLSearchParams(query).toString()}`),
  scan: () => call("/library/scan", { method: "POST", body: "{}" }),
  importPath: (path) => call("/library/import", { method: "POST", body: JSON.stringify({ path }) }),
  importDataUrl: (dataUrl, name2) => call("/library/import", { method: "POST", body: JSON.stringify({ dataUrl, ...name2 === void 0 ? {} : { name: name2 } }) }),
  favorite: (id, favorite) => call(`/library/${encodeURIComponent(id)}/favorite`, { method: "POST", body: JSON.stringify({ favorite }) }),
  remove: (id) => call(`/library/${encodeURIComponent(id)}`, { method: "DELETE" }),
  stats: () => call("/stats")
};

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var PATHS = {
  sparkles: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7L12 3Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M18.5 14.5l.9 2.4 2.1.8-2.1.8-.9 2.4-.9-2.4-2.1-.8 2.1-.8.9-2.4Z" })
  ] }),
  film: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" })
  ] }),
  grid: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "3", width: "7", height: "7", rx: "1.6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "14", y: "3", width: "7", height: "7", rx: "1.6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "14", width: "7", height: "7", rx: "1.6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "14", y: "14", width: "7", height: "7", rx: "1.6" })
  ] }),
  plug: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V8ZM12 17v4" }) }),
  close: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 6l12 12M18 6L6 18" }),
  play: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5.5v13l11-6.5-11-6.5Z" }),
  star: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6Z" }),
  trash: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5h9.4L17.5 7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 11v5M14 11v5" })
  ] }),
  refresh: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 12a8 8 0 1 1-2.3-5.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M20 4v5h-5" })
  ] }),
  upload: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 16V4M7 9l5-5 5 5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" })
  ] }),
  download: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 4v12M7 11l5 5 5-5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" })
  ] }),
  check: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.5 12.5l5 5L20 6.5" }),
  alert: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3.5L22 20H2L12 3.5Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 9v5M12 17v.5" })
  ] }),
  plus: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" }),
  image: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "9", cy: "10", r: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 18l5-5 4 4 3-3 4 4" })
  ] }),
  clock: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "8.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 7.5V12l3.2 2" })
  ] }),
  settings: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3.2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3.5l1 2.6 2.6-1 1 2.1 2.7.4-.4 2.7 1.9 1.9-1.9 1.9.4 2.7-2.7.4-1 2.1-2.6-1-1 2.6-1-2.6-2.6 1-1-2.1-2.7-.4.4-2.7L2.2 12l1.9-1.9-.4-2.7 2.7-.4 1-2.1 2.6 1 1-2.6Z" })
  ] }),
  folder: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 6.5A2 2 0 0 1 5 4.5h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11Z" }),
  link: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.3 1.3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3" })
  ] }),
  chevron: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9 6l6 6-6 6" }),
  layers: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 3l9 5-9 5-9-5 9-5Z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12l9 5 9-5M3 16l9 5 9-5" })
  ] })
};
function Icon({ name: name2, size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      "aria-hidden": "true",
      children: PATHS[name2]
    }
  );
}

// src/client/ui.tsx
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
function Button(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: props.type ?? "button",
      className: `ms-btn ${props.variant ?? "soft"} ${props.size ?? "md"}`,
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      children: [
        props.icon === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: props.icon, size: props.size === "sm" ? 13 : 15 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: props.children })
      ]
    }
  );
}
function Field(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "ms-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ms-field-label", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: props.label }),
      props.right
    ] }),
    props.children,
    props.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ms-hint", children: props.hint })
  ] });
}
function Segmented(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: `ms-seg ${props.size ?? "md"}`, role: "tablist", children: props.options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": props.value === option.value,
      className: props.value === option.value ? "on" : "",
      onClick: () => props.onChange(option.value),
      children: [
        option.icon === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: option.icon, size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: option.label })
      ]
    },
    option.value
  )) });
}
function Spinner({ size = 14 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ms-spinner", style: { width: size, height: size }, "aria-label": "\u52A0\u8F7D\u4E2D" });
}
function Empty(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ms-empty", children: [
    props.icon === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: props.icon, size: 26 }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ms-empty-title", children: props.title }),
    props.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ms-empty-hint", children: props.hint }),
    props.children
  ] });
}
function Modal(props) {
  (0, import_react.useEffect)(() => {
    if (!props.open) return void 0;
    const onKey = (event) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ms-modal-mask", onMouseDown: (event) => {
    if (event.target === event.currentTarget) props.onClose();
  }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: `ms-modal${props.wide === true ? " wide" : ""}`, role: "dialog", "aria-modal": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "ms-modal-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: props.title ?? "" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "ms-icon-btn", onClick: props.onClose, "aria-label": "\u5173\u95ED", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { name: "close", size: 16 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ms-modal-body", children: props.children })
  ] }) });
}
function Tag(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `ms-tag ${props.tone ?? "muted"}`, children: props.children });
}
function bytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let size = value;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
function when(value) {
  if (value === void 0) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 6e4) return "\u521A\u521A";
  if (diff < 36e5) return `${String(Math.floor(diff / 6e4))} \u5206\u949F\u524D`;
  if (diff < 864e5) return `${String(Math.floor(diff / 36e5))} \u5C0F\u65F6\u524D`;
  return `${String(date.getMonth() + 1)}/${String(date.getDate())} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function stateLabel(state) {
  switch (state) {
    case "queued":
      return "\u6392\u961F";
    case "running":
      return "\u8FDB\u884C\u4E2D";
    case "succeeded":
      return "\u5B8C\u6210";
    case "failed":
      return "\u5931\u8D25";
    case "cancelled":
      return "\u5DF2\u53D6\u6D88";
    default:
      return state;
  }
}

// src/client/tabs/CreateTab.tsx
var import_react3 = require("react");

// src/client/components.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function AssetThumb({ asset, size = "md" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `ms-thumb ${size} ${asset.kind}`, children: asset.kind === "image" || asset.kind === "file" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("img", { src: asset.url, alt: asset.name, loading: "lazy" }) : asset.kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("video", { src: asset.url, preload: "metadata", muted: true, playsInline: true }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-play", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "play", size: 14 }) })
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-file", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "film", size: 18 }) }) });
}
function AssetTile(props) {
  const { asset } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `ms-tile${props.selected === true ? " on" : ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "ms-tile-main", onClick: props.onClick, title: asset.prompt ?? asset.name, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AssetThumb, { asset }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ms-tile-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-tile-name", children: asset.prompt?.slice(0, 60) ?? asset.name }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ms-tile-sub", children: [
          asset.kind === "video" ? "\u89C6\u9891" : "\u56FE\u7247",
          " \xB7 ",
          bytes(asset.bytes),
          asset.width === void 0 ? "" : ` \xB7 ${String(asset.width)}\xD7${String(asset.height)}`
        ] })
      ] })
    ] }),
    props.onFavorite === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        className: `ms-star${asset.favorite ? " on" : ""}`,
        onClick: props.onFavorite,
        title: asset.favorite ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF",
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "star", size: 14 })
      }
    ),
    props.footer
  ] });
}
function JobStatePill({ state }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `ms-state ${state}`, children: stateLabel(state) });
}
function JobCard(props) {
  const { job } = props;
  const busy = job.state === "running" || job.state === "queued";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `ms-job ${job.state}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ms-job-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(JobStatePill, { state: job.state }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-job-kind", children: job.kind === "image" ? "\u56FE\u50CF" : job.kind === "video" ? "\u89C6\u9891" : job.kind === "storyboard" ? "\u5206\u955C" : job.kind === "concat" ? "\u62FC\u63A5" : "ComfyUI" }),
      job.channel === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-job-channel", children: job.channel }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-job-time", children: when(job.createdAt) }),
      busy && props.onCancel !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "ms-text-btn danger", onClick: props.onCancel, children: "\u53D6\u6D88" }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ms-job-prompt", children: job.prompt ?? "\uFF08\u65E0\u63D0\u793A\u8BCD\uFF09" }),
    busy ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ms-job-progress", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-progress-bar", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("i", {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: job.progress ?? "\u7B49\u5F85\u4E0A\u6E38\u2026" })
    ] }) : null,
    job.error === void 0 || job.error === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ms-job-error", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { name: "alert", size: 13 }),
      job.error
    ] }),
    job.shots !== void 0 && job.shots.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ol", { className: "ms-shots", children: job.shots.map((shot) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: shot.state, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-shot-index", children: shot.index + 1 }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-shot-prompt", children: shot.prompt }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ms-shot-state", children: stateLabel(shot.state) })
    ] }, shot.index)) }) : null,
    job.assets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ms-job-assets", children: job.assets.map((asset) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      AssetTile,
      {
        asset,
        onClick: () => props.onOpenAsset?.(asset),
        footer: props.onUseRef === void 0 ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "ms-tile-action", onClick: () => props.onUseRef?.(asset), children: "\u4F5C\u53C2\u8003" })
      },
      asset.id
    )) }) : null
  ] });
}

// src/client/tabs/ComfyPanel.tsx
var import_react2 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function ComfyPanel({ notify, onProduced: _onProduced, watchJob }) {
  const [workflows, setWorkflows] = (0, import_react2.useState)([]);
  const [online, setOnline] = (0, import_react2.useState)(false);
  const [detail, setDetail] = (0, import_react2.useState)(void 0);
  const [selectedId, setSelectedId] = (0, import_react2.useState)("");
  const [vars, setVars] = (0, import_react2.useState)({});
  const [images, setImages] = (0, import_react2.useState)({});
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const [running, setRunning] = (0, import_react2.useState)(false);
  const [importOpen, setImportOpen] = (0, import_react2.useState)(false);
  const [importJson, setImportJson] = (0, import_react2.useState)("");
  const [importTitle, setImportTitle] = (0, import_react2.useState)("");
  const [importing, setImporting] = (0, import_react2.useState)(false);
  const [dragActive, setDragActive] = (0, import_react2.useState)(false);
  const importFile = (0, import_react2.useRef)(null);
  const load = (0, import_react2.useCallback)(async () => {
    setLoading(true);
    try {
      const result = await api.workflows();
      setWorkflows(result.workflows);
      setOnline(result.online);
      setDetail(result.detail);
      if (result.workflows.length > 0) {
        setSelectedId((current) => current !== "" && result.workflows.some((item) => item.workflowId === current) ? current : result.workflows[0].workflowId);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);
  (0, import_react2.useEffect)(() => {
    void load();
  }, [load]);
  const selected = (0, import_react2.useMemo)(() => workflows.find((item) => item.workflowId === selectedId), [workflows, selectedId]);
  (0, import_react2.useEffect)(() => {
    if (selected === void 0) return;
    const next = {};
    for (const slot of selected.slots) {
      if (slot.type === "image") continue;
      next[slot.name] = slot.value === void 0 ? "" : String(slot.value);
    }
    setVars(next);
    setImages({});
  }, [selected]);
  const setVar = (name2, value) => setVars((current) => ({ ...current, [name2]: value }));
  const uploadFor = async (slot, file) => {
    try {
      const dataUrl = await readAsDataUrl(file);
      const result = await api.importDataUrl(dataUrl, file.name);
      setImages((current) => ({ ...current, [slot]: { name: file.name, url: result.asset.url, path: result.asset.path } }));
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  };
  const run = async () => {
    if (selected === void 0) return;
    setRunning(true);
    try {
      const payloadVars = {};
      for (const slot of selected.slots) {
        if (slot.type === "image") continue;
        const raw = vars[slot.name] ?? "";
        if (raw === "" && !slot.required) continue;
        payloadVars[slot.name] = slot.type === "number" ? Number.parseFloat(raw) : slot.type === "boolean" ? raw === "true" : raw;
      }
      const result = await api.runWorkflow({
        workflowId: selected.workflowId,
        vars: payloadVars,
        images: Object.entries(images).map(([slot, image]) => ({ slot, path: image.path }))
      });
      watchJob(result.job);
      notify("\u5DF2\u63D0\u4EA4\u5230 ComfyUI", "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setRunning(false);
    }
  };
  const readImportFile = async (file) => {
    if (!/\.json$/i.test(file.name)) {
      notify("\u8BF7\u9009\u62E9 .json \u5DE5\u4F5C\u6D41\u6587\u4EF6", "error");
      return;
    }
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("JSON \u89E3\u6790\u5931\u8D25");
      }
      if (parsed === null || typeof parsed !== "object") throw new Error("\u6587\u4EF6\u5185\u5BB9\u4E0D\u662F JSON \u5BF9\u8C61");
      const uiFormat = Array.isArray(parsed.nodes);
      setImportJson(text);
      if (importTitle.trim() === "") setImportTitle(file.name.replace(/\.json$/i, ""));
      setImportOpen(true);
      notify(
        uiFormat ? "\u8FD9\u662F UI \u683C\u5F0F\u5DE5\u4F5C\u6D41\uFF1A\u8BF7\u5728 ComfyUI \u91CC\u7528 Save (API Format) \u91CD\u65B0\u5BFC\u51FA" : `\u5DF2\u8BFB\u53D6 ${file.name}\uFF0C\u786E\u8BA4\u540E\u70B9\u300C\u5BFC\u5165\u300D`,
        uiFormat ? "error" : "ok"
      );
    } catch (error) {
      notify(`\u8BFB\u53D6\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, "error");
    }
  };
  const importWorkflow = async () => {
    setImporting(true);
    try {
      const result = await api.importWorkflow({
        json: importJson,
        ...importTitle.trim() === "" ? {} : { id: importTitle.trim(), title: importTitle.trim() }
      });
      setImportOpen(false);
      setImportJson("");
      setImportTitle("");
      await load();
      setSelectedId(result.workflow.workflowId);
      notify(`\u5DF2\u5BFC\u5165 ${result.workflow.title}`, "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setImporting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      className: `ms-comfy${dragActive ? " dragging" : ""}`,
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragActive(true);
      },
      onDragLeave: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
      },
      onDrop: (event) => {
        event.preventDefault();
        setDragActive(false);
        const file = event.dataTransfer.files?.[0];
        if (file !== void 0) void readImportFile(file);
      },
      children: [
        dragActive ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-drop-overlay", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "upload", size: 22 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u677E\u5F00\u5373\u53EF\u5BFC\u5165 .json \u5DE5\u4F5C\u6D41" })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-comfy-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "ms-inline-status", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `ms-dot${online ? " on" : ""}` }),
            online ? "ComfyUI \u5728\u7EBF" : `ComfyUI \u79BB\u7EBF${detail === void 0 ? "" : `\uFF1A${detail}`}`
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-inline-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", variant: "ghost", icon: "refresh", onClick: () => {
              void load();
            }, children: "\u5237\u65B0" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", variant: "soft", icon: "upload", onClick: () => setImportOpen(true), children: "\u5BFC\u5165\u5DE5\u4F5C\u6D41" })
          ] })
        ] }),
        loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-loading", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Spinner, {}),
          " \u8BFB\u53D6\u5DE5\u4F5C\u6D41\u2026"
        ] }) : null,
        !loading && workflows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-comfy-empty", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "plug", size: 26 }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: "\u8FD8\u6CA1\u6709\u5BFC\u5165\u5DE5\u4F5C\u6D41\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "ms-hint", children: [
            "\u5728 ComfyUI \u91CC\u6253\u5F00\u5DE5\u4F5C\u6D41 \u2192 \u52FE\u9009 Dev mode \u2192 ",
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: "Save (API Format)" }),
            "\uFF0C\u7136\u540E\u4E0A\u4F20\u6216\u7C98\u8D34 JSON\u3002"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", size: "sm", icon: "upload", onClick: () => setImportOpen(true), children: "\u5BFC\u5165 API \u5DE5\u4F5C\u6D41" })
        ] }) : null,
        workflows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-grid-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u5DE5\u4F5C\u6D41", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("select", { className: "ms-select", value: selectedId, onChange: (event) => setSelectedId(event.target.value), children: workflows.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("option", { value: item.workflowId, children: [
              item.title,
              item.enabled ? "" : "\uFF08\u5DF2\u505C\u7528\uFF09"
            ] }, item.workflowId)) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u8F93\u51FA", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ms-static", children: selected?.outputs.map((output) => output.kind === "video" ? "\u89C6\u9891" : "\u56FE\u7247").join(" / ") || "\u672A\u8BC6\u522B" }) })
          ] }),
          selected?.description === void 0 || selected.description === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "ms-comfy-desc", children: selected.description }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ms-comfy-vars", children: selected?.slots.map((slot) => slot.type === "image" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-slot-image", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-slot-image-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { children: [
                slot.label ?? slot.name,
                " ",
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("em", { children: slot.required ? "\u5FC5\u586B" : "\u53EF\u9009" })
              ] }),
              images[slot.name] === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "ms-text-btn danger", onClick: () => setImages((current) => {
                const next = { ...current };
                delete next[slot.name];
                return next;
              }), children: "\u79FB\u9664" })
            ] }),
            images[slot.name] === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { className: "ms-slot-drop", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "image", size: 18 }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u70B9\u51FB\u9009\u62E9\u56FE\u7247" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "file", accept: "image/*", hidden: true, onChange: (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file !== void 0) void uploadFor(slot.name, file);
              } })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("img", { className: "ms-slot-preview", src: images[slot.name].url, alt: slot.name })
          ] }, `${slot.nodeId}.${slot.input}`) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: `${slot.label ?? slot.name}${slot.required ? " *" : ""}`, hint: `${slot.nodeId}.${slot.input}`, children: slot.type === "string" && slot.name.startsWith("prompt") ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("textarea", { className: "ms-textarea small", rows: 3, value: vars[slot.name] ?? "", onChange: (event) => setVar(slot.name, event.target.value) }) : slot.type === "boolean" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("select", { className: "ms-select", value: vars[slot.name] ?? "false", onChange: (event) => setVar(slot.name, event.target.value), children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "true", children: "true" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("option", { value: "false", children: "false" })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              className: "ms-input",
              type: slot.type === "number" ? "number" : "text",
              value: vars[slot.name] ?? "",
              onChange: (event) => setVar(slot.name, event.target.value)
            }
          ) }, `${slot.nodeId}.${slot.input}`)) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-submit-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", icon: "play", disabled: running || !online, onClick: () => {
              void run();
            }, children: running ? "\u63D0\u4EA4\u4E2D\u2026" : online ? "\u8FD0\u884C\u5DE5\u4F5C\u6D41" : "ComfyUI \u79BB\u7EBF" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ms-hint", children: "\u53D8\u91CF\u4F1A\u5199\u8FDB\u5DE5\u4F5C\u6D41\u526F\u672C\uFF0C\u4E0D\u6539\u6A21\u677F\u6587\u4EF6" })
          ] })
        ] }) : null,
        importOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "ms-modal-mask", onMouseDown: (event) => {
          if (event.target === event.currentTarget) setImportOpen(false);
        }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-modal wide", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "ms-modal-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u5BFC\u5165 ComfyUI \u5DE5\u4F5C\u6D41\uFF08API \u683C\u5F0F\uFF09" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "ms-icon-btn", onClick: () => setImportOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Icon, { name: "close", size: 16 }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-modal-body", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "\u540D\u79F0", hint: "\u7559\u7A7A\u81EA\u52A8\u6309\u65F6\u95F4\u547D\u540D", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: "ms-input", value: importTitle, placeholder: "\u4F8B\u5982\uFF1ASDXL \u5199\u5B9E\u4EBA\u50CF", onChange: (event) => setImportTitle(event.target.value) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-import-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { size: "sm", variant: "soft", icon: "upload", onClick: () => importFile.current?.click(), children: "\u9009\u62E9 .json \u6587\u4EF6" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ms-hint", children: "\u4E5F\u53EF\u4EE5\u628A\u6587\u4EF6\u62D6\u8FDB\u7A97\u53E3\uFF0C\u6216\u76F4\u63A5\u7C98\u8D34\u5230\u4E0B\u9762" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
                "input",
                {
                  ref: importFile,
                  type: "file",
                  accept: ".json,application/json",
                  hidden: true,
                  onChange: (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file !== void 0) void readImportFile(file);
                  }
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: "API JSON", hint: "\u5FC5\u987B\u662F ComfyUI \u7684 API \u683C\u5F0F\uFF1BUI \u683C\u5F0F\u4F1A\u5728\u5BFC\u5165\u65F6\u88AB\u62D2\u7EDD\u5E76\u63D0\u793A\u539F\u56E0", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("textarea", { className: "ms-textarea mono", rows: 12, value: importJson, placeholder: '{"3":{"class_type":"KSampler",...}}', onChange: (event) => setImportJson(event.target.value) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "ms-submit-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { variant: "primary", disabled: importing || importJson.trim() === "", onClick: () => {
                void importWorkflow();
              }, children: importing ? "\u5BFC\u5165\u4E2D\u2026" : "\u5BFC\u5165" }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "ms-hint", children: "\u4E5F\u53EF\u4EE5\u628A JSON \u6587\u4EF6\u653E\u5230 ~/.dsh-media-studio/workflows/" })
            ] })
          ] })
        ] }) }) : null
      ]
    }
  );
}
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25"));
    reader.readAsDataURL(file);
  });
}

// src/client/tabs/CreateTab.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];
var SIZES = ["1024x1024", "1536x1024", "1024x1536", "1280x960", "960x1280", "1536x864", "864x1536"];
function newKey() {
  return Math.random().toString(36).slice(2, 9);
}
function fromAsset(asset) {
  return { key: newKey(), name: asset.name, url: asset.url, id: asset.id, path: asset.path };
}
function CreateTab(props) {
  const [mode, setMode] = (0, import_react3.useState)("image");
  const [prompt, setPrompt] = (0, import_react3.useState)("");
  const [negative, setNegative] = (0, import_react3.useState)("");
  const [channelId, setChannelId] = (0, import_react3.useState)("");
  const [model, setModel] = (0, import_react3.useState)("");
  const [count, setCount] = (0, import_react3.useState)(1);
  const [size, setSize] = (0, import_react3.useState)("");
  const [aspect, setAspect] = (0, import_react3.useState)("1:1");
  const [quality, setQuality] = (0, import_react3.useState)("");
  const [refs, setRefs] = (0, import_react3.useState)([]);
  const [videoMode, setVideoMode] = (0, import_react3.useState)("text");
  const [seconds, setSeconds] = (0, import_react3.useState)("5");
  const [resolution, setResolution] = (0, import_react3.useState)("720P");
  const [videoAspect, setVideoAspect] = (0, import_react3.useState)("16:9");
  const [shots, setShots] = (0, import_react3.useState)([{ id: newKey(), prompt: "", seconds: "5" }]);
  const [style, setStyle] = (0, import_react3.useState)("");
  const [chain, setChain] = (0, import_react3.useState)(true);
  const [concat, setConcat] = (0, import_react3.useState)(true);
  const [submitting, setSubmitting] = (0, import_react3.useState)(false);
  const [job, setJob] = (0, import_react3.useState)(null);
  const [recent, setRecent] = (0, import_react3.useState)([]);
  const [pickerOpen, setPickerOpen] = (0, import_react3.useState)(false);
  const [pickerKind, setPickerKind] = (0, import_react3.useState)("image");
  const [pickerTarget, setPickerTarget] = (0, import_react3.useState)({ kind: "refs" });
  const [libraryItems, setLibraryItems] = (0, import_react3.useState)([]);
  const fileInput = (0, import_react3.useRef)(null);
  const pollRef = (0, import_react3.useRef)(void 0);
  const imageChannels = (0, import_react3.useMemo)(() => props.channels.filter((item) => item.capabilities.includes("image") && item.kind !== "comfyui"), [props.channels]);
  const videoChannels = (0, import_react3.useMemo)(() => props.channels.filter((item) => item.capabilities.includes("video") && item.kind !== "comfyui"), [props.channels]);
  const comfyChannel = (0, import_react3.useMemo)(() => props.channels.find((item) => item.kind === "comfyui"), [props.channels]);
  const pickChannel = (value) => {
    if (value === "__comfyui__") {
      setMode("comfy");
      return;
    }
    setChannelId(value);
  };
  const pool = mode === "image" ? imageChannels : videoChannels;
  const channel = pool.find((item) => item.id === channelId) ?? pool.find((item) => item.ready) ?? pool[0];
  (0, import_react3.useEffect)(() => {
    if (channel === void 0) return;
    if (channel.id !== channelId) setChannelId(channel.id);
    setModel(mode === "image" ? channel.imageModel ?? channel.models?.image?.[0] ?? "" : channel.videoModel ?? channel.models?.video?.[0] ?? "");
  }, [channel, channelId, mode]);
  (0, import_react3.useEffect)(() => {
    if (props.useRefAsset === null) return;
    setRefs((current) => [...current, fromAsset(props.useRefAsset.asset)].slice(0, 5));
    setMode((current) => current === "video" ? "video" : "image");
    props.onConsumeRef();
  }, [props.useRefAsset, props.onConsumeRef]);
  const loadRecent = (0, import_react3.useCallback)(async () => {
    try {
      const result = await api.library({ limit: "8" });
      setRecent(result.items);
    } catch {
    }
  }, []);
  (0, import_react3.useEffect)(() => {
    void loadRecent();
  }, [loadRecent]);
  (0, import_react3.useEffect)(() => () => {
    if (pollRef.current !== void 0) window.clearInterval(pollRef.current);
  }, []);
  const watchJob = (0, import_react3.useCallback)((initial) => {
    setJob(initial);
    if (pollRef.current !== void 0) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const result = await api.job(initial.jobId);
        setJob(result.job);
        if (result.job.state !== "running" && result.job.state !== "queued") {
          if (pollRef.current !== void 0) window.clearInterval(pollRef.current);
          if (result.job.state === "succeeded") {
            props.onProduced();
            void loadRecent();
          }
        }
      } catch (error) {
        props.notify(error instanceof Error ? error.message : String(error), "error");
        if (pollRef.current !== void 0) window.clearInterval(pollRef.current);
      }
    }, 1800);
  }, [props, loadRecent]);
  const addFiles = async (files) => {
    if (files.length === 0) return;
    for (const file of files.slice(0, 5 - refs.length)) {
      const key = newKey();
      const localUrl = URL.createObjectURL(file);
      setRefs((current) => [...current, { key, name: file.name, url: localUrl, uploading: true }].slice(0, 5));
      try {
        const dataUrl = await readAsDataUrl2(file);
        const result = await api.importDataUrl(dataUrl, file.name);
        setRefs((current) => current.map((item) => item.key === key ? { ...fromAsset(result.asset) } : item));
      } catch (error) {
        setRefs((current) => current.filter((item) => item.key !== key));
        props.notify(error instanceof Error ? error.message : String(error), "error");
      }
    }
  };
  const openPicker = async (target, kind) => {
    setPickerTarget(target);
    setPickerKind(kind);
    setPickerOpen(true);
    try {
      const result = await api.library({ kind, limit: "60" });
      setLibraryItems(result.items);
    } catch (error) {
      props.notify(error instanceof Error ? error.message : String(error), "error");
    }
  };
  const pickAsset = (asset) => {
    const ref = fromAsset(asset);
    if (pickerTarget?.kind === "shot") {
      setShots((current) => current.map((shot) => shot.id === pickerTarget.id ? { ...shot, ref } : shot));
    } else {
      setRefs((current) => [...current, ref].slice(0, 5));
    }
    setPickerOpen(false);
  };
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === "image") {
        if (prompt.trim() === "") throw new Error("\u5148\u5199\u70B9\u753B\u9762\u63CF\u8FF0");
        const result = await api.generateImage({
          prompt,
          ...channel === void 0 ? {} : { channel: channel.id },
          ...model === "" ? {} : { model },
          n: count,
          ...refs.length === 0 ? {} : { refs: refs.map((item) => item.id ?? item.path ?? "") },
          ...size === "" ? { aspectRatio: aspect } : { size },
          ...quality === "" ? {} : { quality },
          ...negative === "" ? {} : { negative }
        });
        watchJob(result.job);
        props.notify("\u5DF2\u63D0\u4EA4\u56FE\u50CF\u4EFB\u52A1", "ok");
      } else if (mode === "video") {
        if (prompt.trim() === "") throw new Error("\u5148\u5199\u70B9\u955C\u5934\u63CF\u8FF0");
        const inferredMode = refs.length === 0 ? "text" : refs.length > 1 ? "keyframe" : videoMode === "reference" ? "reference" : "image";
        const result = await api.generateVideo({
          prompt,
          ...channel === void 0 ? {} : { channel: channel.id },
          ...model === "" ? {} : { model },
          mode: inferredMode,
          ...refs.length === 0 ? {} : { refs: refs.map((item) => item.id ?? item.path ?? "") },
          seconds: Number.parseFloat(seconds) || 5,
          resolution,
          aspectRatio: videoAspect,
          ...negative === "" ? {} : { negative }
        });
        watchJob(result.job);
        props.notify("\u5DF2\u63D0\u4EA4\u89C6\u9891\u4EFB\u52A1\uFF08\u4E91\u7AEF\u6E32\u67D3\u53EF\u80FD\u9700\u8981\u51E0\u5206\u949F\uFF09", "ok");
      } else if (mode === "storyboard") {
        const clean = shots.filter((shot) => shot.prompt.trim() !== "");
        if (clean.length === 0) throw new Error("\u81F3\u5C11\u5199\u4E00\u4E2A\u955C\u5934");
        const result = await api.storyboard({
          shots: clean.map((shot) => ({
            prompt: shot.prompt,
            seconds: Number.parseFloat(shot.seconds) || void 0,
            ...shot.ref === void 0 ? {} : { ref: shot.ref.id ?? shot.ref.path }
          })),
          ...style === "" ? {} : { style },
          chain,
          concat,
          ...channel === void 0 ? {} : { channel: channel.id },
          ...model === "" ? {} : { model },
          resolution,
          aspectRatio: videoAspect
        });
        watchJob(result.job);
        props.notify("\u5DF2\u63D0\u5206\u955C\u4EFB\u52A1\uFF0C\u6309\u955C\u5934\u987A\u5E8F\u6E32\u67D3", "ok");
      }
    } catch (error) {
      props.notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSubmitting(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-create", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-compose", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-mode-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          Segmented,
          {
            value: mode,
            onChange: setMode,
            options: [
              { value: "image", label: "\u56FE\u50CF", icon: "image" },
              { value: "video", label: "\u89C6\u9891", icon: "film" },
              { value: "storyboard", label: "\u5206\u955C", icon: "layers" },
              { value: "comfy", label: "ComfyUI", icon: "plug" }
            ]
          }
        ),
        mode === "image" || mode === "video" || mode === "storyboard" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "ms-inline-status", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `ms-dot${channel?.ready === true ? " on" : ""}` }),
          channel === void 0 ? "\u6CA1\u6709\u53EF\u7528\u901A\u9053" : channel.ready ? `${channel.label}${channel.keySource === "env" ? "\uFF08\u73AF\u5883\u53D8\u91CF\uFF09" : ""}` : `${channel.label} \u7F3A Key`
        ] }) : null
      ] }),
      mode === "comfy" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ComfyPanel, { notify: props.notify, onProduced: props.onProduced, watchJob }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        mode === "storyboard" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          StoryboardForm,
          {
            shots,
            style,
            chain,
            concat,
            onChange: setShots,
            onStyle: setStyle,
            onChain: setChain,
            onConcat: setConcat,
            onPickRef: (id) => {
              void openPicker({ kind: "shot", id }, "image");
            },
            onClearRef: (id) => setShots((current) => current.map((shot) => shot.id === id ? { ...shot, ref: void 0 } : shot))
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: mode === "image" ? "\u753B\u9762\u63CF\u8FF0" : "\u955C\u5934\u63CF\u8FF0", hint: mode === "video" ? "\u5199\u6E05\u4E3B\u4F53\u52A8\u4F5C\u3001\u8FD0\u955C\u3001\u5149\u7EBF\uFF1B\u65F6\u957F\u5185\u7684\u53D8\u5316\u4E5F\u8981\u5199" : void 0, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "textarea",
            {
              className: "ms-textarea",
              rows: 5,
              value: prompt,
              placeholder: mode === "image" ? "\u96E8\u591C\u9713\u8679\u8857\u5934\u7684\u4E00\u53EA\u8D5B\u535A\u670B\u514B\u732B\uFF0C\u7535\u5F71\u611F\u5149\u7EBF\uFF0C\u6D45\u666F\u6DF1\uFF0C35mm" : "\u955C\u5934\u7F13\u6162\u63A8\u8FD1\uFF0C\u9713\u8679\u706F\u5728\u6E7F\u5730\u9762\u53CD\u5149\uFF0C\u732B\u62AC\u5934\u770B\u5411\u955C\u5934",
              onChange: (event) => setPrompt(event.target.value)
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u8D1F\u9762\u63D0\u793A\u8BCD", hint: "\u53EF\u9009\uFF1B\u90E8\u5206\u901A\u9053\u4F1A\u5FFD\u7565", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", value: negative, placeholder: "low quality, watermark, text", onChange: (event) => setNegative(event.target.value) }) })
        ] }),
        mode === "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-grid-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u901A\u9053", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { className: "ms-select", value: channel?.id ?? "", onChange: (event) => pickChannel(event.target.value), children: [
              imageChannels.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "", children: "\u6CA1\u6709\u56FE\u50CF\u901A\u9053" }) : null,
              imageChannels.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("option", { value: item.id, children: [
                item.label,
                item.ready ? "" : "\uFF08\u7F3A Key\uFF09"
              ] }, item.id)),
              comfyChannel === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("option", { value: "__comfyui__", children: [
                "ComfyUI\uFF08",
                comfyChannel.ready ? "\u5DE5\u4F5C\u6D41\u6A21\u5F0F" : "\u672A\u914D\u7F6E\u5730\u5740",
                "\uFF09"
              ] })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Field, { label: "\u6A21\u578B", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", value: model, onChange: (event) => setModel(event.target.value), list: "ms-image-models" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("datalist", { id: "ms-image-models", children: (channel?.models?.image ?? []).map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item }, item)) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-grid-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u5F20\u6570", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", type: "number", min: 1, max: 10, value: count, onChange: (event) => setCount(Math.max(1, Math.min(10, Number.parseInt(event.target.value || "1", 10)))) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u5C3A\u5BF8", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { className: "ms-select", value: size, onChange: (event) => setSize(event.target.value), children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "", children: "\u6309\u6BD4\u4F8B" }),
              SIZES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item, children: item }, item))
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u6BD4\u4F8B", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { className: "ms-select", value: aspect, onChange: (event) => setAspect(event.target.value), disabled: size !== "", children: RATIOS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item, children: item }, item)) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u8D28\u91CF", hint: "OpenAI \u901A\u9053\u652F\u6301 low / medium / high", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", value: quality, placeholder: "\u9ED8\u8BA4", onChange: (event) => setQuality(event.target.value) }) })
        ] }) : mode === "video" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-grid-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u901A\u9053", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { className: "ms-select", value: channel?.id ?? "", onChange: (event) => pickChannel(event.target.value), children: [
              videoChannels.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "", children: "\u6CA1\u6709\u89C6\u9891\u901A\u9053" }) : null,
              videoChannels.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("option", { value: item.id, children: [
                item.label,
                item.ready ? "" : "\uFF08\u7F3A Key\uFF09"
              ] }, item.id)),
              comfyChannel === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("option", { value: "__comfyui__", children: [
                "ComfyUI\uFF08",
                comfyChannel.ready ? "\u5DE5\u4F5C\u6D41\u6A21\u5F0F" : "\u672A\u914D\u7F6E\u5730\u5740",
                "\uFF09"
              ] })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Field, { label: "\u6A21\u578B", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", value: model, onChange: (event) => setModel(event.target.value), list: "ms-video-models" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("datalist", { id: "ms-video-models", children: (channel?.models?.video ?? []).map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item }, item)) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-grid-3", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u65F6\u957F\uFF08\u79D2\uFF09", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", type: "number", min: 1, max: 20, value: seconds, onChange: (event) => setSeconds(event.target.value) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u5206\u8FA8\u7387", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { className: "ms-select", value: resolution, onChange: (event) => setResolution(event.target.value), children: ["480P", "720P", "1080P"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item, children: item }, item)) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u6BD4\u4F8B", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { className: "ms-select", value: videoAspect, onChange: (event) => setVideoAspect(event.target.value), children: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item, children: item }, item)) }) })
          ] })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-grid-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u901A\u9053", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { className: "ms-select", value: channel?.id ?? "", onChange: (event) => setChannelId(event.target.value), children: videoChannels.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("option", { value: item.id, children: [
              item.label,
              item.ready ? "" : "\uFF08\u7F3A Key\uFF09"
            ] }, item.id)) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u6A21\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", value: model, onChange: (event) => setModel(event.target.value) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-grid-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u7EDF\u4E00\u5206\u8FA8\u7387", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { className: "ms-select", value: resolution, onChange: (event) => setResolution(event.target.value), children: ["480P", "720P", "1080P"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item, children: item }, item)) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u7EDF\u4E00\u6BD4\u4F8B", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { className: "ms-select", value: videoAspect, onChange: (event) => setVideoAspect(event.target.value), children: ["16:9", "9:16", "1:1"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: item, children: item }, item)) }) })
          ] })
        ] }),
        mode !== "storyboard" && comfyChannel !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "ms-comfy-link", onClick: () => setMode("comfy"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "plug", size: 13 }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
            "\u672C\u5730 ComfyUI ",
            comfyChannel.ready ? "\u5DF2\u5C31\u7EEA" : "\u5730\u5740\u672A\u914D\u7F6E",
            "\uFF1A\u7528\u5DE5\u4F5C\u6D41\u6A21\u5F0F\u51FA\u56FE / \u89C6\u9891"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "chevron", size: 12 })
        ] }) : null,
        mode !== "storyboard" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-refs", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-refs-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
              "\u53C2\u8003\u56FE ",
              refs.length > 0 ? `\uFF08${String(refs.length)}/5\uFF09` : "\uFF08\u53EF\u9009\uFF09"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-refs-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "ms-text-btn", onClick: () => fileInput.current?.click(), children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "upload", size: 13 }),
                "\u4E0A\u4F20"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "ms-text-btn", onClick: () => {
                void openPicker({ kind: "refs" }, "image");
              }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "grid", size: 13 }),
                "\u7D20\u6750\u5E93"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "div",
            {
              className: "ms-drop",
              onDragOver: (event) => event.preventDefault(),
              onDrop: (event) => {
                event.preventDefault();
                void addFiles(Array.from(event.dataTransfer.files));
              },
              children: [
                refs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ms-drop-hint", children: "\u62D6\u5165\u56FE\u7247\uFF0C\u6216\u4F7F\u7528\u4E0A\u9762\u7684\u6309\u94AE" }) : null,
                refs.map((ref) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-ref", children: [
                  ref.uploading === true ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ms-ref-loading", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Spinner, { size: 12 }) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: ref.url, alt: ref.name }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "ms-ref-remove", onClick: () => setRefs((current) => current.filter((item) => item.key !== ref.key)), "aria-label": "\u79FB\u9664", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "close", size: 11 }) })
                ] }, ref.key))
              ]
            }
          )
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-submit-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Button, { variant: "primary", size: "md", icon: "sparkles", disabled: submitting, onClick: () => {
            void submit();
          }, children: submitting ? "\u63D0\u4EA4\u4E2D\u2026" : mode === "image" ? `\u751F\u6210 ${String(count)} \u5F20` : mode === "video" ? "\u751F\u6210\u89C6\u9891" : "\u5F00\u59CB\u5206\u955C" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ms-hint", children: mode === "image" ? "\u51FA\u56FE\u540E\u70B9\u7ED3\u679C\u91CC\u7684\u300C\u4F5C\u53C2\u8003\u300D\u53EF\u7EE7\u7EED\u6539" : "\u4E91\u7AEF\u6E32\u67D3\u901A\u5E38 1\u201310 \u5206\u949F\uFF1B\u53EF\u5207\u5230\u300C\u4EFB\u52A1\u300D\u9875\u8DDF\u8FDB" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          ref: fileInput,
          type: "file",
          accept: "image/*",
          multiple: true,
          hidden: true,
          onChange: (event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("aside", { className: "ms-result", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-result-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: job === null ? "\u6700\u8FD1\u751F\u6210" : "\u672C\u6B21\u7ED3\u679C" }),
        job !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "ms-text-btn", onClick: props.onOpenJobs, children: "\u5168\u90E8\u4EFB\u52A1" }) : null
      ] }),
      job !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ms-result-job", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        JobCard,
        {
          job,
          onCancel: () => {
            void api.cancelJob(job.jobId).then(() => props.notify("\u5DF2\u8BF7\u6C42\u53D6\u6D88")).catch((error) => props.notify(String(error), "error"));
          },
          onUseRef: (asset) => {
            setRefs((current) => [...current, fromAsset(asset)].slice(0, 5));
            props.notify("\u5DF2\u52A0\u5165\u53C2\u8003\u56FE");
          }
        }
      ) }) : null,
      job === null && recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-result-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "image", size: 26 }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: "\u8FD8\u6CA1\u6709\u4F5C\u54C1\u3002\u5199\u4E00\u53E5\u63CF\u8FF0\uFF0C\u751F\u6210\u7B2C\u4E00\u5F20\u56FE\u3002" })
      ] }) : null,
      recent.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ms-recent", children: recent.map((asset) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          className: "ms-recent-item",
          onClick: () => {
            if (asset.kind !== "image") {
              props.notify("\u89C6\u9891\u4E0D\u80FD\u4F5C\u53C2\u8003\u56FE\uFF1B\u56FE\u7247\u624D\u884C");
              return;
            }
            setRefs((current) => [...current, fromAsset(asset)].slice(0, 5));
            setMode((current) => current === "video" ? "video" : "image");
            props.notify("\u5DF2\u52A0\u5165\u53C2\u8003\u56FE");
          },
          title: asset.prompt ?? asset.name,
          children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AssetThumb, { asset, size: "sm" })
        },
        asset.id
      )) }) : null,
      job !== null && job.assets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-result-hint", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Tag, { tone: "ok", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "check", size: 11 }),
          " \u5DF2\u5B58\u5165\u7D20\u6750\u5E93"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
          "\u955C\u50CF\u8DEF\u5F84\uFF1A",
          hostDirOf(job.assets[0].path)
        ] })
      ] }) : null
    ] }),
    pickerOpen ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ms-modal-mask", onMouseDown: (event) => {
      if (event.target === event.currentTarget) setPickerOpen(false);
    }, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-modal wide", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "ms-modal-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
          "\u4ECE\u7D20\u6750\u5E93\u9009\u62E9",
          pickerKind === "image" ? "\u56FE\u7247" : "\u89C6\u9891"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "ms-icon-btn", onClick: () => setPickerOpen(false), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "close", size: 16 }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ms-modal-body", children: libraryItems.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "ms-hint", children: "\u7D20\u6750\u5E93\u8FD8\u662F\u7A7A\u7684\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ms-pick-grid", children: libraryItems.map((asset) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "ms-pick", onClick: () => pickAsset(asset), title: asset.prompt ?? asset.name, children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AssetThumb, { asset, size: "sm" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: asset.name })
      ] }, asset.id)) }) })
    ] }) }) : null
  ] });
}
function StoryboardForm(props) {
  const total = props.shots.reduce((sum, shot) => sum + (Number.parseFloat(shot.seconds) || 5), 0);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-storyboard", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Field, { label: "\u7EDF\u4E00\u98CE\u683C", hint: "\u4F1A\u62FC\u5230\u6BCF\u4E2A\u955C\u5934\u524D\u9762", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "ms-input", value: props.style, placeholder: "\u4F8B\u5982\uFF1A\u8D5B\u535A\u670B\u514B\uFF0C\u9713\u8679\u7D2B\u9752\uFF0C35mm \u7535\u5F71\u611F", onChange: (event) => props.onStyle(event.target.value) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "ms-shot-list", children: props.shots.map((shot, index) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-shot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "ms-shot-no", children: index + 1 }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-shot-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "textarea",
          {
            className: "ms-textarea small",
            rows: 2,
            value: shot.prompt,
            placeholder: index === 0 ? "\u8D77\u59CB\u955C\u5934\uFF1A\u89D2\u8272\u7AD9\u5728\u96E8\u591C\u8857\u5934" : "\u4E0B\u4E00\u955C\uFF1A\u955C\u5934\u63A8\u8FD1\uFF0C\u89D2\u8272\u62AC\u5934",
            onChange: (event) => props.onChange(props.shots.map((item) => item.id === shot.id ? { ...item, prompt: event.target.value } : item))
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-shot-tools", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ms-mini-field", children: [
            "\u65F6\u957F",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "input",
              {
                className: "ms-input mini",
                type: "number",
                min: 1,
                max: 20,
                value: shot.seconds,
                onChange: (event) => props.onChange(props.shots.map((item) => item.id === shot.id ? { ...item, seconds: event.target.value } : item))
              }
            ),
            "\u79D2"
          ] }),
          shot.ref === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("button", { type: "button", className: "ms-text-btn", onClick: () => props.onPickRef(shot.id), children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "image", size: 12 }),
            "\u53C2\u8003\u56FE"
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "ms-shot-ref", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("img", { src: shot.ref.url, alt: "" }),
            shot.ref.name.slice(0, 18),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "ms-text-btn", onClick: () => props.onClearRef(shot.id), children: "\u79FB\u9664" })
          ] }),
          props.shots.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "ms-text-btn danger", onClick: () => props.onChange(props.shots.filter((item) => item.id !== shot.id)), children: "\u5220\u9664" }) : null
        ] })
      ] })
    ] }, shot.id)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-shot-add", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          type: "button",
          className: "ms-add-shot",
          onClick: () => props.onChange([...props.shots, { id: newKey(), prompt: "", seconds: "5" }]),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Icon, { name: "plus", size: 14 }),
            " \u6DFB\u52A0\u955C\u5934"
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "ms-hint", children: [
        "\u5171 ",
        props.shots.length,
        " \u955C \xB7 \u7EA6 ",
        total,
        " \u79D2"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "ms-toggles", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ms-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: props.chain, onChange: (event) => props.onChain(event.target.checked) }),
        "\u63A5\u4E0A\u4E00\u955C\u5C3E\u5E27\uFF08\u9700\u8981 ffmpeg\uFF09"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "ms-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: props.concat, onChange: (event) => props.onConcat(event.target.checked) }),
        "\u81EA\u52A8\u62FC\u6210\u4E00\u6761\u6210\u7247"
      ] })
    ] })
  ] });
}
function readAsDataUrl2(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25"));
    reader.readAsDataURL(file);
  });
}
function hostDirOf(file) {
  const parts = file.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}

// src/client/tabs/JobsTab.tsx
var import_react4 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function JobsTab({ jobs, onRefresh, onOpenAsset, notify }) {
  const [filter, setFilter] = (0, import_react4.useState)("all");
  const visible = (0, import_react4.useMemo)(() => jobs.filter((job) => {
    if (filter === "active") return job.state === "running" || job.state === "queued";
    if (filter === "done") return job.state === "succeeded";
    if (filter === "failed") return job.state === "failed" || job.state === "cancelled";
    return true;
  }), [jobs, filter]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "ms-jobs", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "ms-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        Segmented,
        {
          value: filter,
          onChange: setFilter,
          options: [
            { value: "all", label: "\u5168\u90E8" },
            { value: "active", label: "\u8FDB\u884C\u4E2D" },
            { value: "done", label: "\u5B8C\u6210" },
            { value: "failed", label: "\u5931\u8D25" }
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "ms-toolbar-right", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "ms-hint", children: [
          jobs.length,
          " \u6761\u8BB0\u5F55"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Button, { size: "sm", variant: "ghost", icon: "refresh", onClick: onRefresh, children: "\u5237\u65B0" })
      ] })
    ] }),
    visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Empty, { icon: "clock", title: "\u8FD9\u91CC\u8FD8\u6CA1\u6709\u4EFB\u52A1", hint: "\u5728\u300C\u521B\u4F5C\u300D\u9875\u63D0\u4EA4\u4E00\u6B21\u751F\u6210\uFF0C\u4EFB\u52A1\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "ms-job-list", children: visible.map((job) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      JobCard,
      {
        job,
        onCancel: () => {
          void api.cancelJob(job.jobId).then(() => {
            notify("\u5DF2\u8BF7\u6C42\u53D6\u6D88");
            onRefresh();
          }).catch((error) => notify(String(error), "error"));
        },
        onOpenAsset
      },
      job.jobId
    )) })
  ] });
}

// src/client/tabs/LibraryTab.tsx
var import_react5 = require("react");
var import_jsx_runtime7 = require("react/jsx-runtime");
function LibraryTab({ focusAssetId, version, onUseAsReference, notify, onChanged, onOpenJobs }) {
  const [items, setItems] = (0, import_react5.useState)([]);
  const [total, setTotal] = (0, import_react5.useState)(0);
  const [query, setQuery] = (0, import_react5.useState)("");
  const [kind, setKind] = (0, import_react5.useState)("all");
  const [favorites, setFavorites] = (0, import_react5.useState)(false);
  const [loading, setLoading] = (0, import_react5.useState)(true);
  const [detail, setDetail] = (0, import_react5.useState)(null);
  const [selection, setSelection] = (0, import_react5.useState)([]);
  const [importPath, setImportPath] = (0, import_react5.useState)("");
  const [importOpen, setImportOpen] = (0, import_react5.useState)(false);
  const [concatenating, setConcatenating] = (0, import_react5.useState)(false);
  const [jobId, setJobId] = (0, import_react5.useState)(null);
  const handledFocus = (0, import_react5.useRef)(null);
  const load = (0, import_react5.useCallback)(async (search, filter, onlyFavorites) => {
    setLoading(true);
    try {
      const params = { limit: "120" };
      if (search.trim() !== "") params.query = search.trim();
      if (filter !== "all") params.kind = filter;
      if (onlyFavorites) params.favorite = "1";
      const result = await api.library(params);
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);
  (0, import_react5.useEffect)(() => {
    const timer = window.setTimeout(() => {
      void load(query, kind, favorites);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, kind, favorites, load, version]);
  (0, import_react5.useEffect)(() => {
    if (focusAssetId === null || handledFocus.current === focusAssetId) return;
    const found = items.find((item) => item.id === focusAssetId);
    if (found !== void 0) {
      handledFocus.current = focusAssetId;
      setDetail(found);
    }
  }, [focusAssetId, items]);
  const reload = () => {
    void load(query, kind, favorites);
    onChanged();
  };
  const toggleFavorite = async (asset) => {
    try {
      const result = await api.favorite(asset.id, !asset.favorite);
      setItems((current) => current.map((item) => item.id === asset.id ? result.asset : item));
      if (detail?.id === asset.id) setDetail(result.asset);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  };
  const remove = async (asset) => {
    try {
      await api.remove(asset.id);
      setItems((current) => current.filter((item) => item.id !== asset.id));
      setDetail(null);
      setSelection((current) => current.filter((id) => id !== asset.id));
      notify("\u5DF2\u5220\u9664", "ok");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    }
  };
  const concatSelected = async () => {
    if (selection.length < 2) return;
    setConcatenating(true);
    try {
      const result = await api.concat({ ids: selection });
      setJobId(result.job.jobId);
      setSelection([]);
      notify("\u5F00\u59CB\u62FC\u63A5\uFF0C\u5B8C\u6210\u540E\u53EF\u5728\u300C\u4EFB\u52A1\u300D\u67E5\u770B", "ok");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setConcatenating(false);
    }
  };
  (0, import_react5.useEffect)(() => {
    if (jobId === null) return void 0;
    const timer = window.setInterval(async () => {
      try {
        const result = await api.job(jobId);
        if (result.job.state !== "running" && result.job.state !== "queued") {
          window.clearInterval(timer);
          if (result.job.state === "succeeded") {
            notify("\u62FC\u63A5\u5B8C\u6210", "ok");
            reload();
          } else {
            notify(result.job.error ?? "\u62FC\u63A5\u5931\u8D25", "error");
          }
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [jobId, notify]);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-library", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-search", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "grid", size: 14 }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { value: query, placeholder: "\u641C\u7D22\u63D0\u793A\u8BCD\u3001\u6587\u4EF6\u540D\u3001\u6A21\u578B\u2026", onChange: (event) => setQuery(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        Segmented,
        {
          value: kind,
          onChange: setKind,
          options: [{ value: "all", label: "\u5168\u90E8" }, { value: "image", label: "\u56FE\u7247" }, { value: "video", label: "\u89C6\u9891" }]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("button", { type: "button", className: `ms-chip${favorites ? " on" : ""}`, onClick: () => setFavorites((value) => !value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "star", size: 13 }),
        "\u6536\u85CF"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-toolbar-right", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "ms-hint", children: [
          total,
          " \u4E2A\u7D20\u6750"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "ghost", icon: "folder", onClick: () => setImportOpen(true), children: "\u767B\u8BB0\u6587\u4EF6" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "ghost", icon: "refresh", onClick: () => {
          void api.scan().then((result) => {
            notify(`\u626B\u63CF\u5B8C\u6210\uFF0C\u65B0\u589E ${String(result.added)} \u4E2A`);
            reload();
          }).catch((error) => notify(String(error), "error"));
        }, children: "\u626B\u63CF" })
      ] })
    ] }),
    selection.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-selectbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
        "\u5DF2\u9009 ",
        selection.length,
        " \u6BB5\u89C6\u9891"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-inline-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "primary", icon: "layers", disabled: selection.length < 2 || concatenating, onClick: () => {
          void concatSelected();
        }, children: concatenating ? "\u62FC\u63A5\u4E2D\u2026" : "\u62FC\u63A5\u6210\u7247" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "ghost", onClick: () => setSelection([]), children: "\u53D6\u6D88\u9009\u62E9" })
      ] })
    ] }) : null,
    loading ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-loading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Spinner, {}),
      " \u8BFB\u53D6\u7D20\u6750\u2026"
    ] }) : null,
    !loading && items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Empty, { icon: "grid", title: "\u7D20\u6750\u5E93\u662F\u7A7A\u7684", hint: "\u751F\u6210\u7684\u56FE\u7247\u548C\u89C6\u9891\u4F1A\u81EA\u52A8\u8FDB\u6765\uFF1B\u4E5F\u53EF\u4EE5\u300C\u767B\u8BB0\u6587\u4EF6\u300D\u628A\u672C\u673A\u5DF2\u6709\u7684\u5A92\u4F53\u52A0\u8FDB\u6765\u3002", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "soft", icon: "folder", onClick: () => setImportOpen(true), children: "\u767B\u8BB0\u672C\u673A\u6587\u4EF6" }) }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "ms-grid", children: items.map((asset) => {
      const selectable = asset.kind === "video";
      const selected = selection.includes(asset.id);
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "ms-grid-cell", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        AssetTile,
        {
          asset,
          selected,
          onClick: () => setDetail(asset),
          onFavorite: () => {
            void toggleFavorite(asset);
          },
          footer: selectable ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("label", { className: "ms-select-toggle", onClick: (event) => event.stopPropagation(), children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
              "input",
              {
                type: "checkbox",
                checked: selected,
                onChange: (event) => setSelection((current) => event.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id))
              }
            ),
            "\u9009\u62E9"
          ] }) : void 0
        }
      ) }, asset.id);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Modal, { open: detail !== null, onClose: () => setDetail(null), title: detail?.name, wide: true, children: detail === null ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-detail", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "ms-detail-media", children: detail.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("img", { src: detail.url, alt: detail.name }) : detail.kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("video", { src: detail.url, controls: true, autoPlay: true, muted: true, loop: true, playsInline: true }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "ms-file", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "film", size: 26 }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-detail-side", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-detail-tags", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { tone: "accent", children: detail.kind === "video" ? "\u89C6\u9891" : "\u56FE\u7247" }),
          detail.origin === "comfy" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { children: "ComfyUI" }) : null,
          detail.channel === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { children: detail.channel }),
          detail.model === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Tag, { children: detail.model }),
          detail.favorite ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(Tag, { tone: "ok", children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "star", size: 10 }),
            "\u6536\u85CF"
          ] }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "ms-detail-prompt", children: detail.prompt ?? "\uFF08\u6CA1\u6709\u8BB0\u5F55\u63D0\u793A\u8BCD\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dl", { className: "ms-kv", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u6587\u4EF6" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { title: detail.path, children: detail.path }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u5927\u5C0F" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: bytes(detail.bytes) }),
          detail.width === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u5C3A\u5BF8" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dd", { children: [
              detail.width,
              "\xD7",
              detail.height
            ] })
          ] }),
          detail.duration === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u65F6\u957F" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("dd", { children: [
              detail.duration.toFixed(1),
              "s"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u521B\u5EFA" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: when(detail.createdAt) }),
          detail.tags.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dt", { children: "\u6807\u7B7E" }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("dd", { children: detail.tags.join(" \xB7 ") })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-detail-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "primary", icon: "sparkles", onClick: () => onUseAsReference(detail), children: "\u4F5C\u53C2\u8003\u56FE" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("a", { className: "ms-btn ghost sm", href: detail.url, download: detail.name, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Icon, { name: "download", size: 14 }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: "\u4E0B\u8F7D" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "ghost", icon: "star", onClick: () => {
            void toggleFavorite(detail);
          }, children: detail.favorite ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { size: "sm", variant: "danger", icon: "trash", onClick: () => {
            void remove(detail);
          }, children: "\u5220\u9664" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Modal, { open: importOpen, onClose: () => setImportOpen(false), title: "\u767B\u8BB0\u672C\u673A\u6587\u4EF6", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-import-form", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("p", { className: "ms-hint", children: "\u586B\u5199\u7EDD\u5BF9\u8DEF\u5F84\uFF08\u5DE5\u4F5C\u533A\u5185\u4E5F\u53EF\u4EE5\u5199\u76F8\u5BF9\u8DEF\u5F84\uFF09\u3002\u6587\u4EF6\u4E0D\u4F1A\u88AB\u590D\u5236\uFF0C\u53EA\u767B\u8BB0\u8FDB\u7D20\u6750\u5E93\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("input", { className: "ms-input", value: importPath, placeholder: "D:\\\\work\\\\output\\\\hero.png", onChange: (event) => setImportPath(event.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "ms-submit-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          Button,
          {
            variant: "primary",
            icon: "upload",
            disabled: importPath.trim() === "",
            onClick: () => {
              if (importPath.trim() === "") return;
              void api.importPath(importPath.trim()).then((result) => {
                setImportOpen(false);
                setImportPath("");
                notify(`\u5DF2\u767B\u8BB0 ${result.asset.name}`, "ok");
                reload();
              }).catch((error) => notify(error instanceof Error ? error.message : String(error), "error"));
            },
            children: "\u767B\u8BB0"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Button, { variant: "ghost", onClick: () => setImportOpen(false), children: "\u53D6\u6D88" })
      ] })
    ] }) })
  ] });
}

// src/client/tabs/ChannelsTab.tsx
var import_react6 = require("react");
var import_jsx_runtime8 = require("react/jsx-runtime");
var KINDS = [
  { value: "openai", label: "OpenAI Images / Sora", baseUrl: "https://api.openai.com/v1" },
  { value: "openai-compat", label: "OpenAI \u517C\u5BB9\u4E2D\u8F6C", baseUrl: "https://api.example.com/v1" },
  { value: "google", label: "Google Gemini / Veo", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { value: "dashscope", label: "\u963F\u91CC\u4E91\u767E\u70BC Qwen / Wan", baseUrl: "https://dashscope.aliyuncs.com/api/v1" },
  { value: "ark", label: "\u706B\u5C71\u65B9\u821F Seedream / Seedance", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  { value: "xai", label: "xAI Grok Imagine", baseUrl: "https://api.x.ai/v1" },
  { value: "comfyui", label: "ComfyUI", baseUrl: "" }
];
function draftOf(channel) {
  return {
    id: channel.id,
    label: channel.label,
    kind: channel.kind,
    enabled: channel.enabled !== false,
    baseUrl: channel.baseUrl ?? "",
    apiKey: "",
    apiKeyEnv: channel.apiKeyEnv ?? "",
    imageModel: channel.imageModel ?? "",
    videoModel: channel.videoModel ?? ""
  };
}
function ChannelsTab({ config, onSaved, notify }) {
  const [drafts, setDrafts] = (0, import_react6.useState)({});
  const [openId, setOpenId] = (0, import_react6.useState)(null);
  const [testing, setTesting] = (0, import_react6.useState)(null);
  const [testResult, setTestResult] = (0, import_react6.useState)({});
  const [saving, setSaving] = (0, import_react6.useState)(false);
  const [addOpen, setAddOpen] = (0, import_react6.useState)(false);
  const [newKind, setNewKind] = (0, import_react6.useState)("openai");
  const [newId, setNewId] = (0, import_react6.useState)("");
  const [newLabel, setNewLabel] = (0, import_react6.useState)("");
  const [advancedOpen, setAdvancedOpen] = (0, import_react6.useState)(false);
  const [outputDir, setOutputDir] = (0, import_react6.useState)(config.outputDir ?? "");
  const [ffmpegPath, setFfmpegPath] = (0, import_react6.useState)(config.ffmpegPath ?? "");
  const [importRoots, setImportRoots] = (0, import_react6.useState)(config.importRoots.join(", "));
  const [workflows, setWorkflows] = (0, import_react6.useState)([]);
  const [comfyOnline, setComfyOnline] = (0, import_react6.useState)(false);
  const [loadingFlows, setLoadingFlows] = (0, import_react6.useState)(false);
  (0, import_react6.useEffect)(() => {
    setDrafts(Object.fromEntries(config.channels.map((channel) => [channel.id, draftOf(channel)])));
    setOutputDir(config.outputDir ?? "");
    setFfmpegPath(config.ffmpegPath ?? "");
    setImportRoots(config.importRoots.join(", "));
  }, [config]);
  const loadWorkflows = (0, import_react6.useCallback)(async () => {
    setLoadingFlows(true);
    try {
      const result = await api.workflows();
      setWorkflows(result.workflows);
      setComfyOnline(result.online);
    } catch {
      setWorkflows([]);
    } finally {
      setLoadingFlows(false);
    }
  }, []);
  (0, import_react6.useEffect)(() => {
    void loadWorkflows();
  }, [loadWorkflows]);
  const patchDraft = (id, patch) => {
    setDrafts((current) => current[id] === void 0 ? current : { ...current, [id]: { ...current[id], ...patch } });
  };
  const saveAll = async (nextDrafts, extra = {}) => {
    const source = nextDrafts ?? drafts;
    setSaving(true);
    try {
      const channels = Object.values(source).map((draft) => ({
        id: draft.id,
        label: draft.label,
        kind: draft.kind,
        enabled: draft.enabled,
        baseUrl: draft.baseUrl,
        ...draft.apiKey.trim() === "" ? {} : { apiKey: draft.apiKey.trim() },
        ...draft.apiKeyEnv.trim() === "" ? {} : { apiKeyEnv: draft.apiKeyEnv.trim() },
        ...draft.imageModel.trim() === "" ? {} : { imageModel: draft.imageModel.trim() },
        ...draft.videoModel.trim() === "" ? {} : { videoModel: draft.videoModel.trim() }
      }));
      await api.saveConfig({ channels, ...extra });
      notify("\u5DF2\u4FDD\u5B58", "ok");
      onSaved();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSaving(false);
    }
  };
  const test = async (id) => {
    setTesting(id);
    try {
      const result = await api.testChannel(id);
      setTestResult((current) => ({ ...current, [id]: { ok: result.ok, detail: `${result.detail}${result.latencyMs === void 0 ? "" : ` \xB7 ${String(result.latencyMs)}ms`}` } }));
    } catch (error) {
      setTestResult((current) => ({ ...current, [id]: { ok: false, detail: error instanceof Error ? error.message : String(error) } }));
    } finally {
      setTesting(null);
    }
  };
  const addChannel = () => {
    const id = newId.trim() || `${newKind}-${String(Date.now()).slice(-4)}`;
    const meta = KINDS.find((item) => item.value === newKind);
    setDrafts((current) => ({
      ...current,
      [id]: {
        id,
        label: newLabel.trim() || meta.label,
        kind: newKind,
        enabled: true,
        baseUrl: meta.baseUrl,
        apiKey: "",
        apiKeyEnv: "",
        imageModel: "",
        videoModel: ""
      }
    }));
    setAddOpen(false);
    setNewId("");
    setNewLabel("");
    setOpenId(id);
  };
  const removeChannel = async (id) => {
    const next = { ...drafts };
    delete next[id];
    setDrafts(next);
    await saveAll(next);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-channels", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-channels-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { children: "\u901A\u9053" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ms-hint", children: "\u6BCF\u4E2A\u901A\u9053\u5C31\u662F\u4E00\u5957\u4E0A\u6E38\u914D\u7F6E\uFF1A\u534F\u8BAE\u65CF\u3001\u5730\u5740\u3001Key\u3001\u9ED8\u8BA4\u6A21\u578B\u3002\u56FE\u50CF\u4E0E\u89C6\u9891\u5171\u7528\u540C\u4E00\u5F20\u8868\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-inline-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", icon: "settings", onClick: () => setAdvancedOpen(true), children: "\u9AD8\u7EA7" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "primary", icon: "plus", onClick: () => setAddOpen(true), children: "\u6DFB\u52A0\u901A\u9053" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "ms-channel-list", children: config.channels.map((channel) => {
      const draft = drafts[channel.id] ?? draftOf(channel);
      const open = openId === channel.id;
      return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: `ms-channel${open ? " open" : ""}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("button", { type: "button", className: "ms-channel-head", onClick: () => setOpenId(open ? null : channel.id), children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `ms-dot${channel.ready ? " on" : ""}` }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ms-channel-name", children: draft.label }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ms-channel-kind", children: channel.kind }),
          channel.capabilities.map((capability) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { children: capability === "image" ? "\u56FE" : capability === "video" ? "\u89C6\u9891" : "\u5DE5\u4F5C\u6D41" }, capability)),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ms-channel-key", children: channel.keyHint }),
          channel.ready ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { tone: "ok", children: "\u5C31\u7EEA" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { tone: "danger", children: "\u7F3A\u914D\u7F6E" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: "chevron", size: 14, className: open ? "rot90" : "" })
        ] }),
        open ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-channel-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-grid-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: draft.label, onChange: (event) => patchDraft(channel.id, { label: event.target.value }) }) }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5730\u5740", hint: draft.kind === "comfyui" ? "\u586B ComfyUI \u7684\u6839\u5730\u5740\uFF0C\u53EF\u7701\u7565 http://" : "\u4E0D\u542B\u5C3E\u659C\u6760\uFF1BGoogle \u586B\u5230 /v1beta\uFF0C\u5176\u4ED6\u586B\u5230 /v1 \u6216 /api/v3", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: draft.baseUrl, onChange: (event) => patchDraft(channel.id, { baseUrl: event.target.value }) }) })
          ] }),
          draft.kind === "comfyui" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ms-hint", children: "ComfyUI \u4E0D\u9700\u8981 API Key\uFF1B\u5730\u5740\u586B\u6839\u8DEF\u5F84\u5373\u53EF\uFF0C\u4E0D\u5199 http:// \u4E5F\u4F1A\u81EA\u52A8\u8865\u3002 \u5DE5\u4F5C\u6D41\u5728\u300C\u521B\u4F5C \u2192 ComfyUI\u300D\u5BFC\u5165\uFF0C\u53D8\u91CF\u4E0E\u56FE\u7247\u69FD\u4F4D\u4F1A\u4ECE\u5DE5\u4F5C\u6D41\u91CC\u63A8\u65AD\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-grid-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "API Key", hint: channel.keySource === "env" ? `\u5F53\u524D\u6765\u81EA\u73AF\u5883\u53D8\u91CF ${channel.apiKeyEnv ?? ""}\uFF1B\u586B\u5199\u4F1A\u8986\u76D6` : "\u7559\u7A7A\u4FDD\u6301\u73B0\u6709 Key", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", type: "password", value: draft.apiKey, placeholder: channel.keySource === "inline" ? "\u5DF2\u4FDD\u5B58\uFF08\u7559\u7A7A\u4E0D\u4FEE\u6539\uFF09" : "sk-\u2026", onChange: (event) => patchDraft(channel.id, { apiKey: event.target.value }) }) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u73AF\u5883\u53D8\u91CF\u540D", hint: "\u6CA1\u6709 Key \u65F6\u8BFB\u8FD9\u4E2A\u53D8\u91CF", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: draft.apiKeyEnv, placeholder: "OPENAI_API_KEY", onChange: (event) => patchDraft(channel.id, { apiKeyEnv: event.target.value }) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-grid-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u9ED8\u8BA4\u56FE\u50CF\u6A21\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: draft.imageModel, onChange: (event) => patchDraft(channel.id, { imageModel: event.target.value }) }) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u9ED8\u8BA4\u89C6\u9891\u6A21\u578B", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: draft.videoModel, onChange: (event) => patchDraft(channel.id, { videoModel: event.target.value }) }) })
            ] })
          ] }),
          testResult[channel.id] === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: `ms-test ${testResult[channel.id].ok ? "ok" : "bad"}`, children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Icon, { name: testResult[channel.id].ok ? "check" : "alert", size: 13 }),
            testResult[channel.id].detail
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-channel-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "primary", disabled: saving, onClick: () => {
              void saveAll(void 0, { defaults: config.defaults });
            }, children: "\u4FDD\u5B58" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "soft", icon: testing === channel.id ? void 0 : "plug", disabled: testing === channel.id, onClick: () => {
              void test(channel.id);
            }, children: testing === channel.id ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "ms-check", children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { type: "checkbox", checked: draft.enabled, onChange: (event) => patchDraft(channel.id, { enabled: event.target.checked }) }),
              "\u542F\u7528"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ms-spacer" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "danger", icon: "trash", onClick: () => {
              void removeChannel(channel.id);
            }, children: "\u5220\u9664" })
          ] })
        ] }) : null
      ] }, channel.id);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-defaults", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { children: "\u9ED8\u8BA4\u901A\u9053" }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-grid-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u56FE\u50CF\u9ED8\u8BA4", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "select",
          {
            className: "ms-select",
            value: config.defaults.image ?? "",
            onChange: (event) => {
              void saveAll(void 0, { defaults: { ...config.defaults, image: event.target.value || void 0 } });
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "", children: "\u81EA\u52A8\uFF08\u7B2C\u4E00\u4E2A\u5C31\u7EEA\uFF09" }),
              config.channels.filter((channel) => channel.capabilities.includes("image")).map((channel) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: channel.id, children: channel.label }, channel.id))
            ]
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u89C6\u9891\u9ED8\u8BA4", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "select",
          {
            className: "ms-select",
            value: config.defaults.video ?? "",
            onChange: (event) => {
              void saveAll(void 0, { defaults: { ...config.defaults, video: event.target.value || void 0 } });
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: "", children: "\u81EA\u52A8\uFF08\u7B2C\u4E00\u4E2A\u5C31\u7EEA\uFF09" }),
              config.channels.filter((channel) => channel.capabilities.includes("video")).map((channel) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: channel.id, children: channel.label }, channel.id))
            ]
          }
        ) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-comfy-admin", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-channels-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("h3", { children: "ComfyUI \u5DE5\u4F5C\u6D41" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ms-hint", children: "\u5BFC\u5165\u540E\u7684\u5DE5\u4F5C\u6D41\u5BF9 Agent \u53EF\u89C1\uFF1B\u53D8\u91CF\u4E0E\u56FE\u7247\u69FD\u4F4D\u4ECE\u56FE\u91CC\u63A8\u65AD\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-inline-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Tag, { tone: comfyOnline ? "ok" : "danger", children: comfyOnline ? "\u5728\u7EBF" : "\u79BB\u7EBF" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { size: "sm", variant: "ghost", icon: "refresh", onClick: () => {
            void loadWorkflows();
          }, children: "\u5237\u65B0" })
        ] })
      ] }),
      loadingFlows ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-loading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Spinner, {}),
        " \u8BFB\u53D6\u4E2D\u2026"
      ] }) : null,
      !loadingFlows && workflows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("p", { className: "ms-hint", children: "\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u6D41\u3002\u5230\u300C\u521B\u4F5C \u2192 ComfyUI\u300D\u5BFC\u5165\u4E00\u4EFD API \u683C\u5F0F JSON\u3002" }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "ms-flow-list", children: workflows.map((workflow) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-flow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ms-flow-name", children: workflow.title }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "ms-flow-slots", children: workflow.slots.map((slot) => slot.name).slice(0, 5).join(" \xB7 ") }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("label", { className: "ms-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            "input",
            {
              type: "checkbox",
              checked: workflow.enabled,
              onChange: (event) => {
                void api.updateWorkflow(workflow.workflowId, { enabled: event.target.checked }).then((updated) => {
                  setWorkflows((current) => current.map((item) => item.workflowId === workflow.workflowId ? updated.workflow : item));
                }).catch((error) => notify(String(error), "error"));
              }
            }
          ),
          "\u53EF\u7528"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "button",
          {
            type: "button",
            className: "ms-text-btn danger",
            onClick: () => {
              void api.deleteWorkflow(workflow.workflowId).then(() => {
                setWorkflows((current) => current.filter((item) => item.workflowId !== workflow.workflowId));
                notify("\u5DF2\u5220\u9664\u5DE5\u4F5C\u6D41");
              }).catch((error) => notify(String(error), "error"));
            },
            children: "\u5220\u9664"
          }
        )
      ] }, workflow.workflowId)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { open: addOpen, onClose: () => setAddOpen(false), title: "\u6DFB\u52A0\u901A\u9053", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-add-form", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u534F\u8BAE\u65CF", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("select", { className: "ms-select", value: newKind, onChange: (event) => setNewKind(event.target.value), children: KINDS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("option", { value: item.value, children: item.label }, item.value)) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "id", hint: "\u6A21\u578B\u8C03\u7528\u65F6\u7528\u7684\u6807\u8BC6\uFF0C\u5C0F\u5199\u82F1\u6587", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: newId, placeholder: "my-gateway", onChange: (event) => setNewId(event.target.value) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u663E\u793A\u540D\u79F0", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: newLabel, placeholder: "\u6211\u7684\u4E2D\u8F6C\u7AD9", onChange: (event) => setNewLabel(event.target.value) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-submit-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "primary", onClick: addChannel, children: "\u6DFB\u52A0" }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", onClick: () => setAddOpen(false), children: "\u53D6\u6D88" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Modal, { open: advancedOpen, onClose: () => setAdvancedOpen(false), title: "\u9AD8\u7EA7\u8BBE\u7F6E", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-advanced", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u8F93\u51FA\u76EE\u5F55", hint: "\u7559\u7A7A = <\u5DE5\u4F5C\u533A>/media-studio\uFF1B\u6539\u5B8C\u9700\u91CD\u542F DSH", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: outputDir, placeholder: "D:\\\\ai\\\\media", onChange: (event) => setOutputDir(event.target.value) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "ffmpeg \u8DEF\u5F84", hint: "\u7559\u7A7A\u81EA\u52A8\u5728 PATH / \u5E38\u89C1\u76EE\u5F55\u91CC\u627E\uFF1B\u6539\u5B8C\u9700\u91CD\u542F DSH", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: ffmpegPath, placeholder: "C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe", onChange: (event) => setFfmpegPath(event.target.value) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Field, { label: "\u5141\u8BB8\u5BFC\u5165\u7684\u989D\u5916\u76EE\u5F55", hint: "\u9017\u53F7\u5206\u9694\uFF1B\u5DE5\u4F5C\u533A\u4E0E\u8F93\u51FA\u76EE\u5F55\u59CB\u7EC8\u5141\u8BB8", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("input", { className: "ms-input", value: importRoots, placeholder: "D:\\\\pictures, E:\\\\refs", onChange: (event) => setImportRoots(event.target.value) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "ms-submit-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          Button,
          {
            variant: "primary",
            disabled: saving,
            onClick: () => {
              void saveAll(void 0, {
                outputDir: outputDir.trim() === "" ? null : outputDir.trim(),
                ffmpegPath: ffmpegPath.trim() === "" ? null : ffmpegPath.trim(),
                importRoots: importRoots.split(",").map((item) => item.trim()).filter((item) => item !== "")
              }).then(() => setAdvancedOpen(false));
            },
            children: "\u4FDD\u5B58"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(Button, { variant: "ghost", onClick: () => setAdvancedOpen(false), children: "\u53D6\u6D88" })
      ] })
    ] }) })
  ] });
}

// src/client/styles.css
var styles_default = "/**\n * dsh-media-studio panel styles.\n *\n * Only host tokens (`--dsw-alias-*`) are used for colour, so light/dark and any\n * user theme follow automatically. Layout is a two-column composer that becomes\n * one column when the panel is docked to a narrow sidebar.\n */\n\n.ms-root{\n  --ms-accent:var(--dsw-alias-state-business-primary,#6d5efc);\n  --ms-bg:var(--dsw-alias-bg-base,#fff);\n  --ms-surface:var(--dsw-alias-bg-layer-1,#f7f7f9);\n  --ms-sunken:var(--dsw-alias-bg-layer-2,#eeeef2);\n  --ms-text:var(--dsw-alias-label-primary,#1d1d22);\n  --ms-muted:var(--dsw-alias-label-secondary,#6c6f78);\n  --ms-line:var(--dsw-alias-border-l3,#e2e2e8);\n  --ms-line-strong:var(--dsw-alias-border-l2,#cfcfd8);\n  --ms-danger:var(--dsw-alias-state-error-primary,#c0453f);\n  --ms-ok:var(--dsw-alias-state-success-primary,#3f8f5f);\n  color:var(--ms-text);\n  font-family:inherit;\n  font-size:var(--dsh-content-font-size,14px);\n  line-height:1.5;\n  height:100%;\n  min-height:0;\n  display:flex;\n  flex-direction:column;\n  container-type:inline-size;\n  background:var(--ms-bg);\n}\n.ms-root *,.ms-root *::before,.ms-root *::after{box-sizing:border-box}\n.ms-root button,.ms-root input,.ms-root select,.ms-root textarea{font:inherit;color:inherit}\n.ms-root :focus-visible{outline:2px solid color-mix(in srgb,var(--ms-accent) 55%,transparent);outline-offset:1px}\n.ms-root a{color:inherit;text-decoration:none}\n\n/* \u2500\u2500 header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 22px 10px;flex-shrink:0}\n.ms-brand{display:flex;align-items:center;gap:11px;min-width:0}\n.ms-brand-mark{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#7b6cff,#4a3ed6);box-shadow:0 4px 14px -6px #4a3ed6a8;flex-shrink:0}\n.ms-brand-text{display:flex;flex-direction:column;min-width:0;line-height:1.25}\n.ms-brand-text strong{font-size:1.02em;letter-spacing:.01em}\n.ms-brand-text span{font-size:.78em;color:var(--ms-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ms-header-meta{display:flex;align-items:center;gap:10px;flex-shrink:0}\n.ms-live{display:inline-flex;align-items:center;gap:6px;font-size:.78em;color:var(--ms-accent);background:color-mix(in srgb,var(--ms-accent) 10%,transparent);padding:4px 9px;border-radius:999px}\n.ms-icon-btn{appearance:none;border:0;background:transparent;color:var(--ms-muted);width:30px;height:30px;border-radius:9px;display:grid;place-items:center;cursor:pointer;transition:background .12s ease,color .12s ease}\n.ms-icon-btn:hover{background:var(--ms-surface);color:var(--ms-text)}\n\n/* \u2500\u2500 tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-tabs{display:flex;gap:4px;padding:0 18px;border-bottom:1px solid var(--ms-line);flex-shrink:0}\n.ms-tab{appearance:none;border:0;background:transparent;color:var(--ms-muted);padding:10px 12px 11px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-size:.9em;position:relative;border-radius:8px 8px 0 0;transition:color .12s ease,background .12s ease}\n.ms-tab:hover{color:var(--ms-text);background:color-mix(in srgb,var(--ms-surface) 70%,transparent)}\n.ms-tab.on{color:var(--ms-text);font-weight:600}\n.ms-tab.on::after{content:'';position:absolute;left:12px;right:12px;bottom:-1px;height:2px;border-radius:2px;background:var(--ms-accent)}\n.ms-tab em{font-style:normal;font-size:.72em;background:var(--ms-accent);color:#fff;border-radius:999px;padding:1px 6px;min-width:17px;text-align:center}\n\n/* \u2500\u2500 body / states \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\n.ms-body>*{flex:1;min-height:0}\n.ms-loading{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--ms-muted);padding:40px;font-size:.9em}\n.ms-error{display:flex;gap:12px;margin:24px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--ms-danger) 35%,var(--ms-line));background:color-mix(in srgb,var(--ms-danger) 6%,transparent);border-radius:14px;color:var(--ms-text);align-items:flex-start}\n.ms-error strong{display:block;margin-bottom:3px}\n.ms-error p{margin:2px 0;font-size:.86em;color:var(--ms-muted);word-break:break-all}\n.ms-toast{position:fixed;right:26px;bottom:26px;z-index:60;display:flex;align-items:center;gap:8px;max-width:min(460px,80vw);padding:10px 14px;border-radius:12px;border:1px solid var(--ms-line);background:var(--ms-bg);box-shadow:0 12px 32px -12px #00000038;font-size:.88em;animation:ms-in .18s ease-out}\n.ms-toast.ok{border-color:color-mix(in srgb,var(--ms-ok) 45%,var(--ms-line))}\n.ms-toast.error{border-color:color-mix(in srgb,var(--ms-danger) 45%,var(--ms-line))}\n@keyframes ms-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}\n\n/* \u2500\u2500 primitives \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-btn{appearance:none;border:1px solid transparent;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:.88em;padding:8px 14px;transition:background .12s ease,border-color .12s ease,opacity .12s ease;white-space:nowrap}\n.ms-btn.sm{padding:5px 10px;border-radius:8px;font-size:.82em}\n.ms-btn.primary{background:var(--ms-accent);color:#fff;box-shadow:0 6px 16px -10px color-mix(in srgb,var(--ms-accent) 80%,transparent)}\n.ms-btn.primary:hover{filter:brightness(1.05)}\n.ms-btn.soft{background:var(--ms-surface);border-color:var(--ms-line);color:var(--ms-text)}\n.ms-btn.soft:hover{background:var(--ms-sunken)}\n.ms-btn.ghost{background:transparent;border-color:var(--ms-line);color:var(--ms-muted)}\n.ms-btn.ghost:hover{background:var(--ms-surface);color:var(--ms-text)}\n.ms-btn.danger{background:transparent;border-color:color-mix(in srgb,var(--ms-danger) 35%,var(--ms-line));color:var(--ms-danger)}\n.ms-btn.danger:hover{background:color-mix(in srgb,var(--ms-danger) 8%,transparent)}\n.ms-btn:disabled{opacity:.45;cursor:not-allowed;filter:none}\n.ms-btn span{pointer-events:none}\n.ms-text-btn{appearance:none;border:0;background:transparent;color:var(--ms-muted);font-size:.82em;display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:3px 4px;border-radius:6px}\n.ms-text-btn:hover{color:var(--ms-text);background:var(--ms-surface)}\n.ms-text-btn.danger{color:var(--ms-danger)}\n.ms-text-btn.danger:hover{background:color-mix(in srgb,var(--ms-danger) 9%,transparent)}\n.ms-field{display:flex;flex-direction:column;gap:6px;min-width:0}\n.ms-field-label{font-size:.8em;color:var(--ms-muted);display:flex;align-items:center;justify-content:space-between;gap:8px}\n.ms-hint{font-size:.76em;color:var(--ms-muted);line-height:1.45}\n.ms-input,.ms-select,.ms-textarea{width:100%;border:1px solid var(--ms-line);background:var(--ms-surface);border-radius:10px;padding:8px 11px;font-size:.9em;color:var(--ms-text);transition:border-color .12s ease,background .12s ease,box-shadow .12s ease}\n.ms-input:hover,.ms-select:hover,.ms-textarea:hover{border-color:var(--ms-line-strong)}\n.ms-input:focus,.ms-select:focus,.ms-textarea:focus{outline:none;border-color:var(--ms-accent);background:var(--ms-bg);box-shadow:0 0 0 3px color-mix(in srgb,var(--ms-accent) 12%,transparent)}\n.ms-input.mini{width:64px;padding:4px 7px;font-size:.82em;border-radius:7px}\n.ms-input:disabled{opacity:.55}\n.ms-textarea{resize:vertical;line-height:1.6;min-height:96px}\n.ms-textarea.small{min-height:auto;font-size:.87em}\n.ms-textarea.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.8em;line-height:1.5}\n.ms-select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--ms-muted) 50%),linear-gradient(135deg,var(--ms-muted) 50%,transparent 50%);background-position:calc(100% - 15px) 52%,calc(100% - 10px) 52%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:30px}\n.ms-static{display:inline-flex;align-items:center;min-height:36px;font-size:.88em;color:var(--ms-muted)}\n.ms-seg{display:inline-flex;padding:3px;gap:2px;background:var(--ms-sunken);border-radius:11px;flex-wrap:wrap}\n.ms-seg button{appearance:none;border:0;background:transparent;color:var(--ms-muted);font-size:.85em;padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:background .12s ease,color .12s ease,box-shadow .12s ease}\n.ms-seg button:hover{color:var(--ms-text)}\n.ms-seg button.on{background:var(--ms-bg);color:var(--ms-text);box-shadow:0 1px 3px #0000001f;font-weight:600}\n.ms-seg.sm button{padding:4px 9px;font-size:.78em}\n.ms-spinner{display:inline-block;border-radius:50%;border:2px solid var(--ms-line);border-top-color:var(--ms-accent);animation:ms-spin .7s linear infinite;flex-shrink:0}\n@keyframes ms-spin{to{transform:rotate(360deg)}}\n.ms-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:56px 24px;color:var(--ms-muted);text-align:center}\n.ms-empty-title{font-weight:600;color:var(--ms-text)}\n.ms-empty-hint{font-size:.84em;max-width:420px}\n.ms-tag{display:inline-flex;align-items:center;gap:4px;font-size:.72em;line-height:1;padding:4px 7px;border-radius:6px;background:var(--ms-surface);color:var(--ms-muted);border:1px solid var(--ms-line)}\n.ms-tag.accent{background:color-mix(in srgb,var(--ms-accent) 12%,transparent);color:var(--ms-accent);border-color:color-mix(in srgb,var(--ms-accent) 30%,transparent)}\n.ms-tag.ok{background:color-mix(in srgb,var(--ms-ok) 12%,transparent);color:var(--ms-ok);border-color:color-mix(in srgb,var(--ms-ok) 30%,transparent)}\n.ms-tag.danger{background:color-mix(in srgb,var(--ms-danger) 10%,transparent);color:var(--ms-danger);border-color:color-mix(in srgb,var(--ms-danger) 28%,transparent)}\n.ms-check{display:inline-flex;align-items:center;gap:6px;font-size:.82em;color:var(--ms-muted);cursor:pointer;user-select:none}\n.ms-check input{accent-color:var(--ms-accent);width:14px;height:14px}\n.ms-spacer{flex:1}\n.ms-inline-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}\n.ms-inline-status{display:inline-flex;align-items:center;gap:6px;font-size:.8em;color:var(--ms-muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-dot{width:7px;height:7px;border-radius:50%;background:var(--ms-line-strong);flex-shrink:0}\n.ms-dot.on{background:var(--ms-ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ms-ok) 16%,transparent)}\n.ms-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.ms-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}\n.ms-toolbar{display:flex;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid var(--ms-line);flex-wrap:wrap;flex-shrink:0}\n.ms-toolbar-right{margin-left:auto;display:flex;align-items:center;gap:8px}\n.ms-search{display:flex;align-items:center;gap:7px;background:var(--ms-surface);border:1px solid var(--ms-line);border-radius:10px;padding:0 10px;height:32px;min-width:180px;color:var(--ms-muted)}\n.ms-search input{border:0;background:transparent;outline:none;font-size:.86em;min-width:0;flex:1;color:var(--ms-text)}\n.ms-chip{appearance:none;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--ms-line);background:transparent;color:var(--ms-muted);border-radius:999px;padding:5px 11px;font-size:.8em;cursor:pointer}\n.ms-chip.on{color:var(--ms-accent);border-color:color-mix(in srgb,var(--ms-accent) 45%,transparent);background:color-mix(in srgb,var(--ms-accent) 10%,transparent)}\n.ms-selectbar{display:flex;align-items:center;gap:12px;padding:8px 20px;background:color-mix(in srgb,var(--ms-accent) 7%,transparent);border-bottom:1px solid var(--ms-line);font-size:.84em}\n\n/* \u2500\u2500 create \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-create{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);min-height:0;overflow:hidden}\n.ms-compose{padding:16px 20px 20px;overflow:auto;display:flex;flex-direction:column;gap:14px;min-width:0;border-right:1px solid var(--ms-line)}\n.ms-mode-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.ms-submit-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-top:2px}\n.ms-refs{display:flex;flex-direction:column;gap:7px}\n.ms-refs-head{display:flex;align-items:center;justify-content:space-between;font-size:.8em;color:var(--ms-muted)}\n.ms-refs-actions{display:flex;gap:4px}\n.ms-drop{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:72px;padding:10px;border:1px dashed var(--ms-line-strong);border-radius:12px;background:color-mix(in srgb,var(--ms-surface) 60%,transparent)}\n.ms-drop-hint{font-size:.8em;color:var(--ms-muted);padding:0 4px}\n.ms-ref{position:relative;width:64px;height:64px;border-radius:9px;overflow:hidden;background:var(--ms-sunken);border:1px solid var(--ms-line)}\n.ms-ref img{width:100%;height:100%;object-fit:cover;display:block}\n.ms-ref-loading{position:absolute;inset:0;display:grid;place-items:center;background:color-mix(in srgb,var(--ms-surface) 75%,transparent)}\n.ms-ref-remove{position:absolute;top:3px;right:3px;width:17px;height:17px;border-radius:50%;border:0;background:#000000a8;color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}\n.ms-result{border-left:0;min-width:0;display:flex;flex-direction:column;overflow:auto;padding:16px 18px 20px;gap:12px;background:color-mix(in srgb,var(--ms-surface) 45%,transparent)}\n.ms-result-head{display:flex;align-items:center;justify-content:space-between;font-size:.86em;color:var(--ms-muted);flex-shrink:0}\n.ms-result-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--ms-muted);border:1px dashed var(--ms-line);border-radius:14px;padding:40px 20px;font-size:.86em;text-align:center;margin-top:8px}\n.ms-result-empty p{margin:0;max-width:260px}\n.ms-result-job{min-width:0}\n.ms-recent{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}\n.ms-recent-item{appearance:none;border:0;padding:0;background:transparent;cursor:pointer;border-radius:9px;overflow:hidden}\n.ms-recent-item .ms-thumb{border-radius:9px}\n.ms-result-hint{display:flex;flex-direction:column;gap:4px;font-size:.76em;color:var(--ms-muted);border-top:1px solid var(--ms-line);padding-top:10px;word-break:break-all}\n\n.ms-comfy-link{appearance:none;border:1px solid color-mix(in srgb,var(--ms-accent) 28%,var(--ms-line));background:color-mix(in srgb,var(--ms-accent) 6%,transparent);color:var(--ms-accent);border-radius:10px;padding:7px 10px;font-size:.8em;display:inline-flex;align-items:center;gap:7px;cursor:pointer;text-align:left;align-self:flex-start;max-width:100%}\n.ms-comfy-link span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-comfy-link:hover{background:color-mix(in srgb,var(--ms-accent) 12%,transparent)}\n\n/* \u2500\u2500 storyboard / shots \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-storyboard{display:flex;flex-direction:column;gap:12px}\n.ms-shot-list{display:flex;flex-direction:column;gap:9px}\n.ms-shot{display:flex;gap:9px;align-items:flex-start}\n.ms-shot-no{width:23px;height:23px;border-radius:7px;background:var(--ms-sunken);color:var(--ms-muted);font-size:.78em;display:grid;place-items:center;flex-shrink:0;margin-top:5px;font-variant-numeric:tabular-nums}\n.ms-shot-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;border:1px solid var(--ms-line);border-radius:11px;padding:8px;background:var(--ms-surface)}\n.ms-shot-body .ms-textarea{border-color:transparent;background:transparent;padding:3px 4px}\n.ms-shot-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.78em;color:var(--ms-muted)}\n.ms-mini-field{display:inline-flex;align-items:center;gap:5px}\n.ms-shot-ref{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-shot-ref img{width:20px;height:20px;border-radius:5px;object-fit:cover}\n.ms-shot-add{display:flex;align-items:center;gap:12px;flex-wrap:wrap}\n.ms-add-shot{appearance:none;border:1px dashed var(--ms-line-strong);background:transparent;color:var(--ms-muted);border-radius:10px;padding:7px 12px;font-size:.83em;display:inline-flex;align-items:center;gap:6px;cursor:pointer}\n.ms-add-shot:hover{color:var(--ms-text);border-color:var(--ms-accent)}\n.ms-toggles{display:flex;gap:16px;flex-wrap:wrap;padding-top:2px}\n\n/* \u2500\u2500 comfy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-comfy{display:flex;flex-direction:column;gap:14px;position:relative}\n.ms-comfy.dragging{outline:1px dashed color-mix(in srgb,var(--ms-accent) 45%,transparent);outline-offset:6px;border-radius:12px}\n.ms-drop-overlay{position:fixed;inset:0;z-index:55;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;background:color-mix(in srgb,var(--ms-bg) 58%,transparent);border:2px dashed var(--ms-accent);color:var(--ms-accent);font-size:.95em;backdrop-filter:blur(1.5px)}\n.ms-import-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.ms-comfy-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}\n.ms-comfy-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:38px 20px;border:1px dashed var(--ms-line);border-radius:14px;text-align:center;color:var(--ms-muted)}\n.ms-comfy-empty p{margin:0;font-size:.86em}\n.ms-comfy-desc{font-size:.84em;color:var(--ms-muted);margin:0}\n.ms-comfy-vars{display:flex;flex-direction:column;gap:12px}\n.ms-slot-image{border:1px solid var(--ms-line);border-radius:12px;padding:9px;background:var(--ms-surface)}\n.ms-slot-image-head{display:flex;align-items:center;justify-content:space-between;font-size:.8em;color:var(--ms-muted);margin-bottom:7px}\n.ms-slot-image-head em{font-style:normal;color:var(--ms-accent);margin-left:4px}\n.ms-slot-drop{display:flex;flex-direction:column;align-items:center;gap:5px;padding:14px;border:1px dashed var(--ms-line-strong);border-radius:9px;cursor:pointer;color:var(--ms-muted);font-size:.8em}\n.ms-slot-drop:hover{border-color:var(--ms-accent);color:var(--ms-text)}\n.ms-slot-preview{width:100%;max-height:180px;object-fit:contain;border-radius:9px;background:var(--ms-sunken)}\n\n/* \u2500\u2500 tiles / jobs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-thumb{position:relative;width:100%;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:var(--ms-sunken);display:grid;place-items:center}\n.ms-thumb.sm{aspect-ratio:1/1;border-radius:8px}\n.ms-thumb img,.ms-thumb video{width:100%;height:100%;object-fit:cover;display:block}\n.ms-thumb .ms-play{position:absolute;right:6px;bottom:6px;width:22px;height:22px;border-radius:50%;background:#000000a0;color:#fff;display:grid;place-items:center}\n.ms-thumb .ms-file{color:var(--ms-muted)}\n.ms-tile{position:relative;border-radius:12px;background:var(--ms-surface);border:1px solid var(--ms-line);overflow:hidden;transition:border-color .12s ease,box-shadow .12s ease}\n.ms-tile:hover{border-color:var(--ms-line-strong);box-shadow:0 8px 20px -16px #00000066}\n.ms-tile.on{border-color:var(--ms-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--ms-accent) 28%,transparent)}\n.ms-tile-main{appearance:none;border:0;background:transparent;padding:0;width:100%;text-align:left;cursor:pointer;display:flex;flex-direction:column}\n.ms-tile-main .ms-thumb{border-radius:0}\n.ms-tile-meta{display:flex;flex-direction:column;gap:2px;padding:8px 10px 9px;min-width:0}\n.ms-tile-name{font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ms-text)}\n.ms-tile-sub{font-size:.72em;color:var(--ms-muted)}\n.ms-star{position:absolute;top:7px;right:7px;width:25px;height:25px;border-radius:8px;border:0;background:#0000006b;color:#fff;display:grid;place-items:center;cursor:pointer;opacity:0;transition:opacity .12s ease}\n.ms-tile:hover .ms-star,.ms-star.on{opacity:1}\n.ms-star.on{color:#ffd66e}\n.ms-tile-action{appearance:none;position:absolute;left:7px;bottom:7px;border:0;border-radius:7px;background:#0000008f;color:#fff;font-size:.72em;padding:4px 8px;cursor:pointer;opacity:0;transition:opacity .12s ease}\n.ms-tile:hover .ms-tile-action{opacity:1}\n.ms-select-toggle{position:absolute;right:7px;bottom:7px;display:inline-flex;align-items:center;gap:4px;font-size:.72em;color:var(--ms-text);background:color-mix(in srgb,var(--ms-bg) 85%,transparent);border:1px solid var(--ms-line);border-radius:7px;padding:3px 6px;cursor:pointer}\n.ms-select-toggle input{accent-color:var(--ms-accent);width:12px;height:12px}\n.ms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:12px;padding:14px 20px 22px;overflow:auto;align-content:start}\n.ms-grid-cell{min-width:0}\n.ms-job-list{display:flex;flex-direction:column;gap:12px;padding:14px 20px 24px;overflow:auto}\n.ms-job{border:1px solid var(--ms-line);border-radius:13px;background:var(--ms-surface);padding:12px 14px;display:flex;flex-direction:column;gap:8px}\n.ms-job.running,.ms-job.queued{border-color:color-mix(in srgb,var(--ms-accent) 35%,var(--ms-line))}\n.ms-job.failed{border-color:color-mix(in srgb,var(--ms-danger) 35%,var(--ms-line))}\n.ms-job-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.78em;color:var(--ms-muted)}\n.ms-job-kind{color:var(--ms-text)}\n.ms-job-channel{background:var(--ms-sunken);padding:2px 7px;border-radius:5px}\n.ms-job-time{margin-left:auto;font-variant-numeric:tabular-nums}\n.ms-job-prompt{font-size:.88em;line-height:1.55;color:var(--ms-text);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}\n.ms-job-progress{display:flex;align-items:center;gap:9px;font-size:.78em;color:var(--ms-muted)}\n.ms-progress-bar{position:relative;flex:1;height:4px;border-radius:99px;background:var(--ms-sunken);overflow:hidden}\n.ms-progress-bar i{position:absolute;inset:0;width:40%;border-radius:99px;background:linear-gradient(90deg,transparent,var(--ms-accent),transparent);animation:ms-slide 1.4s ease-in-out infinite}\n@keyframes ms-slide{0%{transform:translateX(-60%)}100%{transform:translateX(220%)}}\n.ms-job-error{display:flex;align-items:flex-start;gap:6px;font-size:.8em;color:var(--ms-danger);background:color-mix(in srgb,var(--ms-danger) 7%,transparent);border-radius:8px;padding:7px 9px;word-break:break-word}\n.ms-job-assets{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:9px}\n.ms-job-assets .ms-thumb{aspect-ratio:1/1}\n.ms-state{font-size:.72em;padding:2px 7px;border-radius:999px;background:var(--ms-sunken);color:var(--ms-muted)}\n.ms-state.running,.ms-state.queued{background:color-mix(in srgb,var(--ms-accent) 13%,transparent);color:var(--ms-accent)}\n.ms-state.succeeded{background:color-mix(in srgb,var(--ms-ok) 13%,transparent);color:var(--ms-ok)}\n.ms-state.failed{background:color-mix(in srgb,var(--ms-danger) 12%,transparent);color:var(--ms-danger)}\n.ms-shots{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}\n.ms-shots li{display:flex;align-items:center;gap:8px;font-size:.78em;color:var(--ms-muted);padding:4px 7px;border-radius:7px;background:color-mix(in srgb,var(--ms-bg) 55%,transparent)}\n.ms-shot-index{width:18px;height:18px;border-radius:5px;background:var(--ms-sunken);display:grid;place-items:center;font-size:.9em}\n.ms-shot-prompt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-shot-state{font-size:.92em}\n.ms-shots li.succeeded .ms-shot-state{color:var(--ms-ok)}\n.ms-shots li.failed .ms-shot-state{color:var(--ms-danger)}\n.ms-shots li.running .ms-shot-state{color:var(--ms-accent)}\n\n/* \u2500\u2500 modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-modal-mask{position:fixed;inset:0;z-index:50;background:#0c0c122e;backdrop-filter:blur(2px);display:grid;place-items:center;padding:24px}\n.ms-modal{width:min(520px,92vw);max-height:86vh;display:flex;flex-direction:column;background:var(--ms-bg);border:1px solid var(--ms-line);border-radius:16px;box-shadow:0 24px 70px -30px #00000066;overflow:hidden}\n.ms-modal.wide{width:min(860px,94vw)}\n.ms-modal-head{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--ms-line);font-size:.9em;font-weight:600}\n.ms-modal-body{padding:14px;overflow:auto;display:flex;flex-direction:column;gap:12px}\n.ms-pick-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:9px}\n.ms-pick{appearance:none;border:1px solid var(--ms-line);background:var(--ms-surface);border-radius:10px;padding:5px;cursor:pointer;display:flex;flex-direction:column;gap:4px;font-size:.74em;color:var(--ms-muted);overflow:hidden}\n.ms-pick:hover{border-color:var(--ms-accent)}\n.ms-pick span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ms-detail{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(240px,.85fr);gap:16px;min-height:0}\n.ms-detail-media{background:var(--ms-sunken);border-radius:12px;overflow:hidden;display:grid;place-items:center;min-height:240px}\n.ms-detail-media img,.ms-detail-media video{width:100%;max-height:62vh;object-fit:contain;display:block}\n.ms-detail-side{display:flex;flex-direction:column;gap:10px;min-width:0}\n.ms-detail-tags{display:flex;flex-wrap:wrap;gap:5px}\n.ms-detail-prompt{font-size:.86em;line-height:1.6;margin:0;word-break:break-word;max-height:120px;overflow:auto}\n.ms-kv{display:grid;grid-template-columns:58px 1fr;gap:5px 9px;margin:0;font-size:.78em}\n.ms-kv dt{color:var(--ms-muted)}\n.ms-kv dd{margin:0;color:var(--ms-text);word-break:break-all}\n.ms-detail-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:8px}\n.ms-import-form{display:flex;flex-direction:column;gap:10px}\n\n/* \u2500\u2500 channels \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.ms-channels{overflow:auto;padding:16px 20px 28px;display:flex;flex-direction:column;gap:18px}\n.ms-channels-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap}\n.ms-channels-head h3{margin:0 0 2px;font-size:.95em}\n.ms-channels-head p{margin:0}\n.ms-channel-list{display:flex;flex-direction:column;gap:8px}\n.ms-channel{border:1px solid var(--ms-line);border-radius:12px;background:var(--ms-surface);overflow:hidden}\n.ms-channel.open{border-color:var(--ms-line-strong)}\n.ms-channel-head{appearance:none;width:100%;border:0;background:transparent;display:flex;align-items:center;gap:9px;padding:10px 13px;cursor:pointer;text-align:left;font-size:.86em;color:var(--ms-text);flex-wrap:wrap}\n.ms-channel-head:hover{background:color-mix(in srgb,var(--ms-bg) 55%,transparent)}\n.ms-channel-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-channel-kind{font-size:.82em;color:var(--ms-muted);background:var(--ms-bg);padding:2px 6px;border-radius:5px;border:1px solid var(--ms-line)}\n.ms-channel-key{font-size:.78em;color:var(--ms-muted);margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}\n.ms-channel-head svg{transition:transform .14s ease;color:var(--ms-muted);flex-shrink:0}\n.ms-channel-head svg.rot90{transform:rotate(90deg)}\n.ms-channel-body{padding:4px 13px 13px;display:flex;flex-direction:column;gap:11px;border-top:1px solid var(--ms-line);background:var(--ms-bg)}\n.ms-channel-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.ms-test{display:flex;align-items:center;gap:6px;font-size:.8em;border-radius:8px;padding:7px 9px}\n.ms-test.ok{color:var(--ms-ok);background:color-mix(in srgb,var(--ms-ok) 8%,transparent)}\n.ms-test.bad{color:var(--ms-danger);background:color-mix(in srgb,var(--ms-danger) 8%,transparent)}\n.ms-defaults,.ms-comfy-admin{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--ms-line);padding-top:16px}\n.ms-defaults h3,.ms-comfy-admin h3{margin:0;font-size:.95em}\n.ms-flow-list{display:flex;flex-direction:column;gap:6px}\n.ms-flow{display:flex;align-items:center;gap:10px;border:1px solid var(--ms-line);border-radius:9px;padding:7px 10px;font-size:.82em;background:var(--ms-surface);flex-wrap:wrap}\n.ms-flow-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-flow-slots{color:var(--ms-muted);font-size:.92em;flex:1;min-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.ms-add-form,.ms-advanced{display:flex;flex-direction:column;gap:12px}\n\n/* \u2500\u2500 responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n@container (max-width: 720px){\n  .ms-create{grid-template-columns:1fr;overflow:auto}\n  .ms-compose{border-right:0;border-bottom:1px solid var(--ms-line)}\n  .ms-result{overflow:visible}\n  .ms-detail{grid-template-columns:1fr}\n  .ms-grid-2,.ms-grid-3{grid-template-columns:1fr}\n  .ms-header{padding:10px 14px 8px}\n  .ms-tabs{padding:0 10px;overflow-x:auto}\n  .ms-toolbar{padding:10px 14px}\n  .ms-channels,.ms-grid,.ms-job-list{padding-left:14px;padding-right:14px}\n  .ms-recent{grid-template-columns:repeat(3,1fr)}\n}\n";

// src/client/Studio.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var TABS = [
  { id: "create", label: "\u521B\u4F5C", icon: "sparkles" },
  { id: "jobs", label: "\u4EFB\u52A1", icon: "clock" },
  { id: "library", label: "\u7D20\u6750\u5E93", icon: "grid" },
  { id: "channels", label: "\u901A\u9053", icon: "plug" }
];
function Studio({ visible }) {
  const [tab, setTab] = (0, import_react7.useState)("create");
  const [config, setConfig] = (0, import_react7.useState)(null);
  const [jobs, setJobs] = (0, import_react7.useState)([]);
  const [stats, setStats] = (0, import_react7.useState)(null);
  const [loading, setLoading] = (0, import_react7.useState)(true);
  const [error, setError] = (0, import_react7.useState)(null);
  const [toast, setToast] = (0, import_react7.useState)(null);
  const [useRefAsset, setUseRefAsset] = (0, import_react7.useState)(null);
  const [focusAsset, setFocusAsset] = (0, import_react7.useState)(null);
  const [libraryVersion, setLibraryVersion] = (0, import_react7.useState)(0);
  const toastTimer = (0, import_react7.useRef)(void 0);
  const active = jobs.filter((job) => job.state === "running" || job.state === "queued").length;
  const notify = (0, import_react7.useCallback)((text, tone = "info") => {
    setToast({ id: Date.now(), text, tone });
    if (toastTimer.current !== void 0) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === "error" ? 6e3 : 3200);
  }, []);
  const refreshConfig = (0, import_react7.useCallback)(async () => {
    try {
      const result = await api.config();
      setConfig(result.config);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  const refreshJobs = (0, import_react7.useCallback)(async () => {
    try {
      const result = await api.jobs("?limit=40");
      setJobs(result.jobs);
    } catch {
    }
  }, []);
  const refreshStats = (0, import_react7.useCallback)(async () => {
    try {
      setStats(await api.stats());
    } catch {
    }
  }, []);
  (0, import_react7.useEffect)(() => {
    void refreshConfig();
    void refreshJobs();
    void refreshStats();
  }, [refreshConfig, refreshJobs, refreshStats]);
  (0, import_react7.useEffect)(() => {
    if (!visible) return void 0;
    const timer = window.setInterval(() => {
      void refreshJobs();
      void refreshStats();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [visible, refreshJobs, refreshStats]);
  const openAsset = (asset) => {
    setFocusAsset(asset.id);
    setLibraryVersion((value) => value + 1);
    setTab("library");
  };
  const useAsReference = (asset) => {
    setUseRefAsset({ asset, nonce: Date.now() });
    setTab("create");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("style", { children: styles_default }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("header", { className: "ms-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-brand", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "ms-brand-mark", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "layers", size: 17 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-brand-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("strong", { children: "\u5A92\u4F53\u5DE5\u4F5C\u53F0" }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: config === null ? "\u6B63\u5728\u8FDE\u63A5\u5BBF\u4E3B\u2026" : `${config.channels.filter((channel) => channel.ready).length} \u4E2A\u901A\u9053\u5C31\u7EEA \xB7 ${bytes(stats?.bytes ?? 0)} \u7D20\u6750` })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-header-meta", children: [
        active > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { className: "ms-live", children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Spinner, { size: 11 }),
          active,
          " \u4E2A\u4EFB\u52A1\u8FDB\u884C\u4E2D"
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { type: "button", className: "ms-icon-btn", title: "\u5237\u65B0", onClick: () => {
          void refreshConfig();
          void refreshJobs();
          void refreshStats();
        }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "refresh", size: 16 }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("nav", { className: "ms-tabs", role: "tablist", "aria-label": "\u5DE5\u4F5C\u53F0\u9875\u7B7E", children: TABS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": tab === item.id,
        className: `ms-tab${tab === item.id ? " on" : ""}`,
        onClick: () => setTab(item.id),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: item.icon, size: 15 }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: item.label }),
          item.id === "jobs" && active > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("em", { children: active }) : null
        ]
      },
      item.id
    )) }),
    loading ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-loading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Spinner, { size: 18 }),
      " \u6B63\u5728\u8F7D\u5165\u914D\u7F6E\u2026"
    ] }) : error !== null ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-error", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: "alert", size: 18 }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("strong", { children: "\u5BBF\u4E3B\u63A5\u53E3\u6CA1\u54CD\u5E94" }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { children: error }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("p", { className: "ms-hint", children: "\u786E\u8BA4\u63D2\u4EF6\u5DF2\u542F\u7528\uFF1B\u9762\u677F\u5730\u5740\u662F /media-studio/api\u3002" })
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "ms-body", children: [
      tab === "create" && config !== null ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        CreateTab,
        {
          channels: config.channels,
          config,
          useRefAsset,
          onConsumeRef: () => setUseRefAsset(null),
          notify,
          onProduced: () => {
            void refreshJobs();
            void refreshStats();
            setLibraryVersion((value) => value + 1);
          },
          onOpenJobs: () => setTab("jobs")
        }
      ) : null,
      tab === "jobs" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(JobsTab, { jobs, onRefresh: () => {
        void refreshJobs();
        void refreshStats();
      }, onOpenAsset: openAsset, notify }) : null,
      tab === "library" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        LibraryTab,
        {
          focusAssetId: focusAsset,
          version: libraryVersion,
          onUseAsReference: useAsReference,
          notify,
          onChanged: () => {
            void refreshStats();
            setLibraryVersion((value) => value + 1);
          },
          onOpenJobs: () => setTab("jobs")
        }
      ) : null,
      tab === "channels" && config !== null ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ChannelsTab, { config, onSaved: () => {
        void refreshConfig();
      }, notify }) : null
    ] }),
    toast === null ? null : /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: `ms-toast ${toast.tone}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(Icon, { name: toast.tone === "error" ? "alert" : toast.tone === "ok" ? "check" : "sparkles", size: 14 }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { children: toast.text })
    ] }, toast.id)
  ] });
}

// src/client/index.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var name = "dsh-media-studio";
var inject = ["slots"];
var PANEL_ID = "media-studio";
var TAB_ID = "media-studio:studio";
function PanelIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { style: { display: "grid", placeItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Icon, { name: "layers", size: size ?? 18 }) });
}
function apply(ctx) {
  ctx.inject(["betterSidebar"], (scope) => {
    scope.effect(() => {
      const service = scope.betterSidebar;
      const dispose = service.registerTab({
        id: TAB_ID,
        title: () => "\u5A92\u4F53\u5DE5\u4F5C\u53F0",
        description: () => "\u56FE\u50CF\u3001\u89C6\u9891\u4E0E ComfyUI \u4EFB\u52A1",
        icon: (size) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Icon, { name: "layers", size: size ?? 16 }),
        order: 41,
        single: true,
        component: (props) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Studio, { visible: props?.visible !== false })
      });
      return () => {
        dispose();
      };
    }, "media-studio: better-sidebar tab");
  });
  const slots = ctx.get("slots");
  if (slots === void 0) {
    console.warn("[media-studio] \u62FF\u4E0D\u5230 slots \u670D\u52A1\uFF0C\u9762\u677F\u672A\u6CE8\u518C\u3002");
    return;
  }
  slots.inject("sidebar.panellist", () => slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 41,
    label: () => "\u5A92\u4F53\u5DE5\u4F5C\u53F0"
  }, (props) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PanelIcon, { size: props?.size })));
  slots.inject("main", () => slots.register({
    name: "main",
    key: PANEL_ID
  }, () => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Studio, { visible: true })));
  console.info("[media-studio] \u5DF2\u6CE8\u518C\u4FA7\u680F\u5165\u53E3\u4E0E\u4E3B\u9762\u677F");
}
var __test = { Studio, PanelIcon };
return module.exports; } });
