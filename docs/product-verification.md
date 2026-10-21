# SupportPilot product verification

> Historical report. See [current environment verification](environment-verification.md) for the subsequent successful remote development flow and current local/production audit.


Date: 20 October 2026. Environment: Windows, Node.js 22.18.0, npm 10.9.3.

## A. Product status

Implemented customer, agent, and administrator workflows on the existing Next.js → Express → PostgreSQL/Prisma architecture, with Redis/BullMQ workers and the replaceable AI provider layer retained.

**Verified:** strict compilation, production builds, unit/policy/error-contract tests, browser navigation and rendering contracts, responsive overflow checks, API liveness, and frontend HTTP availability.

**Not verified end-to-end:** real registration/login/ticket persistence, assignment/history transactions, SLA scanning against PostgreSQL, successful seed execution, Redis job execution, and real provider inference. PostgreSQL and Redis refused local connections; Docker was unavailable. Browser fixture tests are not represented as real database flow verification.

## B. Major changes

- Added a complete customer portal and shared sign-in/registration experience instead of rejecting customer logins.
- Replaced the monolithic dashboard with reusable application shell, ticket list/detail, property controls, conversation, activity/history, SLA, AI, metric, and form components.
- Added database-wide operations metrics and an administrator staff/workload directory.
- Implemented automatic browser refresh with a single-flight request, retrying an expired access token once and guarding late refresh responses after logout.
- Fixed concurrent refresh consumption; registration and its initial session now commit together.
- Protected requests consult current user status/role so suspended accounts and changed privileges are enforced server-side.
- Preserved bcrypt hashing, added its 72-byte input guard, and validated JWT claims, audience, algorithm, and expiry configuration.
- Serialized ticket edits, assignment changes, and first-response writes; public replies and internal notes update activity correctly.
- Made staff timelines inaccessible to customers and removed event metadata from customer SLA responses.
- Added lifetime SLA event uniqueness and concurrent-scan deduplication; late completion remains breached and reopening retains the original deadlines.
- Added sanitized centralized JSON errors, request IDs, structured request logging, and bounded reconnect logging.
- Added disabled-AI capabilities/state, explicit human application of recommendations, editable drafts, provider timeout, atomic result/audit persistence, and guarded duplicate completion.
- Split worker/API Redis connection policies and corrected offline shutdown behavior.
- Added a guarded, repeatable development seed.
- Separated `.next-dev` from production `.next` output to prevent concurrent dev/build corruption. Browser checks exercise the actual standalone production entrypoint.
- Patched PostCSS to 8.5.31 through a targeted override; retained framework major versions.
- Corrected ticket-link semantics after browser accessibility checks caught an overriding list-item role.

## C. Database

`apps/api/prisma/schema.prisma` validates. AIAnalysis and SLAEvent retain their actual client properties, `aIAnalysis` and `sLAEvent`.

Added `@@unique([ticketId, type])` for lifetime SLA event integrity. No fake migration was written. `npm run db:migrate -- --name init` reached the configured local PostgreSQL datasource but failed because the service was unavailable. Existing database data was not reset or deleted.

`npm run db:generate` was attempted repeatedly during this pass but blocked by a Windows query-engine DLL lock held by a pre-existing dev process. Stop API/worker processes before regeneration. The earlier setup pass generated the client successfully before this schema change; generation of the final schema is not claimed as successful.

`npm run db:seed` exists at the repository root. The script hashes the local password with the existing bcrypt implementation, preserves existing demo users/passwords/tickets, and creates a team, five accounts, eight tickets, assignment history, public replies, internal notes, audit history, and varied SLA examples. It refuses non-development/non-local targets. Execution was attempted and failed at database connection, so the accounts below are definitions, not confirmed-created records.

## D. Frontend

Routes:

- `/` → `/login`
- `/login`, `/register`
- `/customer` → `/customer/tickets`
- `/customer/tickets`, `/customer/tickets/new`, `/customer/tickets/[id]`
- `/dashboard`, `/dashboard/tickets/[id]`
- `/dashboard/team` (admin directory)

Shared components live under `apps/web/src/components/{app-shell,auth,dashboard,tickets,sla,ai,ui}`. API access is centralized; DTO/domain values live in `packages/types`. Loading, empty, validation/error, save confirmation, disabled AI, draft replacement, pagination, and keyboard focus states are implemented.

Desktop/laptop/tablet/mobile checks use 1440, 1280, 820, and 390 pixel widths. Screenshots of rendering fixtures were inspected for layout; fixtures are confined to test files, never application runtime.

## E. Backend

New endpoints:

| Endpoint | Access | Data |
| --- | --- | --- |
| `GET /api/v1/dashboard/summary` | Agent/Admin | Whole active-queue counts: open, unassigned, urgent, breached, at risk, assigned to current user |
| `GET /api/v1/dashboard/staff` | Admin | Staff directory and active assigned-ticket counts |
| `GET /api/v1/ai/capabilities` | Agent/Admin | Provider availability/name, without credentials |

Existing auth, ticket, message, assignment, SLA, and AI endpoints remain. Validation, authorization, and persistence stay server-side. Notification schema remains reserved: no notification center or delivery functionality is claimed.

## F. Testing results

| Command | Result |
| --- | --- |
| `npm install` | Passed; final online audit reports three high package entries in the Prisma/deepmerge-ts chain |
| `npx prisma validate --schema=apps/api/prisma/schema.prisma` | Passed |
| `npm test` | 25 passed, 0 failed, 1 PostgreSQL integration suite skipped; web Node suite has no tests |
| `npm run test:e2e` | 24 browser checks passed against standalone production output |
| `npm run test:e2e --workspace=@supportpilot/web -- --project=mobile` | Six mobile checks passed again after final readability changes |
| `npm ls postcss` | Resolves patched 8.5.31 with override, no invalid dependency entry |
| `git diff --check` | Passed |

The PostgreSQL integration suite is implemented under `apps/api/src/integration/flows.test.ts`. It requires an explicit local `SUPPORTPILOT_TEST_DATABASE_URL` ending in `_test`. It covers role protection, ownership, internal-note restrictions, assignment, response SLA, lifecycle/reopening, concurrent scans, metrics/RBAC, disabled AI/failure persistence, refresh rotation/revocation, and suspension. CI prepares its disposable test database and enables the suite. The remote workflow was not run during this session.

Browser tests for workspace rendering use synthetic API fixtures; they do not validate PostgreSQL or replace API integration tests. The initial browser checks exposed an ambiguous alert selector, an actual ticket-link role issue, and shared dev/build output corruption. Those were corrected; the final production suite passed.

## G. Build/typecheck

- `npm run typecheck`: passed across API, web, and shared types with strictness preserved.
- `npm run build`: passed API (including worker), all frontend routes, and shared types.
- `npm run build --workspace=@supportpilot/api`: passed again after offline logging/shutdown refinements.
- `npm run build --workspace=@supportpilot/web`: passed again after final mobile filter refinement.

No `any`, `@ts-ignore`, or strictness-disable workaround was introduced.

## H. Docker/runtime verification

`docker compose config` could not execute because Docker is not installed/on PATH. No successful container build, Compose startup, migration deployment, or Redis/PostgreSQL container connectivity is claimed.

Dockerfiles and Compose were audited statically. Images use the lockfile with npm ci; the API has OpenSSL, Prisma CLI/config/client, and compiled worker; web includes the shared workspace during build and runs standalone output. The production browser suite successfully exercises the standalone server command, but this does not verify the Linux image itself.

Runtime checks:

- `http://localhost:4000/api/v1/health`: 200, including the request-id header.
- `http://localhost:3000/login`: 200.
- `npm run dev:worker`: starts; unavailable Redis is reported as bounded structured errors. Redis-backed jobs were not executed successfully.

Temporary test-owned processes were stopped. Pre-existing API/frontend/worker processes were preserved.

## I. Remaining blockers and limitations

1. Start PostgreSQL and Redis (or install/start Docker Desktop) to run real persistence and queue flows.
2. Stop API/worker processes to release the Windows engine DLL; regenerate Prisma and generate/review/apply the real initial migration. Existing duplicate SLA events need review before the uniqueness constraint is applied.
3. Run seed and the explicit PostgreSQL integration suite; real provider execution also requires a valid server-side key. AI stays disabled by default.
4. npm's remaining three high package entries refer to Prisma → @prisma/config → deepmerge-ts. The proposed npm remediation changes the Prisma major version. That migration was not forced; runtime reachability of the advisory was not independently established. No production-readiness claim is made.

Known scope limits: sessionStorage remains JavaScript-readable; HTTP-only cookies/CSRF, public-auth rate limiting, operational monitoring/outbox recovery, notification delivery, and account editing are future work. These limits do not prevent the documented local workflows once services and migrations are available.

## J. Development-only accounts

Available only after successful seeding. Password for newly created accounts: `SupportPilot123!`. Existing demo passwords are intentionally preserved on repeated runs.

| Role | Email |
| --- | --- |
| Admin | `admin@supportpilot.local` |
| Support agent | `agent1@supportpilot.local` |
| Support agent | `agent2@supportpilot.local` |
| Customer | `customer1@supportpilot.local` |
| Customer | `customer2@supportpilot.local` |

## K. Exact next commands

Stop existing API/worker dev processes in their original terminals first. Install/start Docker Desktop if needed. Keep the existing `.env`; replace only its example JWT value with a local random value generated by:

```powershell
Set-Location D:\Supportpilot\supportpilot
node -p "require('node:crypto').randomBytes(48).toString('hex')"
```

Then, for a fresh local database:

```powershell
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run db:deploy
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Review the migration SQL. Stop if Prisma proposes resetting an existing database. `db:deploy` applies existing reviewed migrations; it cannot create an initial schema when there are no migration files.

Start each command in a separate terminal; reuse existing web terminal rather than creating a second server:

```powershell
npm run dev:api
npm run dev:worker
npm run dev:web
```

See `docs/testing.md` to enable the real `_test` database suite rather than accepting its default skip.

## L. Files changed

The list below includes the local setup baseline and this product pass, compared with the pre-pass commit. Pre-existing Next.js generated/type configuration changes were retained.

```text
.dockerignore
.github/workflows/ci.yml
.gitignore
README.md
apps/api/Dockerfile
apps/api/package.json
apps/api/prisma.config.ts
apps/api/prisma/schema.prisma
apps/api/src/ai/ai.service.ts
apps/api/src/ai/ai.validation.test.ts
apps/api/src/ai/ai.worker.service.ts
apps/api/src/ai/groq.provider.ts
apps/api/src/app.ts
apps/api/src/auth/auth.schemas.test.ts
apps/api/src/auth/auth.schemas.ts
apps/api/src/auth/auth.service.ts
apps/api/src/auth/token.test.ts
apps/api/src/auth/token.ts
apps/api/src/config/env.ts
apps/api/src/dashboard/dashboard.service.ts
apps/api/src/integration/flows.test.ts
apps/api/src/jobs/enqueue.ts
apps/api/src/jobs/queues.ts
apps/api/src/jobs/redis.ts
apps/api/src/lib/infrastructure-log.ts
apps/api/src/middleware/auth.middleware.ts
apps/api/src/middleware/error.middleware.test.ts
apps/api/src/middleware/error.middleware.ts
apps/api/src/routes/ai.routes.ts
apps/api/src/routes/auth.routes.ts
apps/api/src/routes/dashboard.routes.ts
apps/api/src/routes/sla.routes.ts
apps/api/src/routes/ticket.routes.ts
apps/api/src/seed.ts
apps/api/src/sla/sla.service.ts
apps/api/src/sla/sla.snapshot.test.ts
apps/api/src/tickets/message.service.ts
apps/api/src/tickets/ticket.policy.test.ts
apps/api/src/tickets/ticket.policy.ts
apps/api/src/tickets/ticket.service.ts
apps/api/src/workers/worker.ts
apps/web/Dockerfile
apps/web/next-env.d.ts
apps/web/next.config.ts
apps/web/package.json
apps/web/playwright.config.ts
apps/web/scripts/prepare-browser-tests.mjs
apps/web/src/app/customer/layout.tsx
apps/web/src/app/customer/page.tsx
apps/web/src/app/customer/tickets/[id]/page.tsx
apps/web/src/app/customer/tickets/new/page.tsx
apps/web/src/app/customer/tickets/page.tsx
apps/web/src/app/dashboard/layout.tsx
apps/web/src/app/dashboard/page.tsx
apps/web/src/app/dashboard/team/page.tsx
apps/web/src/app/dashboard/tickets/[id]/page.tsx
apps/web/src/app/globals.css
apps/web/src/app/layout.tsx
apps/web/src/app/login/page.tsx
apps/web/src/app/page.tsx
apps/web/src/app/register/page.tsx
apps/web/src/components/ai/ai-panel.tsx
apps/web/src/components/app-shell/app-shell.tsx
apps/web/src/components/auth/auth-form.tsx
apps/web/src/components/dashboard/metrics.tsx
apps/web/src/components/sla/sla-card.tsx
apps/web/src/components/tickets/conversation.tsx
apps/web/src/components/tickets/new-ticket.tsx
apps/web/src/components/tickets/ticket-activity.tsx
apps/web/src/components/tickets/ticket-detail.tsx
apps/web/src/components/tickets/ticket-list.tsx
apps/web/src/components/tickets/ticket-properties.tsx
apps/web/src/components/ui/states.tsx
apps/web/src/lib/api.ts
apps/web/src/lib/format.ts
apps/web/tests/ui.spec.ts
apps/web/tests/workspace.spec.ts
apps/web/tsconfig.json
docs/api.md
docs/architecture.md
docs/deployment.md
docs/local-verification.md
docs/openapi.yaml
docs/product-decisions.md
docs/product-verification.md
docs/testing.md
package-lock.json
package.json
packages/types/package.json
packages/types/src/index.ts
```

## M. Git and secret handling

No commits, pushes, history rewrites, destructive database operations, or real credential changes were performed by the agent. An external commit (`a92f743`, `feat: finalize SupportPilot production polish`) appeared during the session and was preserved. Remaining working-tree changes are available for review.

`.env` remains ignored and untracked. It was not overwritten; its AI provider remains disabled and its example JWT secret still needs replacement for local use. No production/customer data or provider keys were added. Fake analytics, migrations, provider results, notification delivery, and screenshot placeholders were not added to the application.
