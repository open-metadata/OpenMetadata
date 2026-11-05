# MicroStrategy charts are named by dossier, and the dossier search is paged and project-scoped

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_microstrategy.py` (`test_charts_of_different_dossiers_do_not_collide`, `test_search_is_scoped_by_the_project_header_and_paged`, `test_a_failed_project_search_keeps_every_stale_entity`)
- **Related:** ADR:2026-10-30-an-empty-seen-set-deletes-the-scope-only-when-the-connector-confirms-its-listing

## Context
The MicroStrategy connector named a chart `<pageKey><visualizationKey>`, such as `K53W63`. Those
keys are unique only within one dossier: on the MicroStrategy demo server, 14 of the 176 chart names
built that way from 21 dossiers repeated, one of them 6 times. Every dossier sharing a name pointed
at the same chart entity, overwritten by whichever dossier was ingested last.

The quick search (`GET /searches/results`) was sent with a `project_id` query parameter, which the
server ignores. Each project's search returned every dossier the user can read in every project
(1379 rather than 518 for one project on the demo server), so each dossier was ingested once per
project, labelled with the wrong project, and its definition read once per project. The search
also asked for every result in one response (`limit=-1`).

## Decision
- A chart is named `<dossierId>_<pageKey>_<visualizationKey>`. Page and visualization keys contain
  no underscore, so the name is unambiguous and needs no FQN quoting.
- The search is scoped by the `X-MSTR-ProjectID` header and paged 500 results at a time
  (`SEARCH_PAGE_SIZE`). Projects are filtered by `projectFilterPattern` before their dossiers are
  searched.
- Cube SQL and owner email lookups are cached per id in a 512-entry LRU (`CACHE_SIZE`), failures
  included.
- A run that could not list every project's dossiers deletes no stale dashboard, chart or data
  model. A run that could not read a dossier's definition deletes no stale chart or data model.
  `markDeleted*` would otherwise soft-delete what a non-empty seen-set leaves out, and the
  `SourceListing` confirmation only governs an empty one. A dossier whose definition fails is still
  ingested from its listing; one ingested before is left as it was, so its charts stay linked.

## Consequences
- The upgrade renames every MicroStrategy chart. With `markDeletedCharts` on, the first run
  soft-deletes the charts named the old way and creates the new ones; descriptions, tags or lineage
  added by hand to an old chart are not carried over.
- A server that keeps failing to render some definitions keeps stale charts and data models until
  it renders them. Reverting that needs a per-dossier stale scope, which `deleteStale` does not have.
