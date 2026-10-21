# SupportPilot

A support workspace for customers to raise requests and for teams to triage, respond, assign ownership, and track response deadlines. AI helps agents understand a conversation and prepare a reply; people decide what changes and what gets sent.

## Product

- **Customers:** register, sign in, create requests, follow ticket progress, reply to support, and see response targets. Internal notes and staff activity remain private.
- **Agents:** search and paginate the queue, manage status/priority/category, assign or reassign tickets, write public replies and internal notes, and review ownership and audit history.
- **Administrators:** use the support workspace plus a staff directory with active workload counts.
- **Operations:** database-wide active-ticket metrics, priority-based SLA targets, and background breach scanning.
- **AI assistance:** asynchronous classification, summaries, priority suggestions, and draft responses. Suggestions require an explicit action; drafts enter an editable composer before sending. Disabled AI has a clear unavailable state.

The application uses PostgreSQL for all business records. There is no mock-data mode in the application. Browser rendering tests use synthetic API fixtures separately from the real database integration suite.

## Architecture

```mermaid
flowchart LR
  Browser --> Web[Next.js web]
  Web --> API[Express API]
  API --> DB[(PostgreSQL / Prisma)]
  API --> Queue[(Redis / BullMQ)]
  Queue --> Worker[AI and SLA workers]
  Worker --> DB
  Worker --> Provider[Replaceable AI provider]
```

TypeScript is strict throughout. Express owns validation and authorization; Prisma transactions protect ticket edits and their history. The API persists pending AI analyses before enqueueing work. Workers run independently of the web and API processes.

| Location         | Responsibility                                                           |
| ---------------- | ------------------------------------------------------------------------ |
| `apps/web`       | Next.js / React frontend, reusable ticket and workspace components       |
| `apps/api`       | Express, auth/RBAC, ticket services, Prisma schema, seed, BullMQ workers |
| `packages/types` | Shared frontend contracts and domain values                              |
| `docs`           | API, architecture, testing, deployment, and verification notes           |

Stack: Node.js 22+, npm workspaces, Next.js 15, React 19, Express 5, Prisma 6, PostgreSQL 17, Redis 7, BullMQ, Zod, Docker, GitHub Actions.

## Run locally

Requires Node.js 22+, npm, and running PostgreSQL/Redis. Docker Desktop is the simplest way to start the included services.

From the repository root in PowerShell:

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
node -p "require('node:crypto').randomBytes(48).toString('hex')"
```

Put that generated development-only value in `JWT_ACCESS_SECRET` in your existing `.env`. Keep other settings and never commit this file. The API, Prisma CLI, and Next.js load root defaults while preserving injected variables and workspace overrides.

The example uses:

```env
DATABASE_URL=postgresql://supportpilot:supportpilot@localhost:5432/supportpilot?schema=public
REDIS_URL=redis://localhost:6379
API_PORT=4000
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
AI_PROVIDER=disabled
```

Then, for a fresh development database:

```powershell
docker compose up -d postgres redis
npm run db:generate
npm run db:deploy
npm run db:seed
```

The real initial migration is included under `apps/api/prisma/migrations` and has been applied to the configured development PostgreSQL database. Use `npm run db:deploy` for an empty database; use `db:migrate` when developing schema changes. Do not reset an existing database to bypass a migration error. The schema adds a unique ticket/type SLA event constraint; existing installations must review any duplicate events before applying it.

Stop API/worker processes before Prisma generation on Windows if its engine DLL is locked. Development uses `.next-dev`; production builds and standalone browser checks use `.next`, so the two processes do not overwrite each other.

Start each process in a separate terminal:

```powershell
npm run dev:api
npm run dev:worker
npm run dev:web
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- Liveness: http://localhost:4000/api/v1/health

The health route does not prove database/Redis readiness.

## Development accounts

Available **only after `npm run db:seed` succeeds**. Password for newly seeded accounts: **`SupportPilot123!`**. These are synthetic local accounts; never seed them into production.

| Role          | Email                          |
| ------------- | ------------------------------ |
| Admin         | `admin@supportpilot.local`     |
| Support agent | `agent1@supportpilot.local`    |
| Support agent | `agent2@supportpilot.local`    |
| Customer      | `customer1@supportpilot.local` |
| Customer      | `customer2@supportpilot.local` |

The seed uses the existing bcrypt implementation, creates a team and eight realistic support requests, and includes assignment history, public replies, internal notes, audit records, and varied SLA scenarios. Re-running it preserves existing demo tickets and passwords. It refuses non-development environments. A remote development database requires explicit opt-in: `npm run db:seed -- --allow-remote-development`. It does not delete data.

## Routes

`/login`, `/register`, `/customer` → `/customer/tickets`, `/customer/tickets/new`, `/customer/tickets/[id]`, `/dashboard`, `/dashboard/tickets/[id]`, `/dashboard/team` (admin).

Authentication redirects are a navigation convenience. Every protected API request checks the current account and its role server-side.

## Checks

```powershell
npm run db:generate
npx prisma validate --schema=apps/api/prisma/schema.prisma
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The API suite includes an opt-in integration test requiring a dedicated local `*_test` database. CI prepares the schema in its disposable PostgreSQL service and runs that test. See [testing](docs/testing.md) for setup and browser requirements.

Run `npm run build` before browser checks, which start the standalone production server on port 3001. Browser checks use installed Edge on Windows. On other systems, install Playwright Chromium with `npm exec --workspace=@supportpilot/web -- playwright install chromium`. Rendering tests cover 1440px desktop, 1280px laptop, 820px tablet, and 390px mobile. They are separate from database-backed flow verification.

## Docker and CI

`docker-compose.yml` runs the local database and Redis. `docker-compose.prod.yml` additionally runs web, API, and worker images. Images and CI use `npm ci` with the lockfile. The web image runs Next.js standalone output; the API image includes Prisma CLI for `npm run db:deploy`.

CI installs dependencies, generates/validates Prisma, typechecks, deploys migrations to an isolated integration database, tests, and builds. Container execution and the remote GitHub Actions run remain unverified locally. See [deployment](docs/deployment.md).

## Status and limitations

Implemented features are listed above; local execution results and blockers are tracked in [the product verification report](docs/product-verification.md).

- The initial migration, demo seed and real multi-role browser/API workflow succeeded against remote development PostgreSQL. Root `.env` now targets local services; these require Docker or local PostgreSQL/Redis. See [current environment verification](docs/environment-verification.md) for results and blockers.
- Browser tokens remain in sessionStorage, with single-flight refresh and token rotation. JavaScript can read them; XSS could steal them. HTTP-only cookie sessions with CSRF protection are a future auth migration, not partially implemented here.
- Notification schema is reserved for future work. There is no notification center or email/SMS delivery.
- Public registration always creates customers. A staff account editor, rate limiting, and production monitoring are not implemented.
- SLA targets remain fixed at creation. Reopening retains the original deadlines; see [SLA and security decisions](docs/product-decisions.md).
- A targeted PostCSS 8 override addresses the reported CSS dependency advisories. Remaining Prisma/deepmerge-ts advisories require review; see the verification report. No forced framework upgrades were applied.

No production deployment, traffic, uptime, or scale claim is made. The next release work is to verify migrations and real flows, review dependency advisories, and add operational controls before a public deployment.

[API reference](docs/api.md) · [OpenAPI](docs/openapi.yaml) · [Architecture](docs/architecture.md) · [Testing](docs/testing.md)
