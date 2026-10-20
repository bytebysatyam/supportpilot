# Deployment Guide

SupportPilot is designed as three independently runnable application processes:

1. Web — Next.js
2. API — Express
3. Worker — BullMQ background processing

It also requires PostgreSQL and Redis.

## Environment

Required production values:

```env
NODE_ENV=production
WEB_ORIGIN=https://your-web-domain.example
NEXT_PUBLIC_API_URL=https://your-api-domain.example/api/v1

DATABASE_URL=postgresql://...
REDIS_URL=redis://...

JWT_ACCESS_SECRET=<strong-random-secret>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
SLA_SCAN_INTERVAL_MS=300000

AI_PROVIDER=disabled
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

Enable Groq only when a valid key has been configured.

Never commit production secrets.

## Docker

A production-oriented Compose file is included:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Before first application traffic, deploy Prisma migrations:

```bash
docker compose -f docker-compose.prod.yml run --rm api \
  npm run db:deploy --workspace=@supportpilot/api
```

The Compose deployment includes:

- PostgreSQL
- Redis
- API
- background worker
- web application
- dependency health checks
- persistent database and Redis volumes

## Independent Cloud Deployment

The components may also be deployed independently.

### Web

Deploy `apps/web` as a Node/Next.js application.

Build:

```bash
npm install
npm run build --workspace=@supportpilot/web
```

Start:

```bash
npm run start --workspace=@supportpilot/web
```

Set `NEXT_PUBLIC_API_URL` before the web build because public Next.js variables are embedded in the client bundle.

### API

Build:

```bash
npm install
npm run db:generate --workspace=@supportpilot/api
npm run build --workspace=@supportpilot/api
```

Start:

```bash
npm run start --workspace=@supportpilot/api
```

Health check:

```text
GET /api/v1/health
```

### Worker

Use the same API build/image and start:

```bash
npm run start:worker --workspace=@supportpilot/api
```

The worker requires both `DATABASE_URL` and `REDIS_URL`.

## Database Migration Rule

Production should use:

```bash
npm run db:deploy --workspace=@supportpilot/api
```

Do not run `prisma migrate dev` against production.

The repository currently contains the Prisma schema, but a verified initial migration must be generated and committed from a real PostgreSQL development environment before claiming production deployment readiness.

## CI

`.github/workflows/ci.yml` verifies pull requests and pushes to `main`.

The workflow performs:

- dependency installation
- Prisma client generation
- Prisma schema validation
- TypeScript type checking
- automated tests
- production builds

PostgreSQL and Redis service containers are available during CI.

## Release Checklist

Before a real production release:

- CI is green
- Prisma migration exists and has been tested
- strong secrets are configured outside Git
- production database backups are enabled
- Redis persistence/managed Redis policy is understood
- CORS `WEB_ORIGIN` matches the deployed frontend
- `NEXT_PUBLIC_API_URL` points to the public API
- API health endpoint passes
- worker logs show successful Redis/PostgreSQL connections
- AI remains disabled unless its provider credential is configured
- no production/customer data is committed to Git

## Current Status

Docker and CI/CD configuration are implemented in the repository.

A successful container build, green CI run, migration execution, and live cloud deployment must still be verified before the project is described as deployed.
