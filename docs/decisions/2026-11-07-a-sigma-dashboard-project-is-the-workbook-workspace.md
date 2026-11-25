# A Sigma dashboard's project is the workspace of its workbook

- **Status:** Accepted
- **Revisions:** v1 2026-11-07 (initial) · v2 2026-11-25 (standalone data models)
- **Deciders:** Sigma connector maintainers (PR #37297)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py` (`test_dashboard_project_is_the_workbook_workspace`,
  `test_project_filter_pattern_keeps_or_drops_by_workspace`, `test_workspace_filter_on_standalone_data_models`)
- **Related:** PR #37297, issue #38477, PR #38616

## Context

A dashboard's `project` is what `projectFilterPattern` matches. The Sigma connector set no project, and the shared
filter drops a dashboard without a project whenever the pattern has includes or excludes, so an include pattern
ingested no Sigma workbook at all.

A Sigma workbook carries no workspace name or ID, only a `path` string. The spec gives the format of `path` only for
datasets ("Path describing dataset's ancestor workspace and folders"), and Sigma's doc examples start it with the
workspace and separate the parts with `/`, for example `My Documents/Examples`. Reading the workspace any other way
takes more Sigma calls per workbook.

## Decision

- A Sigma dashboard's project is its workspace: the first `/`-separated segment of the workbook's `path`, for example
  `My Documents` for `My Documents/Examples`. The folders after it are not part of the project.
- A workbook with no `path` has no project. A `projectFilterPattern` with includes or excludes drops it, as it drops
  any dashboard without a project.

## Consequences

- `projectFilterPattern` selects Sigma workbooks by workspace name, and saved ingestion configs and the Sigma
  connector docs depend on it. Changing the project to the full folder path or to a workspace ID changes what every
  saved pattern matches.
- The rule rests on Sigma's doc examples, as the spec does not define the workbook `path` format. A workspace name
  that contains `/` is cut at the first `/`.

## Amendment: standalone data models

In both regular and organization-wide listings, a standalone data model's workspace is the first
`/`-separated segment of its `path` in the `GET /v2/dataModels` response. The connector applies
`projectFilterPattern` to that workspace before reading the model's elements, columns or lineage.

A saved pattern that selects one workspace now limits standalone models as well as workbooks.
If the pattern has any includes or excludes, a model with no path is skipped because its workspace
is unknown. With no includes or excludes, models with missing paths remain eligible for ingestion.
