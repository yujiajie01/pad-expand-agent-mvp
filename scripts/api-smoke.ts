/**
 * 冒烟：GET /、POST /chat/start（须 X-Agent-Key）、错误键 401。
 */
async function main(): Promise<void> {
	process.env.PORT = "18493";
	const { default: server } = await import("../src/server");

	const fetchTest = server.fetch as (req: Request) => Promise<Response>;
	const port = server.port;
	const base = `http://127.0.0.1:${port}`;

	function must(cond: boolean, msg: string): void {
		if (!cond) {
			throw new Error(msg);
		}
	}

	const health = await fetchTest(new Request(`${base}/`));
	must(health.ok, "GET / ok");
	const hj = (await health.json()) as Record<string, unknown>;
	must(hj.status === "ok", "GET / body.status");

	const noKey = await fetchTest(
		new Request(`${base}/chat/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
	);
	must(noKey.status === 401, "无 X-Agent-Key 应 401");

	const start = await fetchTest(
		new Request(`${base}/chat/start`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Agent-Key": "nikoyu",
			},
			body: "{}",
		}),
	);
	must(start.ok, "POST /chat/start ok");
	const st = (await start.json()) as { sessionId?: string; reply?: string };
	must(typeof st.sessionId === "string" && typeof st.reply === "string", "chat/start JSON");

	console.log("api-smoke: OK");
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
