# Local setup verification — 20 October 2026

Environment: Windows, Node.js 22.18.0, npm 10.9.3.

## Fixes

- Added root worker and Prisma command wrappers, including migration argument forwarding.
- Fixed the ioredis constructor import for TypeScript NodeNext resolution.
- Added root `.env` fallback loading for the API, Prisma CLI, and Next.js while preserving injected variables and workspace overrides.
- Kept Prisma CLI in API runtime dependencies so the production image can execute migrations.
- Used the existing lockfile with `npm ci` in Docker and CI; refreshed workspace dependency metadata without a broad upgrade.
- Added OpenSSL to the Alpine API image and copied Prisma configuration into its runtime stage.
- Configured Next.js standalone output and copied its server and static assets into the web image.
- Made worker shutdown wait for jobs before closing queue and database connections.
- Replaced an existing untyped Express response parameter with `Response`.
- Ignored TypeScript incremental build artifacts and completed local setup instructions.
- Set the CI build environment to production while retaining the test environment for tests.

Prisma schema and business behavior were preserved. The generated client exposes
`aIAnalysis` and `sLAEvent`, matching the existing service calls.

## Modified or added files

```text
.dockerignore
.github/workflows/ci.yml
.gitignore
README.md
package.json
package-lock.json
apps/api/Dockerfile
apps/api/package.json
apps/api/prisma.config.ts
apps/api/src/config/env.ts
apps/api/src/jobs/redis.ts
apps/api/src/routes/ticket.routes.ts
apps/api/src/workers/worker.ts
apps/web/Dockerfile
apps/web/next.config.ts
apps/web/package.json
docs/local-verification.md
```

Pre-existing modifications to `apps/web/next-env.d.ts` and
`apps/web/tsconfig.json` were preserved. The pre-existing untracked lockfile is
included above because its dependency metadata was updated. The pre-existing
`apps/web/tsconfig.tsbuildinfo` is now ignored.

## Successful checks

- `npm install`: successful, zero audit vulnerabilities reported.
- `npm run db:generate`: successful initial run, Prisma Client 6.19.3.
- `npm exec --workspace=@supportpilot/api -- prisma validate`: schema valid with the new Prisma configuration.
- `npm run typecheck`: all three workspaces passed after the final build.
- `npm test`: all 12 API tests passed; frontend currently has no tests.
- `npm run build`: API (including worker), Next.js production build, and shared types passed.
- `npm run dev:api`: started on temporary port 4001; health endpoint returned 200.
- Existing API at `http://localhost:4000/api/v1/health`: returned 200.
- `npm run dev:web`: `/` and `/dashboard` returned 200 at localhost:3000.
- `npm run dev:worker`: entrypoint started. Queue processing was not verified.
- `git diff --check`: passed.

Engine downloads, tests, build workers, and runtime checks required execution
outside the restricted sandbox. A build overlapping the frontend dev server
failed during tracing; a subsequent isolated full build passed.

## Remaining limitations

- Docker is not installed/on PATH, including the standard Docker Desktop binary location. Container builds and Compose execution could only be audited statically.
- PostgreSQL at localhost:5432 and Redis at localhost:6379 refused connections.
- `npm run db:migrate -- --name init` and `npm run db:deploy` reached the intended local database configuration but failed at the schema engine stage. No migrations were fabricated.
- There is no checked-in initial migration; deployment is not ready until a real initial migration has been generated, reviewed, and applied successfully.
- A later Prisma generation retry was blocked by a Windows engine DLL lock while the user's existing API was running. Stop API/worker processes before retrying generation.
- End-to-end auth, ticket persistence, assignment history, SLA scanning, and BullMQ processing need running services and migrations. The health endpoint is a liveness check and does not prove database/Redis connectivity.
- GitHub Actions itself was not executed, and Docker image runtime behavior remains unverified.

The existing `.env` was untouched and is ignored by Git. It contains the expected
local database/Redis URLs, disabled AI, no provider key, and the example JWT
secret. Replace that placeholder with a local random value before using auth.
No secrets were printed or committed. No commits or pushes were made.

All temporary API, worker, and frontend processes were stopped. The pre-existing
API on port 4000 was left running.

## Next commands

Stop the API in its original terminal first. Install/start Docker Desktop, then
run these from PowerShell:

```powershell
Set-Location D:\Supportpilot\supportpilot
node -p "require('node:crypto').randomBytes(48).toString('hex')"
```

Copy the generated value into `JWT_ACCESS_SECRET` in the existing `.env`, keeping
the other settings. Then, for a fresh local database:

```powershell
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate -- --name init
npm run db:deploy
npm run typecheck
npm test
npm run build
```

Review generated migration SQL. Stop if Prisma proposes a reset of an existing
database; inspect/baseline it rather than discarding data.

Start each dev command in its own terminal:

```powershell
npm run dev:api
npm run dev:worker
npm run dev:web
```
