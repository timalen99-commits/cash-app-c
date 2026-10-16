import assert from "node:assert/strict";
import test from "node:test";
import { executeAgentTask, type SandboxLike, type ExecutionLike } from "../src/executor.js";

function fakeSandbox(runCode: SandboxLike["runCode"], state: { killed: boolean }): SandboxLike {
  return { runCode, kill: async () => { state.killed = true; return true; } };
}
function execution(value: Partial<ExecutionLike>): ExecutionLike {
  return {
    logs: { stdout: [], stderr: [] },
    results: [],
    ...value,
  } as ExecutionLike;
}

test("returns captured output and cleans up after success", async () => {
  const state = { killed: false };
  const result = await executeAgentTask({ code: "print('ok')" }, async () =>
    fakeSandbox(async () => (execution({ logs: { stdout: ["ok"], stderr: [] } })), state),
  );
  assert.deepEqual(result, { ok: true, stdout: ["ok"], stderr: [], results: [] });
  assert.equal(state.killed, true);
});

test("returns execution errors without hiding the traceback", async () => {
  const state = { killed: false };
  const result = await executeAgentTask({ code: "raise ValueError('bad')" }, async () =>
    fakeSandbox(async () => (execution({
      logs: { stdout: [], stderr: ["error"] },
      error: { name: "ValueError", value: "bad", traceback: "trace" },
    })), state),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.error, { name: "ValueError", value: "bad", traceback: "trace" });
  assert.equal(state.killed, true);
});

test("times out and still cleans up", async () => {
  const state = { killed: false };
  await assert.rejects(
    executeAgentTask({ code: "while True: pass", executionTimeoutMs: 5 }, async () =>
      fakeSandbox(() => new Promise(() => undefined), state),
    ),
    /Execution timed out after 5ms/,
  );
  assert.equal(state.killed, true);
});

test("rejects empty tasks before creating a sandbox", async () => {
  await assert.rejects(executeAgentTask({ code: "   " }), /must not be empty/);
});
