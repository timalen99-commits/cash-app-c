import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const appDir = `${root}/cash-app`;
const results = [];

function run(name, command, cwd = root) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); });
    child.on("close", (code) => {
      const result = { name, command: command.join(" "), code: code ?? 1, stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) };
      results.push(result);
      resolve(result);
    });
  });
}

await run("backend-health", ["node", "scripts/check-backend.mjs"]);
await run("typecheck", ["yarn", "tsc", "--noEmit"], appDir);
await run("web-export", ["yarn", "expo", "export", "--platform", "web"], appDir);

await mkdir(`${root}/artifacts`, { recursive: true });
await writeFile(`${root}/artifacts/repo-check.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  sha: process.env.GITHUB_SHA || "local",
  branch: process.env.GITHUB_REF_NAME || "local",
  results,
}, null, 2));

const failed = results.filter((result) => result.code !== 0);
console.log(`Repository checks completed: ${results.length - failed.length} passed, ${failed.length} failed.`);
process.exitCode = failed.length ? 1 : 0;
