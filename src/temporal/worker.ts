import { Worker } from "@temporalio/worker";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appEnv } from "../config/env";

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const worker = await Worker.create({
    workflowsPath: path.resolve(__dirname, "./workflows"),
    activities: await import("./activities"),
    taskQueue: "pad-expand-agent",
    connection: { address: appEnv.temporalAddress },
    namespace: appEnv.temporalNamespace,
  });
  console.log(
    `[temporal-worker] connected to ${appEnv.temporalAddress}, namespace=${appEnv.temporalNamespace}`,
  );
  await worker.run();
}

main().catch((err) => {
  console.error("[temporal-worker] fatal:", err);
  process.exit(1);
});
