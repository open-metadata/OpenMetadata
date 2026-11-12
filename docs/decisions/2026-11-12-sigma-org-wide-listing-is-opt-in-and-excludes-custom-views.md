# Sigma's org-wide listing is opt-in per connection and always excludes custom views

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Sigma connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py`
  (`test_skip_permission_check_lists_the_documents_the_credential_cannot_open`,
  `test_by_default_the_listings_send_no_scope_parameter`)
- **Related:** `sigmaConnection.json` `skipPermissionCheck`; PowerBI `useAdminApis`
  (`powerBIConnection.json`); ADR:2026-10-16-oracle-global-temporary-tables-are-opt-in-and-ingested-as-local

## Context

Sigma's `GET /v2/workbooks` returns "any workbooks in your My Documents folder and any workbooks you have access
to", and "API client credentials are associated with a specific organization member … the API response only returns
data accessible to the authenticated user". A connector that lists with no parameter therefore ingests only the
documents shared with the credentials' owner, and a workbook nobody shared with that user never appears. Sigma's
answer is a listing parameter: `skipPermissionCheck` — "Only available to Sigma admins. Return all workbooks,
including custom views, regardless of whether the user has access" — with `excludeExplorations` to drop the custom
views ("When used with `skipPermissionCheck`, excludes custom views from the results, otherwise ignored"), and the
same `skipPermissionCheck` on `GET /v2/dataModels`.

Two things are not documented: what Sigma answers when a non-admin credential sends the parameter (credentials can
belong to a non-admin: "Users with the **Create API keys** permission can only create and manage their own
credentials"), and whether the per-workbook reads succeed for a workbook the user cannot open. Sending the
parameter for everyone would change what every existing Sigma service ingests on upgrade, on unproven runtime
behaviour.

## Decision

- `SigmaConnection.skipPermissionCheck` (boolean, default `false`) opts a connection into the org-wide listing.
  The field keeps Sigma's parameter name, because that is the term a user finds in Sigma's reference and audit
  logs; the description, not the name, carries the Admin requirement. Sigma has one API with an admin-only
  parameter, not a separate admin API, so PowerBI's `useAdminApis` name was not copied.
- When it is `true`, the workbook listing sends `skipPermissionCheck=true&excludeExplorations=true` and the data
  model listing sends `skipPermissionCheck=true`, on every page. Custom views are private, per-user views of a
  published workbook and are never ingested, so the two parameters are never sent apart.
- When it is `false`, every request is the one the connector sent before the field existed.
- The parameters go only on the two listings. The connection test's `GetWorkbooks` step uses the same workbook
  listing call, so it exercises the parameter when the field is on. No other call changes: `isArchived` is not sent,
  and reports are not ingested.

## Consequences

- Existing services ingest exactly what they did before. Turning the field on adds entities; turning it off again
  leaves the ones no longer listed to `markDeleted*`, like any document the source stops listing.
- A workbook listed only through the parameter but whose details read fails is skipped by the dashboard stage; one
  whose pages read fails is created without charts or data models. Both are the connector's existing behaviour for
  a failed read and are stated in the connector help, pending a live check.
- Whether a non-admin credential gets an error or an unchanged listing is unverified; the test-connection step
  surfaces an error if Sigma returns one.
