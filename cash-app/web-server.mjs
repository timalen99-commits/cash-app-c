import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { executeAgentTask } from "./agent/dist/src/executor.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const port = Number(process.env.PORT ?? 8787);
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".ttf": "font/ttf" };

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function jsonBody(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  if (data.length > 1_000_000) throw new Error("Request body is too large");
  return JSON.parse(data || "{}");
}

async function handleAgent(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!sql) return send(res, 503, { error: "DATABASE_URL is not configured" });
  const body = await jsonBody(req);
  if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new Error("prompt is required");
  if (typeof body.code !== "string" || !body.code.trim()) throw new Error("code is required");
  const taskRows = await sql`INSERT INTO agent_tasks (prompt, language, status) VALUES (${body.prompt.trim()}, ${body.language ?? "python"}, 'running') RETURNING id`;
  const taskId = String(taskRows[0].id);
  const startedAt = new Date();
  try {
    const result = await executeAgentTask({ code: body.code, language: body.language ?? "python", timeoutMs: body.timeoutMs, executionTimeoutMs: body.executionTimeoutMs });
    await sql`INSERT INTO agent_executions (task_id, stdout, stderr, results, error, started_at, finished_at) VALUES (${taskId}, ${JSON.stringify(result.stdout)}::jsonb, ${JSON.stringify(result.stderr)}::jsonb, ${JSON.stringify(result.results)}::jsonb, ${result.error ? JSON.stringify(result.error) : null}::jsonb, ${startedAt.toISOString()}, now())`;
    await sql`UPDATE agent_tasks SET status = ${result.ok ? "succeeded" : "failed"}, updated_at = now() WHERE id = ${taskId}`;
    return send(res, 200, { taskId, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "E2B execution failed";
    await sql`UPDATE agent_tasks SET status = 'failed', updated_at = now() WHERE id = ${taskId}`;
    return send(res, 502, { taskId, error: message });
  }
}

async function handle(req, res) {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (requestUrl.pathname === "/api/health") {
      if (!sql) return send(res, 503, { ok: false, database: false });
      await sql`SELECT 1`;
      return send(res, 200, { ok: true, database: true, e2b: Boolean(process.env.E2B_API_KEY) });
    }
    if (requestUrl.pathname === "/api/agent") return await handleAgent(req, res);
    const clean = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const candidate = path.resolve(dist, `.${clean}`);
    const file = candidate.startsWith(path.resolve(dist)) ? candidate : path.join(dist, "index.html");
    try {
      const data = await fs.readFile(file);
      return send(res, 200, data, mime[path.extname(file)] ?? "application/octet-stream");
    } catch {
      const data = await fs.readFile(path.join(dist, "index.html"));
      return send(res, 200, data, mime[".html"]);
    }
  } catch (error) {
    return send(res, 400, { error: error instanceof Error ? error.message : "Request failed" });
  }
}

http.createServer(handle).listen(port, "0.0.0.0", () => console.log(`Cash App web server listening on 0.0.0.0:${port}`));
