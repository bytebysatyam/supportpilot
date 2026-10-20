# Phase 4 — Messages + Audit Logs

## Implemented

- Public ticket replies
- Staff-only internal notes
- Customer-safe message visibility
- First staff response timestamp
- Audit logging for ticket creation
- Audit logging for status, priority, and category changes
- Audit logging for assignment, reassignment, and unassignment
- Audit logging for ticket messages
- Unified ticket timeline

## Message Visibility

Customers can:

- add public replies to their own tickets
- read public replies on their own tickets
- never create internal notes
- never read internal notes

Support agents and admins can:

- add public replies
- add internal notes
- read both public and internal ticket messages

## First Response Tracking

The first non-internal staff reply records `Ticket.firstRespondedAt`.

Internal notes do not count as a customer-facing first response.

## Audit Events

Important state changes now write audit records inside the same database transaction as the business operation.

Tracked actions include:

- `TICKET_CREATED`
- `STATUS_CHANGED`
- `PRIORITY_CHANGED`
- `CATEGORY_CHANGED`
- `ASSIGNED`
- `UNASSIGNED`
- `MESSAGE_ADDED`

Audit metadata stores structured context such as previous/new values and relevant entity IDs.

## Timeline Visibility

Staff timeline:
- public replies
- internal notes
- all ticket audit events

Customer timeline:
- public replies
- ticket creation
- status changes

This prevents internal workflow details and internal-note metadata from leaking to customers.

## Endpoints

```text
POST /api/v1/tickets/:ticketId/messages
GET  /api/v1/tickets/:ticketId/messages
GET  /api/v1/tickets/:ticketId/timeline
```

## Transaction Principle

The application records audit events in the same transaction as the underlying state change whenever practical. This avoids reporting a state transition that never actually committed.
