# 催收语音 Agent — 技术设计文档(MVP v1)

> 配套 `PRD.zh.md`,范围 = P0(MVP)。
> 硬性约束:**LiveKit**(实时音频)+ **Fish Audio**(TTS)+ Web 前端。

---

## 0. 目标与约束
- **目标:** 以最短时间交付一个可运行、可演示的催收语音 Demo。
- **硬性约束:** LiveKit + Fish Audio + Web。
- **交互模型:** 实时轮次切换(MVP 阶段不做全双工抢话)。
- **优先级排序:** 简单 > 可演示 > 可扩展。
- **云上优先:** P0 第一天就部署到云。不设"仅本地"的中间里程碑。

---

## 1. 设计原则(通用)

### 1.1 前端托管与公网访问
**Vercel Hobby** 默认公网可达,完美适配 Next.js 页面 + token API。

### 1.2 各部署平台的角色
| 平台 | 角色 |
|---|---|
| Vercel | 前端 + Serverless token API |
| LiveKit Cloud | SFU + 托管 Python Agent worker(同一平台搞定两件事) |

### 1.3 上下文与记忆策略(MVP)
- **不做**跨会话记忆,**不做**数据库持久化。
- 只保留会话内:
  - 最近 4–6 轮对话。
  - Slot 字段:`committed_amount`(承诺金额)、`committed_date`(承诺日期)。
  - 流程状态:`opening → negotiation → confirmation → closing`(开场 → 协商 → 确认 → 收尾)。

### 1.4 成本心态(不单列预算章节)
只要时刻记住下面三条,成本就可忽略:
- 单次通话 ≤ 5 分钟。
- Agent 单次回复 ≤ 2 句(prompt 约束 + 后处理截断)。
- 5 轮用户发言仍未达成承诺 → 自动收尾。

---

## 2. 技术栈(MVP)

| 层 | 选择 | 备注 |
|---|---|---|
| 前端框架 | Next.js 14(App Router)+ TypeScript | SSR、Vercel 原生、有 LiveKit 官方示例 |
| 样式 | Tailwind CSS | 在 JSX 里直接写 utility class,免写独立 CSS 文件 |
| UI 组件 | shadcn/ui | 一组复制粘贴式的 React 组件(按钮、卡片、对话框…),默认配合 Tailwind |
| 实时媒体 | LiveKit Cloud(Build 免费档) | 托管 SFU,无需自建 |
| Agent 编排 | LiveKit Agents(Python) | 内置 VAD + STT/LLM/TTS 流水线 |
| STT | Deepgram Streaming(通过 LiveKit Inference) | LiveKit Inference 免费额度,无需自备 API key |
| LLM | **GPT-5.2**(通过 LiveKit Inference) | LiveKit Inference 托管,无需自备 API key |
| TTS | Fish Audio(`livekit-plugins-fishaudio` 或自定义封装) | 硬性约束要求 |
| 前端部署 | Vercel Hobby | 免费,自带公网 URL |
| Agent 部署 | LiveKit Cloud (Agents) | 同一个项目,一条 `lk agent deploy` 搞定 |

---

## 3. 端到端架构

```
┌───────────────────────────────────────────────────────────┐
│  Browser(Next.js,部署在 Vercel)                        │
│  ┌──────────────┐    ┌─────────────────────────────────┐ │
│  │ 通话 UI      │───▶│ LiveKit Web SDK(WebRTC)        │ │
│  │ 案件卡片     │    │ - 麦克风采集                     │ │
│  │ 转录         │◀───│ - 订阅 Agent 音频轨               │ │
│  │ 总结卡片     │    │                                 │ │
│  └──────────────┘    └────────────────┬────────────────┘ │
└──────────────┬─────────────────────────┼─────────────────┘
               │ /api/token              │ WebRTC
               ▼                         ▼
     ┌───────────────────┐    ┌─────────────────────────┐
     │ Vercel Route      │    │  LiveKit Cloud(SFU)    │
     │ - 签发 JWT        │    │  Room: "demo-<uuid>"    │
     └───────────────────┘    └────────────┬────────────┘
                                           │ WebRTC
                                           ▼
     ┌────────────────────────────────────────────────────┐
     │  LiveKit Agent (Python, deployed on LiveKit Cloud)     │
     │                                                    │
     │   VAD ──▶ Deepgram STT ──▶ GPT-5.2(LLM) ──▶ Fish ──┐
     │                                                    │
     │                  ◀──────── PCM ────────────────────┘
     └────────────────────────────────────────────────────┘
                       │ WebSocket
                       ▼
              ┌──────────────────┐
              │ Fish Audio API   │
              └──────────────────┘
```

---

## 4. 组件设计

### 4.1 前端
- 单页(`/`),状态机由 React reducer 驱动。
- 关键组件:`CaseCard`(案件卡片)、`Transcript`(转录)、`CallControls`(操作按钮)、`SummaryCard`(总结卡片)。
- LiveKit hooks:`useConnectionState`、`useTracks`、`useVoiceAssistant`。
- 字幕:订阅 Agent 端发布的 `transcription` 数据通道。
- 状态与 PRD §12 一致(`IDLE / CONNECTING / IN_CALL_AGENT_TURN / IN_CALL_USER_TURN / ENDING / ENDED / ERROR`)。

### 4.2 Token API(Next.js Route)
- POST `/api/token` → `{ url, token }`。
- 服务端持有 `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`(只放环境变量)。
- 每次通话用新房间 `demo-<short-uuid>`,显式 dispatch Agent 到该房间。

### 4.3 Agent Worker(Python)
- 入口:`agent.py`。
- Pipeline:`livekit-agents` 提供的 `VoicePipelineAgent(vad, stt, llm, tts)`。
- Slot 抽取:在 LLM 之后挂一个小钩子,从对话里解析 `{金额, 日期}`;两个都填了就由
  Agent 复述确认并触发 `ENDING` 事件。
- 硬性上限:5 轮用户发言或 5 分钟通话时长 → 优雅收尾。

### 4.4 Fish Audio TTS
- 优先用 `livekit-plugins-fishaudio`(若 API 兼容);否则把 Fish 的 WebSocket 流式
  接口包成自定义 `TTS` 子类。
- 必填字段:`api_key`、`voice_id`(预先在 Fish 平台选好)、`format=pcm`。
- 边收 PCM 边推流到 LiveKit 音频轨。

### 4.5 System Prompt(MVP,中文示例)
```
你是 Acme Finance 的持证催收专员"小李"(工号 8829),正在与债务人通电话。

【案件信息】
姓名:{name} | 欠款总额:{amount} | 逾期天数:{days}
合同号:{contract_id} | 卡尾号:{card_tail} | 最低还款:{min_payment}

【目标】收集明确的还款承诺 = (金额 + 日期),复述确认后收尾。

【规则】
1. 每次回复 ≤ 2 句、单句 ≤ 25 字,口语化。
2. 一轮一个问题。
3. 用户否认债务:引用合同号 + 卡尾号,不与对方争辩。
4. 用户情绪激动:先共情一次,再回到目标。
5. 用户给出承诺:在收尾前一字不差地复述金额和日期。
6. 不威胁、不向非本人透露债务详情。
7. 被问"你是 AI 吗"如实承认是智能助理。
8. 达成目标 或 通话超过 5 分钟 → 礼貌结束。

只输出口语化文本,不要 markdown,不要括号注释。
```

---

## 5. 构建顺序

云上优先:每个阶段都产出一个已部署、公网可达的成品。
每个阶段是上一阶段的严格超集——绝不跳步。

| 阶段 | 目标 | 关键验收 |
|---|---|---|
| **P0 — Web Hello World** | 把一个静态 Next.js 页面部署到 Vercel。不接 LiveKit、不写 token API、不要 Agent。 | 公网 URL 能打开页面;lighthouse 通过;可分享链接。 |
| **P1 — Token API** | 在 Vercel 上加 `/api/token` 路由,签发 LiveKit JWT。前端能调用并展示拿到的 token。 | `curl <url>/api/token` 返回合法 JSON;密钥只放在 Vercel 环境变量。 |
| **P2 — 浏览器加入 LiveKit 房间** | 前端用 token 加入 LiveKit 房间,麦克风采集能用。仍然没有 Agent。 | 浏览器显示"已连接";LiveKit 控制台能看到该 participant。 |
| **P3 — Agent worker 上云** | 部署一个"hello"级别的 Python Agent worker 到 LiveKit Cloud (`lk agent deploy`),被 dispatch 时能加入房间。还没有 STT/LLM/TTS。 | 房间里能看到两个 participant(浏览器 + Agent);Agent 进程 healthy。 |
| **P4 — Fish Audio TTS** | Agent 向房间播放一段固定的 Fish 生成的开场白。 | 浏览器能听到 Fish 的声音。 |
| **P5 — 业务状态机** | 催收员 prompt + function_tool 承诺识别 + data channel 事件 + 前端承诺卡片。 | 对话中承诺付款后,前端显示绿色承诺卡片。 |
| **P6 — 稳定性打磨** | 错误态、超时、转录自动滚动、案件卡片 UI。 | 一通完整 Demo 能稳定跑完。 |

**为什么把 P0 拆成"纯静态部署":** 最早要验证的是部署管线本身能不能跑通(账号、项目关联、
构建、域名、环境变量)。在这一步失败,代价是几分钟;若拖到后面和 LiveKit 问题混在一起出错,
代价就是几小时。

**关键纪律:** P4 已经在公网上验证过 Fish Audio,后续若 TTS 再坏只可能是回归,而不是环境问题。

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Fish 流式延迟过高(首字 > 1.5s) | 中 | 高 | 按句流式;预生成开场白;复用短问候语 |
| LLM 不遵守"≤ 2 句"约束 | 中 | 中 | prompt 强约束 + 后处理截断;TTS 前按句切分 |
| ASR 听错金额/日期 | 中 | 中 | Agent 收尾前主动复述确认 |
| Agent worker 通话中崩溃 | 低 | 高 | 云平台健康检查 + 自动重启 |
| 云端部署配置错误(env、端口) | 中 | 高 | P0 先用一个"hello"级别的部署跑通,再加业务逻辑 |
| 合规越界(出现威胁性表述) | 低 | 中 | prompt 硬规则 + 输出关键词过滤 |

---

## 7. MVP 不做(技术栈层面)
- 不做数据库、不做 Redis、不做消息队列。
- 不做 SIP / PSTN 电话桥接。
- 不做全双工抢话(留到 PRD 的 P1 阶段)。
- 不做多租户 Agent 调度——一通话一房间,临时性。
- 除 `console.log` 外不做任何埋点 pipeline。

---

*下一步:P0 — `pnpm create next-app`,把一个静态页面部署到 Vercel。不做别的。*