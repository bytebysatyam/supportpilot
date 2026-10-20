# Phase 3 — Ticket Lifecycle + Assignment

## Implemented

- Customer ticket creation
- Role-scoped ticket listing
- Ticket detail retrieval
- Staff-only status, priority, and category updates
- Explicit lifecycle transition rules
- Agent assignment, reassignment, and unassignment
- Assignment history
- Search and filters
- Pagination

## Visibility Rules

### Customers

Customers can:

- create tickets for themselves
- list only their own tickets
- view only their own ticket details

Customer-supplied IDs are never used to decide ticket ownership.

### Support Agents and Admins

Support agents and admins can:

- list tickets across the support workspace
- filter by customer or assigned agent
- view ticket details
- update status, priority, and category
- assign, reassign, or unassign active support agents
- inspect assignment history

## Ticket Lifecycle

Allowed status transitions:

```text
OPEN
├── IN_PROGRESS
└── CLOSED

IN_PROGRESS
├── OPEN
├── WAITING_ON_CUSTOMER
└── RESOLVED

WAITING_ON_CUSTOMER
├── IN_PROGRESS
└── RESOLVED

RESOLVED
├── IN_PROGRESS
└── CLOSED

CLOSED
└── no transitions
```

Lifecycle timestamps are maintained when tickets are resolved or closed.

## Filtering

Staff can filter by:

- status
- priority
- category
- assigned agent
- customer
- free-text search

Customers may use the common status/priority/category/search filters, but ownership remains server-scoped to their authenticated user ID.

## Pagination

Ticket lists use page/limit pagination with a maximum page size of 100.

## Assignment Integrity

An assignee must:

- exist
- have the `SUPPORT_AGENT` role
- have `ACTIVE` status

When a ticket is reassigned, the previous open assignment-history entry is closed with `unassignedAt` and a new assignment record is created.

## Intentionally Deferred

Phase 4 will add:

- ticket messages/replies
- internal staff notes
- audit-log events for lifecycle and assignment changes
- message visibility rules
