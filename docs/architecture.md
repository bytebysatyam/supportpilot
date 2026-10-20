# SupportPilot Architecture

## Goal

SupportPilot is structured as a production-style modular monorepo rather than a single-file CRUD application.

The architecture is designed to make authorization, business workflows, background processing, AI integrations, persistence, observability, testing, and deployment easy to reason about.

## Components

### Web Application
The Next.js application handles customer ticket creation, support-agent workflows, admin dashboards, forms, and authenticated navigation. Authorization is still enforced by the API.

### API
The Express API owns authentication, authorization, ticket workflows, SLA rules, business validation, audit logging, job creation, and persistence orchestration.

### PostgreSQL
PostgreSQL stores users, teams, tickets, messages, assignments, refresh tokens, AI analyses, SLA events, notifications, and audit logs.

### Redis
Redis is reserved for asynchronous processing such as AI classification, summarization, notifications, and SLA checks. Background jobs should be retry-safe and idempotent.

### AI Provider Layer
AI integrations should sit behind a service interface so product logic is not coupled to one model vendor. AI output remains advisory and reviewable by human agents.

## API Versioning

All product endpoints live under `/api/v1`.

## Planned Request Flow

```text
Client Request
    ↓
Validation
    ↓
Authentication
    ↓
Authorization
    ↓
Controller
    ↓
Domain Service
    ↓
Repository / Prisma
    ↓
PostgreSQL
```

For asynchronous work:

```text
Domain Service
    ↓
Persist primary business state
    ↓
Create background job
    ↓
Redis Queue
    ↓
Worker
    ↓
AI / Notification provider
    ↓
Persist result
```

Primary ticket operations must not depend on an AI provider being available.
