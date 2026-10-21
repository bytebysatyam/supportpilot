# Environment and deployment verification ? 2026-10-21

## Outcome

Configuration and compile/test checks pass. The project cannot yet complete the requested all-local end-to-end flow because Docker, local PostgreSQL, and local Redis are unavailable on this PC. Production health/CORS and the frontend's bundled API base were inspected successfully; a complete production persistence/worker flow was not tested and the local fixes have not been deployed.

## Private environment audit

All expected keys exist: NODE_ENV, API_PORT, WEB_ORIGIN, NEXT_PUBLIC_API_URL, DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, SLA_SCAN_INTERVAL_MS, AI_PROVIDER, GROQ_API_KEY, GROQ_MODEL. No duplicates or malformed application values were found. Four unused connection-metadata keys (Port, Database, Username, Password) were removed from root .env and remain preserved in the private backup. No expected application key is overridden by the shell environment. GROQ_API_KEY is empty and AI_PROVIDER is disabled, which is valid. JWT_ACCESS_SECRET is configured and meets the minimum length; its value was not reported.

Initially, frontend/API origins were local while database/Redis targets were remote. The original private configuration was preserved in ignored `.env.remote-development`. Root `.env` now targets local PostgreSQL and Redis. Private credentials remain preserved and were not published or committed. Neither private file is automatically used for production. There are no additional workspace .env/.env.local overrides.

## Files changed for this audit

| File | Reason |
| --- | --- |
| .env (ignored) | Switch service URLs to local development; preserve secret values. |
| .env.remote-development (ignored) | Preserve the former private remote configuration; never auto-load it. |
| .env.example | Explain local placeholders, trusted-origin lists and API-base requirements. |
| apps/api/src/config/env.schema.ts | Validate origins, PostgreSQL/Redis protocols, ports, provider key and production requirements. |
| apps/api/src/config/env.schema.test.ts | Test valid/invalid environment configurations. |
| apps/api/src/config/env.ts | Keep local dotenv fallback out of production; validate through shared schema. |
| apps/api/prisma.config.ts | Keep production Prisma commands on injected environment variables. |
| apps/api/src/server.ts | Honor Render PORT before API_PORT and bind 0.0.0.0. |
| apps/api/src/app.ts | Exact, comma-separated CORS allowlist; credentials retained. |
| apps/api/src/lib/prisma.ts | Suppress raw connection/input logs; safe central metadata remains. |
| apps/web/next.config.ts | Validate API base and require it on Vercel; exclude root dotenv from production. |
| apps/web/src/lib/api.ts | Normalize trailing slashes while retaining environment-driven API requests. |
| apps/web/Dockerfile | Require explicit public API build argument. |
| docker-compose.yml | Bind local service ports to loopback; Redis AOF/noeviction. |
| docker-compose.prod.yml | Redis noeviction; require essential environment substitutions. |
| README.md | Point to current migration/environment results. |
| docs/deployment.md | Exact local, Vercel, Render API/worker environment and commands. |
| docs/testing.md | Migration-based CI setup and explicit live-test procedure. |
| docs/environment-verification.md | This report. |
| docs/product-verification.md, docs/local-verification.md | Mark older service-availability findings as historical. |

Earlier changes from the ongoing setup/E2E work are also present in the working tree, including the generated initial migration, guarded seed, transaction timeout/SLA scanning fixes, tests, and CI migration deployment. They were preserved. No commit or push was made.

## Commands and results

| Command/check | Result |
| --- | --- |
| npm ci | PASS after stopping verification servers to release Windows native DLL locks. |
| npm run db:generate | PASS, real Prisma 6.19.3 client generated. |
| npm exec --workspace=@supportpilot/api -- prisma validate | PASS. |
| docker compose up -d postgres redis | FAIL: Docker command not installed/on PATH. |
| npm run db:deploy (local target) | FAIL: local PostgreSQL unavailable; no reset attempted. |
| npm run db:seed (local target) | FAIL: local PostgreSQL unavailable. |
| npm run typecheck | PASS for API/worker, web and shared types after client generation. |
| npm test | PASS: 29 passed, 1 disposable-PostgreSQL integration test skipped. |
| npm run build | PASS: API/worker TypeScript, Next.js and shared types. |
| npm run dev:api | PASS startup; injected PORT=4000 takes precedence over API_PORT=4500. |
| npm run dev:web | PASS startup and real /register page in Edge. |
| npm run dev:worker | PASS process startup; Redis connection/job execution NOT VERIFIED. |
| Local /api/v1/health | PASS, HTTP 200. |
| Local CORS allowlist | PASS: local and production origins allowed when explicitly configured; untrusted origin gets no access-control-allow-origin. |
| Local registration/login persistence | NOT VERIFIED: real requests return 503 SERVICE_UNAVAILABLE because local PostgreSQL is stopped. |
| Local frontend registration error/retry | PASS: real API 503 shown accurately, submit can be retried; no mocks. |
| Local anonymous /auth/me | PASS, HTTP 401. |
| Frontend accepts production API base | PASS. |
| Frontend rejects /health API base | PASS. |
| Public Render health | PASS, HTTP 200. |
| Public Render production CORS | PASS, response allows the production frontend; other origins cannot access it from browsers. |
| Public Vercel /register and /login | PASS, HTTP 200. |
| Public frontend bundle | PASS, embedded public API base path is /api/v1, without /health. |
| Full production DB/Redis/worker flow | NOT VERIFIED; no deployment or provider configuration was changed. |

All API/web/worker verification processes were stopped after testing.

## Database and real-flow evidence from preceding verification

Exactly one real migration exists: `apps/api/prisma/migrations/20261020120707_init/migration.sql`. It was generated by Prisma from the existing schema and applied to the previously configured remote development database. A subsequent `db:deploy` reported one migration and no pending migrations. No duplicate initial migration, fake SQL, reset or data deletion was performed. The schema reads DATABASE_URL from the environment; AIAnalysis and SLAEvent delegates use the real generated names `aIAnalysis` and `sLAEvent`.

The development seed previously completed against that remote development database using explicit `--allow-remote-development`: five dummy accounts and eight tickets with history, messages, notes and SLA records. Re-running preserves existing demo users/passwords/tickets. Passwords use bcrypt. Production seeding remains blocked and is never part of deployment commands.

The preceding real Edge/API test passed in approximately four minutes with no mocked API responses. It verified customer registration, logout/login, ticket creation and persisted reads, customer reply, agent/admin login, customer ownership/RBAC, assignment and reassignment/history, internal-note isolation, public reply/first-response SLA, allowed/invalid lifecycle transitions including resolve/reopen/close, disabled AI, dashboard/team access, refresh rotation/replay rejection and logout revocation. This was a local web/API connected to remote development PostgreSQL. It does not establish all-local persistence, periodic SLA scan execution, Redis queue execution, or production deployment readiness. The newer aggregate-count and standalone SLA-scan assertions were added afterward and have not been exercised against local PostgreSQL.

## Redis, dependencies and security

API producers and workers share REDIS_URL. Producers fail promptly; worker retry configuration uses maxRetriesPerRequest=null as BullMQ requires. redis:// and rediss:// are supported without disabling TLS verification. Docker services explicitly use noeviction and append-only persistence. The remote provider's actual eviction policy was not verified. allkeys-lru can evict job/lock data; queue reliability remains unresolved unless the provider supplies noeviction and jobs are tested.

Git ignores both private environment files, and neither is tracked. An initial scan of 117 tracked files and a final scan of 126 tracked/new source files found no known private environment values or common provider/token/private-key patterns. Environment-file history and a targeted private-key/provider-token history search returned no matches. These are scoped checks, not a guarantee against every possible historical secret format. The example file contains only disposable local values/placeholders.

npm audit reports three high package entries in one dependency chain: prisma ? @prisma/config ? deepmerge-ts (<8.0.0), GHSA-ggr8-5vv4-36mx (recursive graph stack exhaustion). npm proposes a Prisma major upgrade. No forced upgrade or unverified transitive major override was applied. Review/remediate this separately before a public production release.

## Next steps

Install/start Docker Desktop, then run the [local commands](deployment.md#local-development). Review the changes and exact [Vercel/Render setup](deployment.md). Set platform variables privately and redeploy deliberately; do not upload either private dotenv file. Verify production auth/database persistence and real worker job completion afterward. Keep AI disabled until a valid provider is configured.
