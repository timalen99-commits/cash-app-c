# Build and branch checks

Every push and pull request runs `.github/workflows/repo-check.yml`. The workflow installs the Expo app from `cash-app/yarn.lock`, probes the backend health endpoint, runs TypeScript checking, and performs an Expo web export. A JSON report is uploaded for every run, including failed checks.

The backend is intentionally small and stateless. `backend/server.mjs` exposes `GET /api/health` for readiness and `GET /api/build-info` for build provenance. It uses only Node's standard library, so it can run locally or inside a managed container without an additional dependency service.

E2B execution is not enabled until the repository has an `E2B_API_KEY` secret and a selected E2B template/runtime. The check workflow is intentionally secret-gated; no API key belongs in source, commits, or chat. Once the E2B connector or repository secret is connected, the branch job can run the same `node scripts/repo-check.mjs` command inside the sandbox and upload the same report.

The current repository has no additional branches beyond `main`; the workflow pattern matches every branch created later.
