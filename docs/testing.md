# Testing Strategy

SupportPilot keeps testing focused on business-critical behavior rather than superficial coverage.

## Current Automated Tests

The API test suite covers:

- registration and login validation
- email normalization
- password-policy validation
- ticket input validation
- pagination boundaries
- SLA deadline calculations
- SLA response breach detection
- SLA response success detection
- SLA at-risk calculation

## Run Locally

Install dependencies and generate the Prisma client first:

```bash
npm install
npm run db:generate --workspace=@supportpilot/api
```

Then run:

```bash
npm test --workspace=@supportpilot/api
```

Type-check all workspaces:

```bash
npm run typecheck
```

Build all workspaces:

```bash
npm run build
```

## Integration-Test Direction

The next level of coverage should use an isolated PostgreSQL test database and Redis instance.

High-value integration scenarios include:

1. customer registration and login
2. customer cannot access another customer's ticket
3. customer cannot create an internal note
4. support agent can update a ticket
5. assignment history closes the previous assignment
6. refresh-token rotation invalidates the previous token
7. first public staff reply satisfies or breaches the SLA
8. repeated SLA scans do not intentionally duplicate the same event
9. AI jobs create a durable pending analysis before queue execution
10. completed AI analysis remains advisory until a human applies it

## Test Data

Do not use production credentials, customer data, company data, or real support records in automated tests.

Use deterministic synthetic fixtures.

## Current Verification Status

The test files are committed as part of Phase 9.

They should be run in a real local/CI environment with dependencies installed and the Prisma client generated. The repository does not claim a passing test run unless that execution has actually occurred.
