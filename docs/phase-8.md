# Phase 8 — Agent/Admin Dashboard

## Implemented

- Staff login screen
- Session-aware protected dashboard entry
- Ticket queue backed by the real API
- Search, status, priority, and category filters
- Ticket detail workspace
- Status, priority, and category editing
- Support-agent assignment and unassignment
- SLA cards with met, at-risk, and breached states
- Unified conversation/activity timeline
- Public customer replies
- Staff-only internal notes
- AI analysis actions
- AI analysis history/results
- Responsive desktop/mobile layout
- Sign-out flow

## Backend Support Added

A staff-only support-agent directory endpoint was added:

```text
GET /api/v1/users/support-agents
```

This allows the dashboard assignment control to use real active support agents rather than hard-coded demo data.

## Authentication

The web client uses the access and refresh tokens returned by the existing authentication API.

For this portfolio implementation, the browser session is stored in `sessionStorage`, which keeps the session scoped to the browser tab/session rather than long-term persistent storage.

A hardened production deployment could move refresh-token handling to secure, HTTP-only cookies.

## API Configuration

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## Human-Reviewed AI

The dashboard exposes four AI actions:

- Classify
- Summarize
- Suggest priority
- Draft response

These actions enqueue analyses. Results are displayed for review; they are not automatically applied to the ticket or sent to the customer.

## Responsive Behavior

The workspace adapts from a multi-column desktop operations view to a single-column mobile layout.

## Scope

Phase 8 focuses on the support agent/admin workspace.

A separate customer portal is intentionally not claimed as part of this phase.
