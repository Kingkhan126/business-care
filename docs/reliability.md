# Reliability changes — 16 October 2026

## Security and access

Business records select public user fields explicitly; expense claimant and membership responses exclude password hashes. Dashboard services check each domain permission before fetching data. Navigation and dashboard actions reflect the signed-in user's permissions. Tenant reference validation runs inside sales and purchasing creation transactions, including product, service, source-document, and source-party checks.

Middleware loads an Edge-compatible signing configuration and returns JSON 401 responses for unauthenticated API requests. Production signing secrets require at least 32 characters. Invalid request bodies, schema errors, duplicates, and transaction conflicts have consistent safe responses. Framework rendering signals are rethrown. Pagination is bounded to 200 records.

## Accounting and operations

Reports include both POSTED and REVERSED originals, alongside their posted reversing entries, using entry dates for historical reporting. This preserves the original in earlier periods and nets the reversal in its own period. Inactive accounts retain their financial history. Dashboard profit and expenses come from ledger lines, exclude draft/unposted documents, and respect the organization currency. The monthly chart uses UTC month boundaries, matching database date-only accounting entries.

DocumentSequence allocates numbers atomically in the same transaction as document and audit writes. It handles existing imported numbers, concurrent requests, deletion gaps, and rollback. Bank imports use skipDuplicates and an account lock so duplicate statement submissions cannot double-count balances. Import audit entries use the same transaction. Lock errors propagate instead of allowing a workflow to continue without its lock. Registration creates the user, organization, membership, and audit event atomically, and resolves only the system Owner role.

## Migration and rollout

Migration `202610160001_reliable_document_numbers` adds a counter table without altering business documents. Counters initialize lazily from existing numbers. Roll out all writers together after applying this migration.

The baseline migration's leading UTF-8 BOM was removed because PostgreSQL rejected fresh installations. Its SQL operations are otherwise unchanged. Existing installations keep their applied migration records; do not reset their database or mark the baseline unapplied. Test the deployment against a backup or staging database as part of release operations.

## Verification

Run `npm run check` and `npm run test:integration` with a dedicated TEST_DATABASE_URL ending in `_test`. Integration tests use real PostgreSQL and verify tenant isolation, concurrent numbering and payments, journal reversal history, inactive account history, concurrent expense approval, safe claimant data, audit-failure rollback, atomic registration rollback, bank import deduplication, and reconciliation locking. CI repeats the checks with PostgreSQL 16.

The local integration suite was exercised with PostgreSQL 18. This is regression coverage for the changed workflows, not a complete accounting certification, penetration test, or production operations audit.

## Remaining product limits

Forecasting and the general Reports hub remain planned. No automatic foreign-exchange conversion, direct bank-provider connection, or full browser regression suite is included. Storage permissions, backups/restoration, production monitoring, capacity, and provider configuration require environment-specific release validation. Financial totals depend on business documents being posted to the ledger.
