import { createAgentGraph } from "../src/graph/agentGraph";
import { createInitialState } from "../src/graph/state";

type EvalCase = {
  name: string;
  turns: string[];
  expect: {
    status: "completed";
    outputKind: "forbidden_pour" | "forbidden_fill" | "solder_mask";
    continuous: boolean;
    expMilMin: number;
    expMilMax: number;
  };
};

const cases: EvalCase[] = [
  {
    name: "中文完整一句",
    turns: ["阻焊区域，外扩0.1mm，连续生成", "确认"],
    expect: {
      status: "completed",
      outputKind: "solder_mask",
      continuous: true,
      expMilMin: 3.93,
      expMilMax: 3.94,
    },
  },
  {
    name: "默认mil + 单次",
    turns: ["禁止填充，外扩 8mil，单次", "确认"],
    expect: {
      status: "completed",
      outputKind: "forbidden_fill",
      continuous: false,
      expMilMin: 8,
      expMilMax: 8,
    },
  },
  {
    name: "分多轮补全",
    turns: ["我要做禁止铺铜", "外扩 12mil", "连续模式关掉", "确认"],
    expect: {
      status: "completed",
      outputKind: "forbidden_pour",
      continuous: false,
      expMilMin: 12,
      expMilMax: 12,
    },
  },
];

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

async function run(): Promise<void> {
  const graph = createAgentGraph();
  let pass = 0;

  for (const item of cases) {
    let state = createInitialState();
    for (const turn of item.turns) {
      state = await graph.invoke({
        ...state,
        latestUserInput: turn,
        userConfirmed: false,
      });
    }

    const ok =
      state.status === item.expect.status &&
      state.normalized?.outputKind === item.expect.outputKind &&
      state.normalized?.continuous === item.expect.continuous &&
      typeof state.normalized?.expMil === "number" &&
      inRange(
        state.normalized.expMil,
        item.expect.expMilMin,
        item.expect.expMilMax,
      );

    if (ok) {
      pass += 1;
      console.log(`[PASS] ${item.name}`);
    } else {
      console.log(`[FAIL] ${item.name}`);
      console.log(
        JSON.stringify(
          {
            status: state.status,
            normalized: state.normalized,
            reply: state.assistantReply,
          },
          null,
          2,
        ),
      );
    }
  }

  console.log(`\n结果：${pass}/${cases.length} 通过`);
  if (pass !== cases.length) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

