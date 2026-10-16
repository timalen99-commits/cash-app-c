import test from "node:test";
import assert from "node:assert/strict";
import { executeAgentTask } from "../src/executor.js";

test("live E2B smoke test", { skip: !(process.env as Record<string, string | undefined>).E2B_API_KEY }, async () => {
  const result = await executeAgentTask({ code: "print(2 + 2)" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.stdout, ["4\n"]);
});
