# The Looker bulk parser scopes view refinements to each model's include graph and falls back to project-wide path order

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Christopher Zerafa
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_looker_bulk_parser_refinements.py`
- **Related:** ADR:2026-10-17-looker-refinements-apply-project-wide-in-path-order; issue #38745

## Context
ADR:2026-10-17-looker-refinements-apply-project-wide-in-path-order applied every LookML view
refinement (`view: +orders { ... }`) across the repository in file path order because
`BulkLkmlParser` did not resolve model `include:` graphs. In multi-model Looker projects where two
models include different refinement files for the same base view (or only one model includes a
refinement), project-wide merging leaked fields, descriptions, tags, and `extends` targets across
models and let whichever refinement came last alphabetically overwrite the other model's view.

## Decision
- `BulkLkmlParser.find_view(view_name, model_name=...)` accepts an optional `model_name`, and
  `LookerSource` passes `explore.model_name` when resolving explore and joined views.
- When `<model_name>.model.lkml` (or `.model.lookml`) is present in the parsed repository,
  `BulkLkmlParser` expands that model's transitive `include:` graph (supporting project-root `/...`,
  file-relative, and imported-project `//project/...` patterns with `*` and `**` globs) in
  cycle-safe depth-first post-order (included files before the file that includes them, and matched
  files per pattern in sorted path order) and applies only the refinements reachable from that model.
- When `model_name` is omitted or no matching `*.model.lkml` file exists in the parsed readers,
  `find_view` falls back to the project-wide path-ordered refinement cache from
  ADR:2026-10-17-looker-refinements-apply-project-wide-in-path-order.
- When resolving `extends` lineage for a view in a model, `LookerSource` prefers the same model's
  `<model>_<parent>_view` data model over the bare view-name cache entry so multi-model projects do
  not link a model's child view to another model's parent view.

## Consequences
Each model's `DashboardDataModel` (`<model>_<view>_view`) reflects only the base view and refinements
included by that model, including explicit `//project/...` includes from imported projects. Callers
or tests without `.model.lkml` files retain the project-wide fallback behavior.
