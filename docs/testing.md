# Testing

## Workspace checks

```powershell
npm install
npm run db:generate
npx prisma validate --schema=apps/api/prisma/schema.prisma
npm run typecheck
npm test
npm run build
```

The API uses Node's test runner through tsx. The normal suite covers registration role stripping, password rules and bcrypt byte limits, token expiry/audience/claims, refresh-token generation/hashing, ticket scoping and lifecycle policy, SLA deadlines/completion/closure/reopening, AI structured output and disabled providers, and sanitized JSON errors.

`npm test` discovers the database integration suite but skips it unless explicitly configured. The web workspace's `test` script currently has no Node unit tests; its browser suite runs separately.

## Real PostgreSQL integration suite

Use a dedicated local database named with an `_test` suffix. The suite refuses a non-local host or a differently named database. It creates uniquely named synthetic accounts and removes only its own tickets/accounts afterward. It does not reset the database.

After generating and reviewing the real initial migration, create an empty local test database, then configure this PowerShell session:

```powershell
$env:DATABASE_URL = 'postgresql://supportpilot:supportpilot@localhost:5432/supportpilot_test?schema=public'
npm run db:deploy
$env:SUPPORTPILOT_TEST_DATABASE_URL = $env:DATABASE_URL
npm test --workspace=@supportpilot/api
```

Return to a fresh shell for normal development so test environment overrides do not affect your development API. The database must have the current schema, including the SLA uniqueness constraint. CI uses its disposable PostgreSQL service with schema push; this is separate from migration-deployment verification.

The integration test exercises actual HTTP requests and Prisma operations for:

- public registration with an attempted ADMIN role;
- customer ownership, internal-note privacy, and staff-only endpoints;
- first public response and concurrent duplicate assignment handling;
- unassignment, lifecycle updates, reopening, and fixed SLA deadlines;
- repeated/concurrent SLA breach scans;
- dashboard and staff-directory RBAC;
- disabled AI requests and persisted worker failure state;
- concurrent refresh rotation, revoked refresh rejection, and suspended-account rejection.

Real provider inference and Redis/BullMQ job execution require their services and are not replaced with fake providers in this suite.

## Browser tests

```powershell
npm run test:e2e
```

Playwright runs the app on temporary port 3001, owns its server lifecycle, and uses installed Edge on Windows. Stop other Next dev/build processes first: both use `.next`. To use Chrome, set `PLAYWRIGHT_CHANNEL=chrome` in your shell. On Linux/macOS install Chromium once:

```powershell
npm exec --workspace=@supportpilot/web -- playwright install chromium
```

The suite runs at 1440×960, 1280×800, 820×1180, and 390×844. It checks auth form labels/navigation, protected-route redirects, error/retry rendering, and horizontal overflow. Separate workspace rendering contracts use synthetic API fixtures to check queue metrics, staff detail/internal notes/AI-disabled state, and customer detail without staff controls. These are UI contract tests, not evidence that persistence or authorization works end-to-end.

Screenshots and traces are ignored under `apps/web/test-results`; open retained failure traces with Playwright's `show-trace`. No fixture screenshots are marketed as real application data.

## Current results

See [product verification](product-verification.md). Passing unit, build, and rendering tests do not establish migration, provider, queue, or production-deployment readiness.
