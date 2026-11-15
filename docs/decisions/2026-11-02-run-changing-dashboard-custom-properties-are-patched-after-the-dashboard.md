# Dashboard custom properties that change every run are patched after the dashboard, behind a default-off flag

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Hex connector maintainers (review of the Hex components, run history and app views PR)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_hex_components_runs_usage.py`
  (`test_app_views_last_run_and_last_refresh`, `test_property_of_another_type_is_left_alone`,
  `test_nothing_without_the_flag`)
- **Related:** ADR:2026-10-16-a-force-sync-merges-connector-supplied-custom-properties

## Context

A connector can set values that change on every run, such as a Hex project's last run status or app
view counts, as dashboard custom properties. Sent in the dashboard's create request, they stop
updating after the first run: a bot PUT keeps the stored extension unless `overrideMetadata` is on.
Custom property definitions are global to an entity type, so registering one adds it to every
dashboard in the instance, whatever its service.

## Decision

- Values that change from run to run are set by the dashboard topology's `yield_dashboard_extension`
  stage, after the dashboard exists, as a `PatchRequest` with `override_metadata=True`. Its new
  extension is the stored one with the connector's keys replaced, so the patch adds or replaces only
  those keys and never removes one; properties users set are kept.
- A key left out of the patch keeps its stored value, so a value that can't be known on a run (no
  run read, no successful run yet) is omitted rather than cleared.
- The connector registers its definitions once per run. A name already defined with another type
  is left alone and its value not sent: retyping it would invalidate the value every dashboard holds.
- All of it is behind the dashboard pipeline's `includeCustomProperties`, default `false`, because
  the definitions apply to every dashboard in the instance.

## Consequences

- Run state stays current without `overrideMetadata`, which would also overwrite user-curated
  descriptions, tags and owners.
- A property dropped by the connector lingers on dashboards until someone removes it.
- Each opted-in dashboard costs one extra read and one patch per run.
- Hex's names are `appViewsLast7Days`, `appViewsAllTime` (integer), `lastRunStatus` (string),
  `lastRunElapsedSeconds` (integer) and `lastRefreshed` (timestamp, the end of the last successful
  run). Renaming or retyping one orphans the values stored under the old definition.
