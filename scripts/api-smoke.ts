/**
 * 冒烟：GET / 健康检查；HTTP 聊天路由已移除故应 404。
 * WebSocket 请在浏览器或扩展里连 `ws(s)://…/ws`（本脚本不测同进程 WS，避免 Bun 限制）。
 * 运行：bun scripts/api-smoke.ts
 */
async function main(): Promise<void> {
	process.env.PORT = "18493";
	const { default: server } = await import("../src/server");

	const { port: serverPort } = server;
	const fetchTest = server.fetch as (req: Request) => Promise<Response>;

	function must(cond: boolean, msg: string): void {
		if (!cond) {
			throw new Error(msg);
		}
	}

	const base = `http://127.0.0.1:${serverPort}`;

	const health = await fetchTest(new Request(`${base}/`));
	if (!health) {
		throw new Error("GET / 无响应");
	}
	must(health.ok, "GET / ok");
	const ct = health.headers.get("content-type") ?? "";
	must(ct.includes("application/json"), `GET / 应为 JSON，实际: ${ct}`);
	const hj = (await health.json()) as Record<string, unknown>;
	must(hj.status === "ok", "GET / body.status");

	const badRoute = await fetchTest(new Request(`${base}/chat/start`, { method: "POST", body: "{}" }));
	if (!badRoute) {
		throw new Error("POST /chat/start 无响应");
	}
	must(badRoute.status === 404, "HTTP 聊天接口已移除，应 404");

	console.log("api-smoke: OK（WebSocket 请另测 /ws + 密钥）");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
