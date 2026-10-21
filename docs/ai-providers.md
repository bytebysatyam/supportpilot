# Gemini and Groq AI providers

## Architecture

The existing flow remains: staff frontend ? authenticated API ? PostgreSQL AIAnalysis PENDING ? BullMQ supportpilot-ai queue ? Redis ? background worker ? selected provider ? Zod validation ? persisted AIAnalysis result/audit ? frontend polling. Nothing sends replies or changes classification/priority automatically. Customers cannot invoke staff AI endpoints. Internal notes are excluded from provider prompts.

The factory selects one provider centrally. AI_PROVIDER=gemini selects Gemini; groq selects Groq; disabled keeps the existing graceful disabled behavior. There is no provider fallback. Groq retains its endpoint, JSON mode and existing model default. The shared run(type, context) contract supports classification, summary, priority suggestion and reply draft.

## Model verified on 2026-10-21

Default: gemini-3.5-flash-lite. Google's current [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) lists it as stable with text output and structured-output support. The [pricing page](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite) lists free input/output for the free tier. The [deprecation page](https://ai.google.dev/gemini-api/docs/deprecations) lists no announced shutdown date and recommends this generation for new projects. It fits short support-ticket extraction, summaries and reviewed drafts at low latency. This is documentation verification, not proof that a particular API key/project has quota or model access.

GEMINI_MODEL remains configurable. An absent/blank value uses the verified default. Do not include models/ or a URL in its value. Provider access, quotas and models can change; recheck the official pages before changing deployments. Google documents that free-tier content can be used to improve products; review provider data terms before sending actual customer information. Use synthetic tickets for the initial demo.

## Safe local setup

Keep root .env private and gitignored. Existing local values and AI_PROVIDER=disabled were preserved. Empty Gemini key/model configuration was added only where missing; no credential was invented.

To intentionally enable Gemini, edit privately:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=<your private Gemini Developer API key>
GEMINI_MODEL=gemini-3.5-flash-lite
```

For Groq instead:

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=<your private Groq key>
GROQ_MODEL=llama-3.3-70b-versatile
```

Only the selected provider's key is required. AI*PROVIDER=disabled requires neither key. No AI key belongs in NEXT_PUBLIC*\* or Vercel frontend variables. API keys are passed in authorization headers, never Gemini URL query parameters. No SDK dependency was added; Gemini uses Node fetch against the official [generateContent REST endpoint](https://ai.google.dev/api/generate-content), JSON mode and a 30-second provider timeout. Zod remains authoritative even if model output is valid JSON.

## Render: current API and worker together

Keep the existing repository-root build command:

```sh
npm ci --include=dev && npm run db:generate --workspace=@supportpilot/api && npm run db:deploy --workspace=@supportpilot/api && npm run build --workspace=@supportpilot/api
```

Set the service start command to:

```sh
npm run start:combined --workspace=@supportpilot/api
```

The launcher runs API and worker as separate children of one supervisor with the same inherited Render environment. Both import the same validated server configuration. API and worker keep their independent commands for local development, Docker, and a future separate Render worker. Do not run a duplicate standalone worker accidentally. Unexpected child exit stops its sibling and exits nonzero so Render can restart the service. Termination signals are forwarded; shutdown has a bounded 60-second deadline. Configure an appropriate Render shutdown grace period so active jobs can finish.

Add these variables privately to the SAME Render Web Service:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=<secret>
GEMINI_MODEL=gemini-3.5-flash-lite
```

Optional Groq variables can coexist but do not enable fallback:

```dotenv
GROQ_API_KEY=<optional private Groq key>
GROQ_MODEL=llama-3.3-70b-versatile
```

Keep existing NODE_ENV=production, WEB_ORIGIN, DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET and other backend settings. No cloud variables or start commands were changed automatically. AI_PROVIDER is read at process startup; redeploy/restart after changing it.

## Failure and retry behavior

The queue name and payload IDs/types remain unchanged. BullMQ attempts each job up to three times with exponential backoff starting at two seconds. No retry path switches provider. While retries remain, the analysis stays PENDING with a safe failure code so browser polling continues; the final failed attempt records FAILED and completedAt. A successful attempt records provider/model/result and an audit event transactionally.

Provider HTTP failures map to safe codes for authentication, model unavailability, rate limiting, timeouts, invalid requests, and temporary outages. Empty/malformed/blocked/truncated output is rejected; strict Zod field/enum checks reject invalid structured output. A single JSON object wrapped in fences or harmless prose is tolerated, while ambiguous multiple objects are rejected. Raw provider bodies, exception messages and validation payloads are never exposed as analysis errors; old stored error strings are sanitized on read too.

The input hash includes provider/model, preventing a completed Groq result from being reused for a new Gemini request. Pending analyses store the selected provider/model. If worker settings differ when processing, the job fails with a safe configuration-changed code instead of silently executing through a different provider. Drain pending work before changing provider/model, restart both processes, and request a fresh analysis afterward.

## Exact live test

1. Review and deploy the source, real migrations and Render variables manually. Confirm the combined start command above and verify API health.
2. Confirm PostgreSQL and Redis connectivity. Redis must use noeviction; provider suitability and queue reliability are not proven by a startup log.
3. Sign in as an existing SUPPORT_AGENT or ADMIN. Staff roles must be provisioned deliberately; public registration creates customers.
4. Open a synthetic ticket containing no customer secrets. Click AI Summarize once.
5. In worker logs, confirm activity for supportpilot-ai without printing keys or raw provider payloads. Poll GET /api/v1/ai/tickets/<ticketId>/analyses with an authorized staff session; never paste bearer tokens into chat.
6. Confirm the row becomes COMPLETED with provider=gemini, configured model, nonempty validated summary/keyPoints and completedAt. Check the corresponding AI_ANALYSIS_CREATED audit event. PENDING alone does not prove the worker consumed the job.
7. Test classification and priority suggestions; verify only supported categories/priorities render. Apply only after human review.
8. Test Draft reply. Clicking Use in reply editor must populate the editor without sending a message. Review/edit, then explicitly Send reply if appropriate for the synthetic ticket.
9. Confirm rate-limit/provider errors produce readable FAILED messages after retries, without raw keys or provider responses. Do not deliberately break real production credentials to test this; automated tests use HTTP doubles.
10. To use Groq, switch AI_PROVIDER=groq with its private key, restart both processes and request a new analysis. Existing completed Gemini rows remain valid history.

## Verification scope

Automated tests mock all Gemini/Groq HTTP calls. Unit coverage includes response parsing, each structured feature, invalid enums/fields, blocked/truncated/empty output, HTTP failures, transport timeouts, invalid keys, explicit selection, disabled behavior and environment requirements. The guarded PostgreSQL integration suite additionally checks retry state and Gemini completion/audit persistence with external HTTP mocked, but needs a local \*\_test database. UI contracts check structured results, failures/retry states and drafts remaining unsent.

No local Gemini key was present at audit time. Local PostgreSQL and Redis were unavailable, so a real queued Gemini inference and persisted result could not be verified. No real Gemini request was made. Test/build success is not a production-readiness claim. Existing dependency advisories and Redis/provider availability still require review.

## Files changed

| Files                                                                           | Purpose                                                                                        |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| apps/api/src/ai/gemini.provider.ts                                              | Gemini REST integration and response envelope parsing.                                         |
| apps/api/src/ai/groq.provider.ts                                                | Preserve Groq with shared parsing/prompts and safe errors.                                     |
| apps/api/src/ai/provider.ts, provider.factory.ts, provider.config.ts            | Provider contract, explicit selection and configurable defaults.                               |
| apps/api/src/ai/ai.prompts.ts, structured-json.ts, provider.errors.ts           | Shared prompts, wrapped JSON parsing and safe error codes.                                     |
| apps/api/src/ai/ai.service.ts                                                   | Provider/model-aware deduplication, pending metadata and sanitized history.                    |
| apps/api/src/ai/ai.worker.service.ts, apps/api/src/workers/worker.ts            | Validated results, retry-aware persistence and configuration mismatch protection.              |
| apps/api/src/config/env.schema.ts                                               | Gemini variables, conditional keys and model defaults.                                         |
| apps/api/src/config/env.schema.test.ts, apps/api/src/ai/gemini.provider.test.ts | Selected-key validation, both provider contracts and provider failure tests.                   |
| apps/api/src/integration/flows.test.ts                                          | Guarded real-database Gemini retry/completion coverage with mocked external HTTP.              |
| apps/api/src/start.ts, apps/api/package.json, package.json                      | Optional combined API/worker start command; no new dependency.                                 |
| apps/web/src/lib/ai-errors.ts, apps/web/src/components/ai/ai-panel.tsx          | Safe provider failure/retry messages; human-reviewed result rendering preserved.               |
| apps/web/tests/workspace.spec.ts                                                | UI contracts for structured results and unsent reply drafts.                                   |
| .env (ignored), .env.example                                                    | Blank server-only key and verified model configuration; disabled selection retained.           |
| docker-compose.prod.yml                                                         | Forward Gemini variables to both processes.                                                    |
| README.md, docs/deployment.md, docs/ai-providers.md                             | Model sources, local/Render setup, combined topology, exact live test and verification limits. |

The three pre-existing registration-error files (auth-form.tsx, web lib/api.ts and ui.spec.ts) remain uncommitted and preserved. No secret or generated frontend artifact was staged or committed.

## Results from this implementation

- npm ci: PASS; existing lockfile retained, no new dependency.
- npm run db:generate: PASS, real Prisma client generated.
- npm run typecheck: PASS across workspaces.
- npm test: PASS, 52 passed, one local PostgreSQL integration test skipped.
- npm run build: PASS for API/worker/launcher, web and shared types.
- Focused Playwright UI contracts: PASS, eight checks across desktop/laptop/tablet/mobile.
- npm run start:combined: both real processes started with AI disabled; local API health returned 200. Verification processes were stopped afterward.
- Local PostgreSQL/Redis ports 5432/6379: ECONNREFUSED. No real queued AI job or database completion is claimed.
- Real Gemini inference: NOT VERIFIED; no local key configured and no real provider request made.
- Security scan: 135 source files and 32 frontend JS bundles checked; no known private credential, key pattern, or server-only secret variable name found in browser bundles. Both private dotenv files remain ignored.
- Existing npm audit report: three high package entries in the Prisma/deepmerge-ts chain; no forced major upgrade.
- No commit, push, cloud environment update or deployment performed.
