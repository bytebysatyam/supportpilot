# Phase 2 — Authentication + RBAC

## Implemented

- Customer registration
- Login with email/password
- bcrypt password hashing
- Short-lived JWT access tokens
- Opaque random refresh tokens
- SHA-256 refresh-token hashes stored in PostgreSQL
- Refresh-token rotation
- Refresh-token revocation on logout
- Current-user endpoint
- Bearer-token authentication middleware
- Reusable role-based authorization middleware
- Account-status checks
- Zod request validation

## Security Decisions

### Public registration always creates CUSTOMER users

The registration request does not accept a role field. This prevents clients from self-promoting to SUPPORT_AGENT or ADMIN.

### Passwords are never stored directly

Passwords are hashed with bcrypt before persistence.

### Refresh tokens are opaque and hashed

The raw refresh token is returned only to the client. PostgreSQL stores only its SHA-256 hash.

### Refresh tokens rotate

A successful refresh revokes the previous token and creates a new token. Reuse of the old token therefore fails.

### Access tokens are short-lived

JWT access tokens are designed to be short-lived and are validated for issuer and audience.

### RBAC is server-side

The `authorize(...roles)` middleware can protect future routes. Client-side UI checks are never treated as authorization.

## Endpoints

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Example Protected Route

```ts
router.get(
  "/admin-only",
  authenticate,
  authorize("ADMIN"),
  handler,
);
```

## Intentionally Deferred

- password reset
- email verification
- admin invitation workflow
- brute-force/rate-limit controls
- browser cookie strategy
- multi-device session management UI

These can be added once the main ticket workflow exists.
