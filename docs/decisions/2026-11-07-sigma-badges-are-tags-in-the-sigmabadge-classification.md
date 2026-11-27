# Sigma certification badges are tags in the SigmaBadge classification

- **Status:** Accepted
- **Revisions:** v1 2026-11-07 (initial)
- **Deciders:** Sigma connector maintainers (PR #37299)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py` (`test_workbook_badge_becomes_a_sigma_badge_tag`,
  `test_workbook_without_a_readable_badge_is_ingested_without_tags`, `test_badge_is_not_read_when_tags_are_off`)
- **Related:** PR #37299

## Context

Sigma sets a certification badge on a workbook; Sigma's badge guide names Endorsed, Warning and Deprecated. The
workbook response does not carry the badge. Only the `/files` operations return it, as `badge` (a string or null, with
no enum), and the spec says a workbook's ID is its file ID ("with the `workbookId` as the `inodeId`"). OpenMetadata
dashboards have a `certification` field, but the dashboard create request does not carry it.

## Decision

- When `includeTags` is on, each workbook's badge is read from `GET /v2/files/{workbookId}`, one call per workbook.
  With `includeTags` off, no badge is read.
- The badge text, as Sigma returns it, becomes a tag in the `SigmaBadge` classification, for example
  `SigmaBadge.Endorsed`, and is added to the workbook's dashboard.
- A workbook without a badge, or whose `/files` read fails, is ingested without the tag. A failed read is logged as a
  warning.
- The classification name `SigmaBadge` is stable.

## Consequences

- Glossary terms, policies, searches and certification setups can be built on the `SigmaBadge.<badge>` tags. Renaming
  the classification leaves the tags already applied under the old name.
- A badge cleared in Sigma leaves its `SigmaBadge` tag on the dashboard, and a changed badge may leave both tags.
  Removing only stale `SigmaBadge` tags, while keeping the tags users added, needs a patch after the dashboard.
- A run with `includeTags` on makes one more Sigma call per workbook.
- Badges on Sigma Data Models are not read.
