# Testing

## Workspace checks

```powershell
npm ci
npm run db:generate
npm exec --workspace=@supportpilot/api -- prisma validate
npm run typecheck
npm test
npm run build
```

The API uses Node's test runner through tsx. The normal suite covers registration role stripping, password rules and bcrypt byte limits, token expiry/audience/claims, refresh-token generation/hashing, ticket scoping and lifecycle policy, SLA deadlines/completion/closure/reopening, AI structured output and disabled providers, and sanitized JSON errors.

`npm test` discovers the database integration suite but skips it unless explicitly configured. The web workspace's `test` script currently has no Node unit tests; its browser suite runs separately.

## Real PostgreSQL integration suite

Use a dedicated local database named with an `_test` suffix. The suite refuses a non-local host or a differently named database. It creates uniquely named synthetic accounts and removes only its own tickets/accounts afterward. It does not reset the database.

The real initial migration is checked in. Create an empty local test database, then configure this PowerShell session:

```powershell
$env:DATABASE_URL = 'postgresql://supportpilot:supportpilot@localhost:5432/supportpilot_test?schema=public'
npm run db:deploy
$env:SUPPORTPILOT_TEST_DATABASE_URL = $env:DATABASE_URL
npm test --workspace=@supportpilot/api
```

Return to a fresh shell for normal development so test environment overrides do not affect your development API. The database must have the current schema, including the SLA uniqueness constraint. CI deploys the checked-in migrations to its disposable PostgreSQL service.

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

Run `npm run build` first. Playwright runs the standalone production server on temporary port 3001, owns its server lifecycle, and uses installed Edge on Windows. Development output lives separately in `.next-dev`; production builds and browser tests must run sequentially because both use `.next`. To use Chrome, set `PLAYWRIGHT_CHANNEL=chrome` in your shell. On Linux/macOS install Chromium once:

```powershell
npm exec --workspace=@supportpilot/web -- playwright install chromium
```

The suite runs at 1440×960, 1280×800, 820×1180, and 390×844. It checks auth form labels/navigation, protected-route redirects, error/retry rendering, and horizontal overflow. Separate workspace rendering contracts use synthetic API fixtures to check queue metrics, staff detail/internal notes/AI-disabled state, and customer detail without staff controls. These are UI contract tests, not evidence that persistence or authorization works end-to-end.

Screenshots and traces are ignored under `apps/web/test-results`; open retained failure traces with Playwright's `show-trace`. No fixture screenshots are marketed as real application data.

## Current results

See [current environment verification](environment-verification.md). Passing unit, build, and rendering tests do not establish provider, queue, or production-deployment readiness.

## Real development browser/API flow

Start real local PostgreSQL/Redis, deploy migrations, seed demo accounts, and run the API and web development servers in separate terminals. This explicitly enabled suite creates synthetic development accounts/tickets and preserves them for inspection. It must not be pointed at a live customer database. No API responses are mocked. Traces/videos are disabled for these tests so session credentials are not retained in trace artifacts.

```powershell
$env:SUPPORTPILOT_LIVE_E2E = '1'
$env:SUPPORTPILOT_E2E_BASE_URL = 'http://localhost:3000'
npm run test:e2e --workspace=@supportpilot/web -- --project=desktop --grep 'live:'
Remove-Item Env:SUPPORTPILOT_LIVE_E2E
Remove-Item Env:SUPPORTPILOT_E2E_BASE_URL
```

The base-URL override reuses the explicitly started development frontend and skips the standalone-server preparation. Use port 3000 to match the local API's CORS allowlist. The normal fixture suite remains separate. Neither the fixture suite nor the live suite establishes real AI inference or Redis/BullMQ job completion; those require available services and separate job verification.
