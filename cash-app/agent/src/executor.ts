import { Sandbox, type Execution } from "@e2b/code-interpreter";

export type AgentTask = {
  code: string;
  language?: "python" | "javascript" | "typescript";
  timeoutMs?: number;
  executionTimeoutMs?: number;
};

export type AgentResult = {
  ok: boolean;
  stdout: string[];
  stderr: string[];
  results: Array<{ text?: string | undefined }>;
  error?: { name: string; value: string; traceback: string };
};

export type ExecutionLike = Pick<Execution, "logs" | "results" | "error">;
export type SandboxLike = {
  runCode: (code: string, opts?: { language?: AgentTask["language"] }) => Promise<ExecutionLike>;
  kill: () => Promise<boolean>;
};
export type SandboxFactory = (opts: {
  template?: string;
  timeoutMs: number;
}) => Promise<SandboxLike>;

const defaultFactory: SandboxFactory = async ({ template, timeoutMs }) => {
  const sandbox = await Sandbox.create({
    ...(template ? { template } : {}),
    timeoutMs,
  });
  return {
    runCode: (code, opts) =>
      opts?.language
        ? sandbox.runCode(code, { language: opts.language })
        : sandbox.runCode(code),
    kill: () => sandbox.kill(),
  };
};

const environment = process.env as Record<string, string | undefined>;

function envNumber(name: string, fallback: number): number {
  const raw = environment[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function serializeExecution(execution: ExecutionLike): AgentResult {
  return {
    ok: !execution.error,
    stdout: execution.logs.stdout,
    stderr: execution.logs.stderr,
    results: execution.results.map((result) =>
      result.text === undefined ? {} : { text: result.text },
    ),
    ...(execution.error
      ? {
          error: {
            name: execution.error.name,
            value: execution.error.value,
            traceback: execution.error.traceback,
          },
        }
      : {}),
  };
}

export async function executeAgentTask(
  task: AgentTask,
  factory: SandboxFactory = defaultFactory,
): Promise<AgentResult> {
  if (!task.code.trim()) throw new Error("Task code must not be empty");

  const sandboxTimeoutMs = task.timeoutMs ?? envNumber("E2B_TIMEOUT_MS", 120_000);
  const executionTimeoutMs =
    task.executionTimeoutMs ?? envNumber("E2B_EXECUTION_TIMEOUT_MS", 30_000);
  const factoryOptions = { timeoutMs: sandboxTimeoutMs } as { template?: string; timeoutMs: number };
  if (environment.E2B_TEMPLATE) factoryOptions.template = environment.E2B_TEMPLATE;
  const sandbox = await factory(factoryOptions);

  try {
    const execution = await Promise.race([
      sandbox.runCode(task.code, {
        ...(task.language ? { language: task.language } : {}),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Execution timed out after ${executionTimeoutMs}ms`)),
          executionTimeoutMs,
        ),
      ),
    ]);
    return serializeExecution(execution);
  } finally {
    await sandbox.kill().catch(() => undefined);
  }
}
