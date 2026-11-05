# The incident Assignee filter lists the assignees a terms aggregation over the incident index returns

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Harshit Shah (reviewed by Shailesh Parmar)
- **Guard:** `UserTeamSelectableList.test.tsx` (with `options`, no user/team search is sent);
  `IncidentGroupsFilters.test.tsx` and `IncidentManager.test.tsx` (the aggregation request and
  what reaches the picker)
- **Related:** open-metadata/openmetadata-collate#7693, #36402, #36543

## Context
The Assignee filter of both Incident Managers (AI mode and classic) listed every user and team,
so most picks returned no incidents. Its options must not depend on the page of incidents on
screen. Two approaches failed on the way:
- Passing the assignee ids to the user/team search as a `terms` filter puts every id in the GET
  URL of `/search/query`, and the server caps the request line at 8 KiB. Around 170 ids fail with
  HTTP 414, and since the index keeps every status record, past assignees count too.
- Falling back to the unscoped list above some number of ids brings the noise back for exactly
  the large organisations where it hurts most.

## Decision
- `useIncidentAssignees()` reads the assignees from one `POST /search/aggregate` terms
  aggregation on `testCaseResolutionStatusDetails.assignee.id` over the `testCaseResolutionStatus`
  index. It is scoped to the active domain, takes the latest record per assignee (`top_hits` by
  `timestamp`), drops deleted ones and sorts by display name.
- The request sends `deleted: null`. Incident documents have no top-level `deleted` field, and the
  schema default `deleted: false` adds a term that matches none of them. The aggregation managers
  add that term only when `deleted` is non-null.
- The aggregation reads up to `AGGREGATE_PAGE_SIZE_LARGE` (1000) buckets. A terms aggregation
  cannot page; that cap is accepted.
- The picker (`UserTeamSelectableList`) takes the assignees as `options` and counts, lists and
  searches them on the client. Assignee ids are never sent to the user/team search.
- While the read is pending or after it fails, the picker offers no one, not everyone.

## Consequences
- Large organisations keep a scoped filter, up to 1000 assignees. Past that, the remaining
  assignees cannot be picked; revisit with a composite aggregation in `/search/aggregate`.
- Past assignees (reassigned, or only on resolved incidents) are still offered, because the index
  keeps every status record. Offering only current assignees of open incidents needs an endpoint
  over the SQL incident state table.
- The status, severity and date filters do not narrow the options: they apply to each incident's
  latest record, which an aggregation over the history cannot express.
- Do not replace the `null` with the default or move back to id filters: the first returns no
  assignees, the second fails with HTTP 414 at scale.
