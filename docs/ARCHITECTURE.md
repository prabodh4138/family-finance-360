# Architecture decisions

## Identity and tenancy
- One registered owner account per household in milestone 1.
- Family members are bookkeeping profiles, not login identities.
- Every household-owned table includes `household_id`.
- All reads and writes must be scoped through the authenticated owner's household.
- Future member login support will introduce household membership and role tables without changing transaction ownership semantics.

## Money correctness
- PostgreSQL `NUMERIC(14,2)` for INR amounts.
- API uses Python `Decimal`; never float for money.
- Use database transactions for multi-row operations.
- Transfers are paired account movements and excluded from income/expense totals.
- Transaction delete is soft-delete with audit event.
- Idempotency key `client_request_id` prevents duplicate offline replay.

## Offline-first approach
- Cache static app shell only in initial milestone.
- Next milestone: IndexedDB outbox, client-generated UUIDs, sync endpoint, idempotency, conflict detection and explicit sync status.
- Do not silently queue financial writes in localStorage.

## Security
- Argon2id password hashing.
- Short-lived JWT access token in this starter; production should move to secure HttpOnly refresh-cookie/session strategy and assess CSRF.
- Rate-limit login and registration at the edge/API.
- Add email verification and password reset before public launch.
- Private receipt storage with signed URLs; never public bucket URLs.
- Add PostgreSQL RLS after role/ownership policy tests are in place.

## Performance
- Pool pre-ping and bounded connection pool.
- Index household + transaction date.
- Paginate transaction list.
- Aggregate summaries in SQL.
- Add query plans and load tests before scaling.

## Planned schema extensions
`budgets`, `savings_goals`, `loans`, `loan_payments`, `recurring_rules`, `recurring_occurrences`, `attachments`, `audit_logs`, `sync_events`.
