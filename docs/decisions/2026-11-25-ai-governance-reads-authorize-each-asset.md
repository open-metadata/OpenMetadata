# AI governance reads authorize each asset and audit reports retain their requester

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** AIGovernanceVisibilityIT, AIGovernanceAssetReaderTest, AuditReportAccessTest, AuditReportSearchVisibilityTest
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36761

## Context

Type-level ViewAll permits an estate listing to begin, but cannot decide a domain,
owner, or tag policy against an individual asset. Aggregating that listing or embedding
it in an audit artifact must not make otherwise forbidden metadata readable.

## Decision

Dashboard, activity, violations, framework coverage, and audit-pack assembly use the
canonical per-asset ViewAll check before aggregating or serializing assets. The shared
reader loads authorization attributes with each page and uses ViewPermissionFilter,
including its on-demand bulk tag hydration. Pages contain at most 500 assets, matching
the existing activity, violations, and audit-pack walkers. A result limit counts permitted
assets; a page of denied assets does not exhaust it.
The dashboard consumes a page visitor so full governance metadata is released after
each page rather than retained for the entire estate alongside its rollup snapshots.

Audit reports record an immutable requestedBy user reference. Workers resolve that
user by id and evaluate their current permissions, including after restart. Missing or
deleted requesters never fall back to the administrator that updates job state.
Request signatures use the requester id rather than mutable updatedBy provenance.

Saved artifacts represent the requester's scope. Only that requester or an administrator
may access the report; ordinary report policies still apply. Report listings always
perform this row check. Legacy reports without a requester are administrator-only and
cannot be regenerated automatically; submit a new report to establish its requester.
Both search engines apply the same requester restriction before computing hits, counts,
or aggregations, independently of the optional search-policy setting. Searches with no
resolved caller exclude audit reports, including legacy indexed copies.

## Consequences

SQL domain filtering alone would not enforce custom deny rules. Per-asset checks preserve
those rules without a second authorization engine, while batching avoids reloading each
asset solely for authorization. Report ownership prevents users from downloading a broader
requester's pack through a domain-less report. It deliberately limits report sharing;
broader sharing needs an explicit access model for the saved artifact.
