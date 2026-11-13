# MicroStrategy charts are named by dossier, and the dossier search is paged and project-scoped

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial) · v2 2026-11-12 (configurable Library path) · v3 2026-11-12 (charts renamed by a server migration) · v4 2026-11-13 (2.0 backport renames charts in 2.0.9)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_microstrategy.py` (`test_charts_of_different_dossiers_do_not_collide`, `test_search_is_scoped_by_the_project_header_and_paged`, `test_a_failed_project_search_keeps_every_stale_entity`, `test_a_custom_library_path_replaces_the_default`, `test_an_empty_library_path_falls_back_to_the_default`, `test_dashboard_url_uses_the_library_path`); `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/MicroStrategyChartRenameMigrationIT.java`
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
- A chart is named `<dossierId>_<pageKey><visualizationKey>`: the old name with the dossier id as
  a prefix, so a migration can build it from what is stored. Page and visualization keys contain
  no underscore, so the name is unambiguous and needs no FQN quoting.
- The search is scoped by the `X-MSTR-ProjectID` header and paged 500 results at a time
  (`SEARCH_PAGE_SIZE`). Projects are filtered by `projectFilterPattern` before their dossiers are
  searched.
- When a dossier's existing dashboard or charts cannot be read from OpenMetadata, its dashboard
  and charts are left as they are and stale charts are not deleted in that run. A chart list
  built without that read would unlink them.
- A server migration (`MicroStrategyChartRename`) renames the charts already ingested: 2.0.9 on
  the 2.0 line and 2.1.0 on 2.1, so every upgrade to either, from 1.x or 2.0.x, runs it. Every release since the connector was added
  (1.6) named a dashboard by its dossier id and a chart `<pageKey><visualizationKey>`, so each chart
  a dashboard links becomes `<dashboardName>_<oldName>` in place and keeps its id, tags, owners,
  followers and threads. A chart the old names made shared by several dashboards is renamed for
  the one whose id sorts first and copied, with its user-added metadata, for each of the others.
  Copying it in the connector instead would keep one-off migration code in every run.
- The migration reads charts through the repository, so it runs in a version whose code matches
  the schema: 2.0.9 on the 2.0 line, and on 2.1 after the 2.1.0 conversation and custom property
  migrations. A chart already named after its dashboard is skipped, so a 2.0.9 install upgraded
  to 2.1 renames nothing twice.
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
- The upgrade renames every MicroStrategy chart, and the first ingestion run finds them under
  their new names. A copy made for a shared chart has a new id, so its followers are copied but its
  votes, threads and manually drawn lineage stay on the renamed original. A chart linked to no
  dashboard keeps its old name and is soft-deleted as stale.
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
- A login that answers 404 says to check the Host and Port and the Library Path, not the credentials.

A saved connection without `libraryPath` resolves to the URLs it used before, so no migration is
needed. A `hostPort` that still carries a Library path is not rewritten: guessing whether a trailing
path segment is a Library app would misread servers mounted under a path of their own.

## Amendment: v4 2026-11-13, the 2.0 backport renames charts in 2.0.9
v3 said a 2.0 backport would register the chart rename in 2.0.8. 2.0.8 was released before the
rename merged, so the backport adds it as a new 2.0.9 migration; on 2.1 it stays in 2.1.0. The
Decision section says so.
