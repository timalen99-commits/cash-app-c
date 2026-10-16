import { neon } from "@neondatabase/serverless";
import { executeAgentTask, type AgentTask } from "../agent/src/executor";

type RequestBody = AgentTask & { prompt: string };
type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

function getDatabase() {
  const environment = process.env as Record<string, string | undefined>;
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  return neon(databaseUrl);
}

function parseBody(body: unknown): RequestBody {
  if (!body || typeof body !== "object") throw new Error("JSON body is required");
  const value = body as Record<string, unknown>;
  if (typeof value.prompt !== "string" || !value.prompt.trim()) {
    throw new Error("prompt is required");
  }
  if (typeof value.code !== "string" || !value.code.trim()) {
    throw new Error("code is required so the E2B interpreter can execute the task");
  }
  const language = value.language;
  if (language !== undefined && language !== "python" && language !== "javascript" && language !== "typescript") {
    throw new Error("language must be python, javascript, or typescript");
  }
  return {
    prompt: value.prompt.trim(),
    code: value.code,
    ...(language ? { language } : {}),
    ...(typeof value.timeoutMs === "number" ? { timeoutMs: value.timeoutMs } : {}),
    ...(typeof value.executionTimeoutMs === "number" ? { executionTimeoutMs: value.executionTimeoutMs } : {}),
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = parseBody(req.body);
    const sql = getDatabase();
    const taskRows = await sql`
      INSERT INTO agent_tasks (prompt, language, status)
      VALUES (${body.prompt}, ${body.language ?? "python"}, 'running')
      RETURNING id
    `;
    const taskId = String(taskRows[0].id);
    const startedAt = new Date();

    try {
      const result = await executeAgentTask(body);
      await sql`
        INSERT INTO agent_executions (task_id, stdout, stderr, results, error, started_at, finished_at)
        VALUES (${taskId}, ${JSON.stringify(result.stdout)}::jsonb, ${JSON.stringify(result.stderr)}::jsonb, ${JSON.stringify(result.results)}::jsonb, ${result.error ? JSON.stringify(result.error) : null}::jsonb, ${startedAt.toISOString()}, now())
      `;
      await sql`UPDATE agent_tasks SET status = ${result.ok ? "succeeded" : "failed"}, updated_at = now() WHERE id = ${taskId}`;
      res.status(200).json({ taskId, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "E2B execution failed";
      await sql`UPDATE agent_tasks SET status = 'failed', updated_at = now() WHERE id = ${taskId}`;
      res.status(502).json({ taskId, error: message });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    res.status(400).json({ error: message });
  }
}
