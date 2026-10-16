import { spawn } from "node:child_process";

const port = Number(process.env.BACKEND_PORT || 3011);
const child = spawn(process.execPath, ["backend/server.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

const stop = () => child.kill("SIGTERM");
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      const payload = await response.json();
      if (!response.ok || payload.ok !== true) throw new Error(JSON.stringify(payload));
      console.log(JSON.stringify({ ok: true, endpoint: "/api/health", payload }));
      stop();
      process.exit(0);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Backend health endpoint did not become ready");
} finally {
  stop();
}
