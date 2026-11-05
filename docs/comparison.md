# 三家插件逐项分析

对照版本（均为 2026-11 的 HEAD）：

| 仓库 | 版本 | 许可 | 源码规模 |
|---|---|---|---|
| `YuChenLiao/dsh-comfyui-workbench` | 0.6.0 | MIT | 151 文件 / 约 20,110 行 |
| `shanliuling/dsh-image-gen` | 0.10.2 | Apache-2.0 | 100 文件 / 约 23,689 行 |
| `q253595422/dsh-imagegen-video` | 1.22.2 | Apache-2.0 | 152 文件 / 约 72,256 行 |

---

## 1. dsh-comfyui-workbench

**定位**：只做 ComfyUI。把本机工作流交给模型调用，并管理「哪些工作流对模型可用」。明确**不内置生图前端**——想手工出图直接开 ComfyUI。

**架构**

- 10 条 loader entry：包根 core + 9 个组件（gallery / workflow / tags / poses / costumes / generate / edit / danbooru / terminal），可在宿主设置里单独开关。
- 组件之间靠 `ctx.root` 上的共享槽传运行时；HTTP 前缀只注册一次，路由表按组件动态挂载（关组件 = 路由 404）。
- 工具用 `ctx.get('tools').register(spec)` 注册，刻意不 import `@deepseek-ai/*`，`link:` 安装也不会解析失败。
- 产物目录探测：环境变量 → `workingDirectory.defaultDirectory` → `workspaceRegistry` → cwd，每级保留来源标记。

**强项**

1. **工作流 IO 面推断**（`shared/workflow/infer.ts`）：从采样器反向追踪 CLIPTextEncode，把 `text` 命名成语义化的 `prompt` / `negative_prompt`；识别 width/height/seed/steps/cfg、图片槽位、末端输出；内部参数（model/vae/lora/batch）不进 IO 面。这是三家里唯一把「图」翻译成「参数表」的实现。
2. **变量绑定 + 节点级 overrides + 模板哈希**：`{{var}}` 占位符、未绑定变量报错、`persist` 需 `expectHash`，防止把模板改坏。
3. **资产库**：JSONL 索引 + 扫描 + 去重 + NSFW 过滤 + 批量导出；sidecar 与文件同目录。
4. **运行治理**：提交后异步盯守、瞬时失败策略、批量任务一条失败不影响其它、失败分类与建议、重启后状态收敛。
5. **本地服务托管**：探测安装、按需拉起、排队等待就绪；默认不自动回收（拉模型时被杀是事故）。

**弱项**

1. **没有云端通道**：只有 ComfyUI，用户没有本机 GPU 就没有生产力。
2. **没有视频生成前端**：只能靠工作流里的视频节点，模型侧也只能 `comfyui_run`。
3. **本地数据重**：Danbooru 四类 99,372 条、常驻约 172 MB；姿势/衣装库还要经服务端图床代理。
4. **界面是管理型**：六个页签都是「列表/开关/终端」，不做参数化生成；想调 prompt 要去 ComfyUI。
5. **中文优先**：i18n 有中英两份，但文案与注释以中文为主，社区复用成本高。

**可被吸收的点**：IO 面推断、变量应用、工作流存储与启停、资产索引/sidecar、`ctx.get` 无依赖接入、服务离线时不假装排队。

---

## 2. dsh-image-gen

**定位**：DSH 原生图像创作插件，让 Agent 会画图：批量、画布草图、灵感库、Studio、多模型对比。

**架构**

- 单一宿主入口（837 行的 `index.ts`）+ 每个 provider 一个适配器文件；配置用 schemastery `Config`，密钥走 `ctx.credentials`，设置表单走 `dsh-settings` 的 `SettingsForms`。
- 客户端一个约 109KB 的 `studio-view.tsx` 与约 100KB 的 `index.tsx`，注册设置页、右栏、会话内图片节点、画廊、画布（tldraw）。
- 工具面：`generate_image` / `generate_images` / 画布工具 / 灵感检索；结果以 attachment 形式内联。

**强项**

1. **通道覆盖最广**：Gemini、OpenAI、OpenAI-Compatible、Seedream、DashScope、xAI、GLM、ComfyUI，另有 ChatGPT/Grok/Google 订阅免 Key。
2. **每一项能力都打通了 UI**：Studio 参数、多模型对比、画廊、收藏、批量保存、工作区落盘、缩略图/预览/压缩包导出。
3. **工程细节扎实**：`response_format` 被中转站拒绝时自动重试、b64 与 URL 双解析、magic bytes 嗅探真实 mime、超时/取消、请求图片缓存清理。
4. **灵感库**：500+ 内置 prompt，Agent 可检索后套模板。
5. **画布语义**：选区截图 + 全分辨率原图一起交给模型，支持「圈哪改哪」。

**弱项**

1. **完全没有视频**。
2. **ComfyUI 是二等公民**：多工作流只能对话调用，README 明说「暂未接入 Studio 和多模型对比」。
3. **画布是 tldraw 的独立镜像**：`canvas-state` / tldraw 资产单独维护，与画廊/Studio 的状态同步是额外一层。
4. **配置模型偏重**：schemastery + credentials + settings 表单三件套，换一个宿主版本就要跟着适配。
5. **入口文件过大**：宿主 `index.ts` 59KB、客户端 `studio-view.tsx` 109KB，改动面集中、回归成本高。

**可被吸收的点**：provider 抽象与请求整形、通道就绪/密钥解析、Studio 的参数组织、结果候选与「继续编辑」路径。

---

## 3. dsh-imagegen-video

**定位**：图像 + 视频一体化，带完整视频链路：异步任务、分镜、时间线、拼接、画布节点、导演步、电商套图、代码渲染。

**架构**

- 宿主侧 57 个模块：`engine.ts` / `video-engine.ts` / `protocol.ts` / `routes.ts` / `canvas-store.ts` 等，把「提交—轮询—下载—落盘—历史」拆成多层。
- 协议族显式建模：`agnes` / `comemoe` / `seedance` / `xai` / `openai-video` / `snapgen`，每族有自己的 submit path、状态词汇、轮询预算与取消能力表。
- 客户端 87 个文件；三栏工作室、无限画布、时间线、技能系统、模板库。
- 大量 smoke/verify 脚本（30+），按缺陷编号保留回归。

**强项**

1. **视频协议覆盖与容错最完整**：状态词汇并集（queued/running/processing/completed/failed/expired）、`done` 但无 URL 时改走 `/content`、瞬时失败重试、轮询预算按族调、任务 id 多种响应形状。
2. **分镜**：一节点 = 一列镜头，每镜提示词/时长；可「每镜独立」或「接上一镜尾帧」；成品回到普通视频节点。
3. **时间线与拼接**：排序、裁剪、转场、声音开关，统一交给本机 ffmpeg；输出规格固定、失败指出第几段。
4. **画布节点图**：文本/图片/视频/配置/文件/分镜节点，连线即依赖，支持整图 workflow runner。
5. **导演步**：一次请求先拆镜头、运镜、时长、风格，再把计划发给模型。

**弱项**

1. **体量最大、耦合最深**：7.2 万行，路由、协议、画布、技能、模板互相引用；二次开发门槛高。
2. **与同类插件冲突**：README 明确不能与 `@dickpy/dsh-imagegen` 同装——相同 `/api/dsh-imagegen/*` 路由与数据目录。
3. **没有 ComfyUI**：本地算力只能靠「代码生成 + 本机渲染」，不是工作流执行。
4. **UI 重、约定多**：三栏工作室、画布快捷键、技能权限模型，对只想「说一句出一段视频」的用户过重。
5. **依赖多**：lightningcss、shiki、katex、jsdom、simple-icons……安装体积与构建时间都高。

**可被吸收的点**：异步视频状态机、协议族表、分镜/尾帧/拼接的产品逻辑、失败信息的具体性。

---

## 4. 能力矩阵

| 能力 | comfyui-workbench | image-gen | imagegen-video | media-studio |
|---|:--:|:--:|:--:|:--:|
| 云端文生图 | — | ✅ | ✅ | ✅ |
| 云端图生图（多参考） | — | ✅ 5 张 | ✅ 5 张 | ✅ 5 张 |
| 订阅免 Key | — | ✅ 3 家 | — | 路线图 |
| 云端视频（t2v/i2v/首尾帧） | — | — | ✅ | ✅ |
| ComfyUI 工作流 | ✅ | 仅对话 | — | ✅ |
| 工作流变量/IO 面 | ✅ | — | — | ✅（简化版） |
| 异步任务 + 取消 | ✅ | 部分 | ✅ | ✅ 统一 |
| 分镜 | — | — | ✅ 画布 | ✅ 工具 + 列表 |
| 尾帧续拍 | — | — | ✅ | ✅（需 ffmpeg） |
| 片段拼接 | — | — | ✅ | ✅（需 ffmpeg） |
| 资产库/搜索/收藏 | ✅ 文件系统 | ✅ 浏览器 | ✅ 宿主 | ✅ sidecar + 索引 |
| 无限画布 | — | ✅ tldraw | ✅ 节点图 | —（刻意） |
| 灵感/模板 | — | ✅ 500+ | ✅ 模板库 | —（路线图） |
| 标签/姿势/衣装库 | ✅ | — | — | —（路线图） |
| 面板内配置 | 部分 | ✅ 表单 | ✅ 渠道 | ✅ 通道页 |

## 5. 为什么这样合

1. **通道必须统一**：三家各自定义了「provider / channel / workflow」，导致同一台机器上要配三遍 Key 与地址。合并后的第一层就是 `ChannelConfig`，ComfyUI 与云端同表。
2. **任务必须统一**：图像是秒级、视频是分钟级、工作流是分钟级且可能排队。`imagegen-video` 的异步状态机证明「立即返回 id」是对的产品形态；它应该覆盖图像与工作流，而不是只覆盖视频。
3. **资产必须统一**：`image-gen` 把图库放浏览器、`comfyui-workbench` 放文件系统、`imagegen-video` 放宿主。跨插件找图是真实痛点。sidecar + 中央索引 + Range 服务是成本最低的收敛点。
4. **画布先不做**：分镜 + 拼接已经覆盖「多镜生成、接尾帧、出成片」的主路径；节点图需要的编辑器工作量是另一个数量级，而它带来的增量主要是「分支/复用」。v0.1 用 `job.shots` 保留数据结构，后续可挂画布。
5. **不做订阅登录与本地大库**：这两块都要各自的凭证/数据/合规体系，塞进第一版会让「装完就能用」变成「装完先配置半小时」。

## 6. 已知取舍

| 取舍 | 原因 | 代价 |
|---|---|---|
| 不用 tldraw / 节点图 | 体积与复杂度 | 没有分支画布，只有线性分镜 |
| 不支持订阅登录 | OAuth + 凭证服务 | 必须有 API Key 或兼容网关 |
| 不打包 Danbooru/姿势/衣装 | 172MB + 图床代理 + 数据时效 | 提示词对齐靠模型自己 |
| 只取消本机轮询 | 上游没有稳定取消接口 | 云端可能继续计费 |
| ComfyUI 不自动拉起 | 避免杀到模型下载 | 用户需先启动服务 |
| 单文件 host bundle | 与宿主 loader 对齐 | 冷启动多解析约 160KB |
