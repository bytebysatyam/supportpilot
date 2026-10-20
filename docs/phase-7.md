# Phase 7 — Background Jobs

## Implemented

- Redis-backed BullMQ queues
- Dedicated AI worker
- Dedicated SLA worker
- Async AI analysis execution
- Automatic retry with exponential backoff
- Queue-level job IDs for duplicate suppression
- Periodic SLA breach scans
- Worker concurrency controls
- Graceful worker shutdown
- Separate API and worker process scripts

## Queues

SupportPilot uses two queues:

- `supportpilot-ai`
- `supportpilot-sla`

The API process enqueues work. The worker process executes it.

## AI Jobs

An AI request now creates the database analysis record first, then enqueues processing.

This means:

1. the request has a durable analysis ID
2. the external AI call does not block the HTTP request
3. retries can occur independently
4. completed/failed state is visible from the database

Each AI job uses the analysis ID as its queue job ID.

## SLA Jobs

The worker schedules SLA breach scans at the configured interval.

```env
SLA_SCAN_INTERVAL_MS=300000
```

The default is five minutes.

The underlying SLA event creation remains idempotent, so repeated scans do not intentionally duplicate the same event type.

## Retry Policy

AI jobs:

- 3 attempts
- exponential backoff starting at 2 seconds

SLA jobs:

- 3 attempts
- exponential backoff starting at 5 seconds

## Process Separation

Development:

```bash
npm run dev:api
npm run dev:worker
```

Production:

```bash
npm run start --workspace=@supportpilot/api
npm run start:worker --workspace=@supportpilot/api
```

The API and worker can be deployed/scaled independently.

## Graceful Shutdown

The worker listens for SIGINT/SIGTERM and closes:

- AI worker
- SLA worker
- Prisma connection
- Redis connection

before exiting.

## Reliability Principle

Business state is persisted before asynchronous work is enqueued.

AI suggestions remain advisory even when produced asynchronously.
