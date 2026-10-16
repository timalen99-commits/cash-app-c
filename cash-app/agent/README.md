# Cash App agent execution service

This package is the server-side execution boundary for autonomous coding tasks. It uses the current `@e2b/code-interpreter` SDK and never belongs in the Expo/mobile bundle.

## Run

```bash
cp .env.example .env
# set E2B_API_KEY in the process environment, not in git
npm test
npm run test:live
```

`executeAgentTask` creates a fresh sandbox, runs code, returns stdout/stderr/results or the E2B execution traceback, and kills the sandbox in a `finally` block. The factory is injectable for deterministic tests.
