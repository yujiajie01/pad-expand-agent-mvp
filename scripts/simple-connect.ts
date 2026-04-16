/**
 * 简单联通：本机 agent 健康检查 + 带密钥的 /chat/start。
 * 运行：bun scripts/simple-connect.ts
 * 默认连 http://127.0.0.1:8787，可用环境变量 AGENT_BASE 覆盖。
 */
const base = (process.env.AGENT_BASE ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const key = process.env.WS_KEY ?? "nikoyu";

async function main(): Promise<void> {
	const health = await fetch(`${base}/`);
	if (!health.ok) {
		throw new Error(`GET / 失败: ${health.status}`);
	}
	const hj = (await health.json()) as { status?: string };
	if (hj.status !== "ok") {
		throw new Error("GET / 非健康状态");
	}
	console.log("GET /:", hj);

	const chat = await fetch(`${base}/chat/start`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			"X-Agent-Key": key,
			"ngrok-skip-browser-warning": "true",
		},
		body: "{}",
	});
	const text = await chat.text();
	if (!chat.ok) {
		throw new Error(`POST /chat/start ${chat.status}: ${text.slice(0, 500)}`);
	}
	const data = JSON.parse(text) as { sessionId?: string; reply?: string };
	if (!data.sessionId || !data.reply) {
		throw new Error("响应缺少 sessionId/reply");
	}
	console.log("POST /chat/start: sessionId=", data.sessionId, "replyLen=", data.reply.length);
	console.log("simple-connect: OK");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
