# MicroStrategy charts are named by dossier, and the dossier search is paged and project-scoped

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial) · v2 2026-11-12 (configurable Library path)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_microstrategy.py` (`test_charts_of_different_dossiers_do_not_collide`, `test_search_is_scoped_by_the_project_header_and_paged`, `test_a_failed_project_search_keeps_every_stale_entity`, `test_a_custom_library_path_replaces_the_default`, `test_an_empty_library_path_falls_back_to_the_default`, `test_dashboard_url_uses_the_library_path`)
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
- When a dossier's existing dashboard or charts cannot be read from OpenMetadata, its dashboard
  and charts are left as they are and stale charts are not deleted in that run. A chart list
  built without that read would unlink them.
- On the first run after the upgrade, a new chart takes the description, tags, glossary terms,
  owners, domains, data products, custom properties and life cycle of the chart its dossier still
  links under the old name. An old chart shared by several dossiers gives its metadata to each
  of their new charts.
- A chart request names its dashboard once that dashboard exists. A chart update without
  `dashboards` deletes the dashboard → chart relationship server-side. A new dashboard is created
  after its charts and links them itself.
- `username` and `password` are optional in the connection schema. The login sends them only when
  they are set, so the Anonymous login mode (8) works without credentials. The login request times
  out after 10 s to connect and 60 s to read (`LOGIN_TIMEOUT`); every other call keeps the REST
  client's (10, 300).
- A client certificate and key in SSL Config are sent for mutual TLS whatever Verify SSL is set to.
- Cube SQL and owner email lookups are cached per id in a 512-entry LRU (`CACHE_SIZE`), failures
  included.
- A run that could not list every project's dossiers, or dropped a listed object that did not
  parse, deletes no stale dashboard, chart or data model. `markDeleted*` would otherwise
  soft-delete what a non-empty seen-set leaves out, and the `SourceListing` confirmation only
  governs an empty one.
- A dossier whose definition cannot be read is still ingested from its listing. It keeps the charts
  it already has linked, and they count as seen, so stale charts are still deleted. Its data models
  are not linked from the dashboard, so a run with such a dossier deletes no stale data model.

## Consequences
- The upgrade renames every MicroStrategy chart. With `markDeletedCharts` on, the first run
  soft-deletes the charts named the old way, except those linked to a dossier whose definition
  cannot be read. Their user-added metadata moves to the new charts. Followers, votes,
  certification and manually drawn lineage stay on the soft-deleted chart.
- A server that keeps failing to render some definitions keeps stale data models until it renders
  them. Reverting that needs a per-dossier stale scope, which `deleteStale` does not have.

## Amendment: v2 2026-11-12, configurable Library path
The connector appended a hardcoded `MicroStrategyLibrary` to `hostPort`. A Library web app deployed
under another name, or a second Library deployment on the same server, could not be ingested:
putting its path in `hostPort` produced `<path>/MicroStrategyLibrary/api` and a 404.

- `hostPort` is the MicroStrategy server root, with no path.
- `libraryPath` names the Library web app. It defaults to `MicroStrategyLibrary`; surrounding
  whitespace and slashes are stripped, and an empty value falls back to the default
  (`DEFAULT_LIBRARY_PATH`).
- The connector calls `<hostPort>/<libraryPath>/api` for login and every REST call, and builds
  dashboard source URLs as `<hostPort>/<libraryPath>/app/<projectId>/<dossierId>`.
- A login that answers 404 says to check Host Port and Library Path, not the credentials.

A saved connection without `libraryPath` resolves to the URLs it used before, so no migration is
needed. A `hostPort` that still carries a Library path is not rewritten: guessing whether a trailing
path segment is a Library app would misread servers mounted under a path of their own.
