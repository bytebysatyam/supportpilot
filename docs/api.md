# SupportPilot API Reference

Base path:

```text
/api/v1
```

Authentication uses a Bearer access token:

```http
Authorization: Bearer <access-token>
```

## Authentication

### Register customer

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "name": "Example User",
  "email": "user@example.com",
  "password": "StrongPass123"
}
```

Public registration always creates a `CUSTOMER`.

### Login

```http
POST /auth/login
```

```json
{
  "email": "agent@example.com",
  "password": "StrongPass123"
}
```

Returns:

- user
- accessToken
- refreshToken

### Refresh access token

```http
POST /auth/refresh
```

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

A successful refresh rotates the refresh token.

### Logout

```http
POST /auth/logout
```

```json
{
  "refreshToken": "<opaque-refresh-token>"
}
```

### Current user

```http
GET /auth/me
```

Requires authentication.

---

## Tickets

### Create ticket

```http
POST /tickets
```

Customer only.

```json
{
  "subject": "Unable to access billing page",
  "description": "The billing page returns an error after sign in."
}
```

### List tickets

```http
GET /tickets?page=1&limit=20&status=OPEN&priority=HIGH&category=TECHNICAL&search=billing
```

Supported filters:

- `page`
- `limit` (maximum 100)
- `status`
- `priority`
- `category`
- `search`
- `assignedAgentId` — staff only
- `customerId` — staff only

Customers are always server-scoped to their own tickets.

### Ticket detail

```http
GET /tickets/:ticketId
```

### Update ticket

```http
PATCH /tickets/:ticketId
```

Staff only.

```json
{
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "category": "TECHNICAL"
}
```

At least one field must be supplied.

### Assign or unassign agent

```http
PUT /tickets/:ticketId/assignment
```

Assign:

```json
{
  "agentId": "<support-agent-id>"
}
```

Unassign:

```json
{
  "agentId": null
}
```

### Assignment history

```http
GET /tickets/:ticketId/assignments
```

Staff only.

---

## Ticket Messages

### Add reply or internal note

```http
POST /tickets/:ticketId/messages
```

Public reply:

```json
{
  "body": "We are checking the issue.",
  "isInternal": false
}
```

Internal staff note:

```json
{
  "body": "Reproduce on staging before replying.",
  "isInternal": true
}
```

Customers cannot create or read internal notes.

### List messages

```http
GET /tickets/:ticketId/messages
```

### Ticket timeline

```http
GET /tickets/:ticketId/timeline
```

The timeline is staff-only. Customers receive only public messages from the messages endpoint; internal audit details are never returned to customer accounts.

---

## SLA

### Ticket SLA snapshot

```http
GET /sla/tickets/:ticketId
```

Returns first-response and resolution state including:

- due date
- met
- breached
- at risk
- persisted SLA events (staff only)

Customers may access SLA information only for tickets they own.

### Refresh overdue SLA events

```http
POST /sla/refresh-breaches
```

Staff only.

The SLA worker performs periodic scans in normal operation. Deadlines remain fixed at creation, including after priority changes or reopening.

---

## AI Assistance

AI routes are staff only.

### Queue analysis

```http
POST /ai/tickets/:ticketId/analyze
```

```json
{
  "type": "SUMMARY"
}
```

Supported types:

- `CLASSIFICATION`
- `SUMMARY`
- `PRIORITY_SUGGESTION`
- `DRAFT_RESPONSE`

Response status is `202 Accepted` because processing occurs asynchronously.

Equivalent pending/completed analyses may be deduplicated using the ticket-context input hash.

### List analyses

```http
GET /ai/tickets/:ticketId/analyses
```

AI results are advisory and are never automatically applied or sent.

---

## Users

### Active support agents

```http
GET /users/support-agents
```

Staff only.

Used by the dashboard assignment control.

---

## Health

```http
GET /health
```

---

## Common Error Shape

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

Typical HTTP statuses:

| Status | Meaning |
| --- | --- |
| 200 | Successful read/update |
| 201 | Resource created |
| 202 | Async work accepted |
| 204 | Successful request with no response body |
| 400 | Validation failure |
| 401 | Missing/invalid authentication |
| 403 | Authenticated but unauthorized |
| 404 | Resource not found or not visible to caller |
| 409 | State transition/conflict |
| 503 | Required asynchronous/provider infrastructure unavailable |

## Security Notes

- Never accept a client-supplied role during public registration.
- Never trust frontend role checks as authorization.
- Raw passwords and raw refresh tokens are not stored.
- Customers are server-scoped to their own ticket resources.
- Internal notes are filtered server-side.
- AI suggestions require human review.

## Operations endpoints

- `GET /dashboard/summary`: staff-only, database-wide active queue counts (open, unassigned, urgent, overdue, at risk, assigned to current agent), with an as-of timestamp.
- `GET /dashboard/staff`: ADMIN only, staff name/email/role/status plus active assignment counts. Password and refresh-token data are excluded.
- `GET /ai/capabilities`: staff-only provider availability; never returns provider credentials.

Disabled AI requests return 503 `AI_PROVIDER_DISABLED` before persisting or enqueueing. Provider/queue execution errors are recorded on analyses; they are not returned as synchronous inference errors. Only a human-approved ticket PATCH or message POST applies an AI recommendation.

Unknown failures return sanitized JSON with a request ID (also available in the `x-request-id` header). Database outages return 503. Bad JSON and Zod validation failures return 400.
