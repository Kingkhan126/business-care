# Implementation status

## Implemented

Organization membership and permissions; commercial sales and purchasing workflows; catalog and warehouse inventory; double-entry journals and accounting periods; financial statements; CSV bank imports, matching, transfers, and reconciliation; expense approval, posting, payment, and attachments.

## Reliability work delivered

Safe nested user responses; dashboard permissions and ledger metrics; reversal-aware historical reports; tenant reference validation; transactional registration; atomic document counters; fail-closed row locks; safe duplicate imports; consistent API errors; bounded pagination; unit and PostgreSQL integration verification; CI checks.

See [reliability.md](reliability.md) for details and remaining limitations.

## Planned

- Forecasting and scenario planning
- A consolidated Reports hub and additional operational/aging reports
- Foreign-exchange conversion and consolidated multi-currency reporting
- Direct connections to bank-feed providers
- Additional browser journey coverage and production operations validation

The legacy Purchases landing page is a placeholder; purchase orders, vendor bills, and vendor payments have dedicated working modules.
