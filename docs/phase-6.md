# Phase 6 — AI Automation

## Implemented

SupportPilot now includes a provider-agnostic AI assistance layer for support agents.

Supported analysis types:

- ticket classification
- ticket summary
- priority suggestion
- draft response

## Human Review First

AI output is advisory.

SupportPilot does not automatically:

- change the ticket category
- change ticket priority
- send a generated reply
- close or resolve a ticket

A human agent remains responsible for reviewing and applying AI suggestions.

## Provider Abstraction

Product code depends on an `AiProvider` interface rather than a specific model vendor.

The first concrete adapter uses a Groq-compatible chat-completions API.

This design allows future adapters to be added without rewriting ticket business logic.

## Structured Output Validation

Every AI task has a strict Zod schema.

Examples include:

- classification category + confidence + rationale
- priority + confidence + rationale
- summary + key points
- draft response + tone

Invalid model output is rejected rather than blindly persisted as a valid recommendation.

## Persistence

Each run creates an `AIAnalysis` record with:

- analysis type
- status
- provider
- model
- input hash
- validated result
- error message when applicable
- timestamps

The input hash provides a stable fingerprint for the ticket context used for that AI run.

## Auditability

Successful analysis creation writes an `AI_ANALYSIS_CREATED` audit event.

The audit log records analysis ID, type, provider, and model.

## Configuration

AI is disabled by default.

```env
AI_PROVIDER=disabled
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

To enable the included adapter:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-secret-key
```

Never commit a real API key.

## Endpoints

```text
POST /api/v1/ai/tickets/:ticketId/analyze
GET  /api/v1/ai/tickets/:ticketId/analyses
```

The analysis endpoint accepts:

```json
{
  "type": "CLASSIFICATION"
}
```

Other supported values:

- `SUMMARY`
- `PRIORITY_SUGGESTION`
- `DRAFT_RESPONSE`

Both endpoints are restricted to support agents and admins.

## Next Step

Phase 7 moves AI processing and SLA checks into background jobs so long-running external calls are decoupled from synchronous HTTP requests.
