# pad-expand-agent-mvp

基于 TypeScript + LangGraph.js 的焊盘外扩对话智能体 MVP。  
目标：把自然语言需求归一化为结构化参数：

```json
{
  "outputKind": "forbidden_pour | forbidden_fill | solder_mask",
  "expMil": 10,
  "continuous": true
}
```

## 1. 本地启动

```bash
bun install
cp .env.example .env
bun run dev
```

服务默认地址：`http://127.0.0.1:8787`

## 2. API

- `POST /chat/start`：创建会话，返回首条引导语。
- `POST /chat/turn`：推进一轮对话。
- `GET /chat/:sessionId/state`：查看会话状态（调试）。
- `POST /chat/:sessionId/confirm`：快捷确认（等价发送“确认”）。

### 示例：创建会话

```bash
curl -X POST http://127.0.0.1:8787/chat/start
```

### 示例：对话推进

```bash
curl -X POST http://127.0.0.1:8787/chat/turn \
  -H "content-type: application/json" \
  -d "{\"sessionId\":\"<sessionId>\",\"input\":\"阻焊区域，外扩0.12mm，连续生成\"}"
```

```bash
curl -X POST http://127.0.0.1:8787/chat/turn \
  -H "content-type: application/json" \
  -d "{\"sessionId\":\"<sessionId>\",\"input\":\"确认\"}"
```

## 3. 评测与检查

```bash
bun run typecheck
bun run eval
```

`scripts/eval.ts` 内置 3 组中文样例，覆盖：
- 一句话完整输入；
- mil 单位输入；
- 多轮补全 + 确认。

## 4. LangSmith 追踪

默认关闭。需要时在 `.env` 开启：

```env
LANGSMITH_API_KEY=...
LANGSMITH_TRACING=true
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=pad-expand-agent-mvp
```

说明：
- 若未配置 `OPENAI_API_KEY`，系统会回退到规则解析，不影响 MVP 跑通。
- 若配置了 `OPENAI_API_KEY`，会优先使用结构化提取，提高口语鲁棒性。
