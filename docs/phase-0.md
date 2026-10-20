# Phase 0 — Foundation

## Completed

- Defined the product scope.
- Established a workspace-based monorepo.
- Added Next.js/TypeScript frontend.
- Added Express/TypeScript API.
- Added shared ticket/user domain types.
- Added API health endpoint.
- Added runtime environment validation.
- Added PostgreSQL and Redis development services through Docker Compose.
- Added root development/build/typecheck scripts.
- Added architecture documentation.
- Added a secret-free environment template.

## Intentionally Deferred

- Prisma schema and migrations
- authentication and refresh-token handling
- RBAC middleware
- ticket persistence
- audit logging
- SLA calculations
- AI provider integration
- background queue workers
- dashboard data
- production CI/CD

## Phase 1 Entry Criteria

Phase 1 begins by defining the relational data model and invariants before ticket controllers are added.
