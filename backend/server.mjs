import { createServer } from "node:http";

const port = Number(process.env.PORT || 3001);
const buildSha = process.env.GITHUB_SHA || "local";

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, service: "cash-app-backend", sha: buildSha });
  }
  if (req.method === "GET" && url.pathname === "/api/build-info") {
    return json(res, 200, {
      name: "cash-app-clone",
      sha: buildSha,
      branch: process.env.GITHUB_REF_NAME || "local",
      runtime: process.version,
    });
  }
  return json(res, 404, { ok: false, error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`cash-app-backend listening on ${port}`);
});
