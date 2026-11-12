# Data 360 Pipeline authenticates on the org's My Domain only

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_a_generic_login_domain_is_refused_before_any_call` and `test_a_host_salesforce_rejects_as_not_my_domain_gets_a_hint` in `test_data360pipeline_connection.py`
- **Related:** #37631, ADR:2026-11-12-data360-pipeline-lineage-and-run-status-run-in-the-metadata-agent

## Context
Data 360 Pipeline logs in with OAuth client credentials (Consumer Key + Consumer Secret). Salesforce
accepts that flow only on the org's My Domain. `salesforceDomain` defaulted to `login`, as it does
for the Data 360 database connector, and with `login` or `test` simple_salesforce never tries client
credentials: it falls back to a password login whose error says nothing about the domain. Any other
wrong host gets `invalid_grant: request not supported on this domain`. So the default could never
log in, and the error didn't say why.

## Decision
- `salesforceDomain` in `data360PipelineConnection.json` is required and has no default.
- The connection refuses `login` and `test` before any login attempt, raising
  `InvalidDomainException` with a My Domain hint.
- Salesforce's `request not supported on this domain` error is rethrown as
  `InvalidDomainException` with the same hint. Other login errors are left as they are.

## Consequences
A CLI config without `salesforceDomain` now fails validation, instead of failing at login. A stored
service with `login` now fails Test Connection with the hint; it could never log in before either.
Do not restore the `login` default to match the database connector. Revisit only if Salesforce
accepts client credentials on the generic login hosts.
