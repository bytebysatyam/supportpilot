# SupportPilot

AI-powered customer support and ticket automation platform built as a production-style full-stack engineering project.

SupportPilot is designed to demonstrate end-to-end software engineering across authentication, role-based access control, ticket workflows, SLA tracking, background processing, AI-assisted support operations, auditability, testing, and deployment.

## Current Status

**Phase 10 — Docker + CI/CD configuration implemented (execution/deployment verification pending)**

The repository currently contains:

- Next.js + TypeScript frontend workspace
- Express + TypeScript backend workspace
- Prisma + PostgreSQL relational data model
- Shared domain types
- PostgreSQL and Redis development services
- Customer registration and login
- bcrypt password hashing
- JWT access tokens
- Opaque hashed refresh tokens with rotation/revocation
- Authentication and reusable RBAC middleware
- Customer-scoped ticket creation and access
- Staff ticket queue with filters, search, and pagination
- Ticket status, priority, and category management
- Agent assignment/reassignment with assignment history
- Public ticket replies and staff-only internal notes
- Customer-safe message visibility
- Transactional ticket audit events and unified timeline
- Priority-based SLA deadlines and breach tracking
- First-response and resolution SLA events
- Ticket-level SLA snapshots with at-risk indicators
- Provider-agnostic AI assistance layer
- Ticket classification, summaries, priority suggestions, and draft responses
- Structured AI output validation and persisted AI analysis history
- Human-review-only AI workflow
- Redis-backed BullMQ background queues
- Async AI analysis with retries and deduplication
- Periodic SLA breach worker
- Separate API and worker processes with graceful shutdown
- Responsive Agent/Admin operations dashboard
- Real ticket queue, filters, assignment, timeline, SLA and AI controls
- Public reply and internal-note composer
- Automated validation and SLA logic tests
- API reference and OpenAPI 3.1 contract
- Testing strategy and verification guide
- Production-oriented API/Web Dockerfiles
- Docker Compose stack for web, API, worker, PostgreSQL and Redis
- GitHub Actions CI for Prisma validation, typecheck, tests and builds
- Deployment and release checklist
- Health-check API
- Architecture and phase documentation
- Monorepo scripts

Business features are intentionally added phase-by-phase so the repository remains easy to review and reason about.

## Planned Product Capabilities

- Customer, Support Agent, and Admin roles
- Secure authentication and RBAC
- Ticket creation, assignment, comments, status and priority workflows
- SLA deadlines and breach tracking
- AI ticket classification and summarization
- AI priority suggestions and draft responses
- Background jobs for AI processing and notifications
- Audit logs for important business actions
- Operational dashboards and workload visibility
- API documentation, tests, Docker, CI/CD, and deployment

## Architecture

```text
Browser
   |
   v
Next.js Web App
   |
   | REST API
   v
Express API
   |
   +--------------------+
   |                    |
   v                    v
PostgreSQL            Redis
   |                    |
   |                    v
   |               Background Jobs
   |                    |
   +----------+---------+
              |
              v
        AI Providers
```

More detail: [`docs/architecture.md`](docs/architecture.md)

## Repository Structure

```text
supportpilot/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── types/
├── docs/
│   ├── architecture.md
│   └── phase-0.md
├── .env.example
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```

## Local Development

### Prerequisites

- Node.js 22+
- npm
- Docker Desktop or Docker Engine

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 3. Create local environment file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 4. Start the API

```bash
npm run dev:api
```

API default: `http://localhost:4000`

Health endpoint: `GET /api/v1/health`

### 5. Start the frontend

```bash
npm run dev:web
```

Frontend default: `http://localhost:3000`

## Engineering Principles

- Keep controllers thin and business logic isolated.
- Validate all external input at API boundaries.
- Do not trust client-supplied roles or authorization decisions.
- Persist business-critical state before triggering asynchronous work.
- Make background jobs retry-safe and idempotent.
- Record important changes in audit logs.
- Keep AI recommendations reviewable instead of silently auto-sending them.
- Never commit secrets or production credentials.
- Add tests alongside business-critical behavior.

## Development Roadmap

1. **Phase 0:** Architecture and repository foundation ✅
2. **Phase 1:** PostgreSQL + Prisma data model ✅
3. **Phase 2:** Authentication + RBAC ✅
4. **Phase 3:** Ticket lifecycle + assignment ✅
5. **Phase 4:** Messages + audit logs ✅
6. **Phase 5:** SLA engine ✅
7. **Phase 6:** AI automation ✅
8. **Phase 7:** Background jobs ✅
9. **Phase 8:** Agent/Admin dashboard ✅
10. **Phase 9:** Tests + API documentation ✅ *(execution verification pending)*
11. **Phase 10:** Docker + CI/CD + deployment ✅ *(execution/deployment verification pending)*
12. **Phase 11:** Demo assets + final recruiter documentation

## Author

**Satyam Shukla**  
Full Stack Software Developer

- GitHub: https://github.com/bytebysatyam
- LinkedIn: https://www.linkedin.com/in/satyamshukla10/
- Portfolio: https://satyam-shukla-portfolio-jet.vercel.app/
- Email: shuklasatyam48890@gmail.com
