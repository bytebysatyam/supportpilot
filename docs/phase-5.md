# Phase 5 — SLA Engine

## Implemented

- Priority-based SLA policy
- First-response deadlines
- Resolution deadlines
- SLA due events
- First-response met/breached events
- Resolution met/breached events
- At-risk status calculation
- Idempotent breach refresh
- Ticket-level SLA endpoint
- Staff-triggered breach refresh endpoint

## SLA Policy

| Priority | First response | Resolution |
| --- | ---: | ---: |
| LOW | 8 hours | 72 hours |
| MEDIUM | 4 hours | 48 hours |
| HIGH | 1 hour | 24 hours |
| URGENT | 15 minutes | 4 hours |

These are product defaults for this project, not claimed industry standards.

## Flow

When a ticket is created, deadlines are calculated from its priority and stored on the ticket. Initial due events are also written.

The first public staff reply records either a first-response met or breached event.

When a ticket reaches RESOLVED or CLOSED for the first time, the resolution SLA result is recorded.

A breach refresh operation can detect overdue unresolved obligations and create missing breach events without intentionally duplicating an existing event type.

## At-Risk State

The SLA snapshot marks:

- first response at risk within 30 minutes of deadline
- resolution at risk within 60 minutes of deadline

## Endpoints

```text
GET  /api/v1/sla/tickets/:ticketId
POST /api/v1/sla/refresh-breaches
```

Customers may retrieve SLA information only for tickets they own. The breach refresh endpoint is staff-only.

## Deferred

Business-hours calendars, holidays, configurable organization policies, escalations, and recurring background checks are deferred to later phases.
