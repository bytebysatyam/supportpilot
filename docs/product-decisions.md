# Product and implementation decisions

## Authorization and browser sessions

Public registration ignores unknown fields and hard-codes CUSTOMER at persistence. Staff access must be provisioned separately. Each protected request verifies the signed token, then fetches the current active account and role. Suspension and role changes therefore affect existing access tokens immediately. Customers are scoped by authenticated user id, never by an arbitrary customer filter.

Passwords use bcrypt at cost 12. Registration rejects inputs exceeding bcrypt's 72-byte limit rather than silently truncating them. Refresh tokens contain 48 random bytes, are stored as SHA-256 hashes, expire, and rotate through a conditional revocation update in a transaction. Concurrent rotation can consume an existing token only once. Registration creates its user and initial session together.

The browser keeps tokens in sessionStorage for this version. The API client shares a single refresh request between concurrent requests, retries an expired access token once, and prevents a late refresh response from signing a user back in after logout. Network failures preserve a retryable session. sessionStorage is accessible to JavaScript and does not defend against token theft through XSS. An HTTP-only cookie migration needs a deliberate cross-origin and CSRF design and is deferred.

## Ticket history and visibility

Ticket updates, assignment changes, and first-response writes lock the ticket row while applying their transaction. This protects current ownership and assignment history from concurrent edits and ensures only the first public staff response records the first-response timestamp. Adding any message updates ticket activity time. Customers cannot write internal notes or access staff timeline/assignment endpoints; their SLA response contains only the relevant snapshot, without event metadata.

Messages render as text, including AI drafts. There is no HTML rendering of user/provider content. Unknown API failures return a sanitized JSON error and a request ID; structured request logs omit request bodies, headers, credentials, and raw database/provider errors.

## SLA policy

| Priority at creation | First response | Resolution |
| -------------------- | -------------- | ---------- |
| LOW                  | 8 hours        | 72 hours   |
| MEDIUM               | 4 hours        | 48 hours   |
| HIGH                 | 1 hour         | 24 hours   |
| URGENT               | 15 minutes     | 4 hours    |

Customer-created requests start with MEDIUM priority. Persisted deadlines are authoritative. Later priority changes affect triage, not the original promise; they are audited and never silently move a deadline.

Only a public staff reply satisfies the first-response target. Internal notes and customer messages do not. Late completion remains breached. Resolution/closure records its actual completion time. Reopening clears the current resolution timestamp and resumes against the original deadline; the ticket does not receive a fresh SLA allowance. Closed tickets are terminal. Closing without a public reply stops the response clock at closure and does not falsely claim the response target was met.

SLA events are lifetime facts, with one row per ticket and event type. A met event from an earlier resolution remains historical if a reopened ticket later breaches its original resolution target; the current snapshot is computed from current state, not inferred from historical event existence. The unique database constraint plus `createMany(skipDuplicates)` prevents duplicate scans from producing duplicate events or audit entries. The scanner locks and re-reads a candidate before recording a breach.

## AI and queues

AI is advisory. The UI applies category/priority through the ordinary ticket update API only after a click. A generated draft goes into the reply editor, preserves existing drafts behind an explicit replacement confirmation, and is sent only by the agent's Send action. Provider responses are validated with the schema for the requested analysis type.

The API checks provider availability, persists PENDING state, then enqueues. Equivalent pending/completed input hashes are checked while holding the ticket lock. Redis enqueue failures leave a durable FAILED analysis; retries of execution move through PENDING and end in COMPLETED/FAILED. Completion and its audit event commit together, with duplicate completion guarded. Provider calls time out after 30 seconds. Only public conversation is sent to the current provider implementation.

API queue connections fail bounded requests when Redis is down; workers use the retry policy required by BullMQ and their own connection lifecycle. Queue jobs retain exponential backoff and bounded completed/failed history. Shutdown waits for in-flight jobs before disconnecting shared resources. An outbox-based recovery process for crashes between database persistence and enqueue is future work; PENDING jobs should be operationally monitored.

## Metrics and reserved features

Operations metrics are SQL counts over the full active queue (OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER), not the visible page. Overdue counts are unique active tickets with either pending target past due. At-risk counts exclude overdue tickets and use 30-minute response / 60-minute resolution warning windows. Admin workload counts use the same active statuses.

The Notification model is retained as reserved schema. No delivery mechanism or notification UI is claimed. No metric, testimonial, or customer activity is fabricated in application code. UI tests use explicitly labeled synthetic fixtures, separate from application runtime.

## Migration policy

No initial migration has been fabricated. A real PostgreSQL instance is needed to generate and verify it. Existing databases must be inspected and baselined as appropriate; never reset them just to satisfy setup. Existing duplicate SLA rows must be reviewed before applying the new uniqueness constraint. CI schema push is limited to its disposable test database and is not evidence that production migration deployment works.
