# Phase 1 — PostgreSQL + Prisma Data Model

## Completed

SupportPilot now has a relational schema for the core support domain.

### Core Models

- `User`
- `Team`
- `TeamMembership`
- `Ticket`
- `TicketMessage`
- `TicketAssignment`
- `AuditLog`
- `AIAnalysis`
- `RefreshToken`
- `SLAEvent`
- `Notification`

## Design Decisions

### Current assignment + assignment history

`Ticket.assignedAgentId` stores the current assignee for fast operational queries.

`TicketAssignment` stores assignment history so reassignment events can be audited later.

### Explicit SLA timestamps

Tickets can store first-response and resolution deadlines directly. `SLAEvent` records important SLA milestones and breaches separately.

### AI output is separated from ticket state

AI analyses live in `AIAnalysis`. Suggested classifications, priorities, summaries, and replies do not silently become authoritative ticket fields.

### Refresh tokens are stored as hashes

The schema stores `tokenHash`, never the raw refresh token. Authentication behavior is implemented in Phase 2.

### Team membership is normalized

`TeamMembership` supports many users per team and keeps the model extensible without embedding arrays in records.

### Audit metadata uses JSON

Audit actions are strongly categorized while `metadata` provides room for structured before/after context without requiring a schema change for every event type.

## Important Invariants

Application/service logic must enforce the following:

- Only support agents/admins may be assigned to tickets.
- Customers may access only tickets they are authorized to view.
- Closed/resolved timestamps must match lifecycle transitions.
- Internal messages must never be exposed to customers.
- AI recommendations are advisory.
- Refresh tokens must expire and support revocation.
- Ticket assignment history must be written when the current assignee changes.

## Database Commands

From the repository root:

```bash
npm install
npm run db:generate --workspace=@supportpilot/api
npm run db:migrate --workspace=@supportpilot/api
```

For local schema exploration:

```bash
npm run db:studio --workspace=@supportpilot/api
```

## Migration Note

The Prisma schema is committed in Phase 1. A real migration should be generated against a running local PostgreSQL instance rather than hand-writing migration SQL without verification.

## Next Phase

Phase 2 introduces:

- password hashing
- registration/login
- access tokens
- refresh-token rotation/revocation
- authentication middleware
- role-based authorization
