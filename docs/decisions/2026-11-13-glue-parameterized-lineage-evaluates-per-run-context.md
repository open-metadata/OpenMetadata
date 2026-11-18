# Glue parameterized script lineage evaluates each inspected run context independently

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** GluePipeline connector maintainers (#37597)
- **Guard:** `test_glue_parameterized_lineage.py` (`TestIssue37597WorkflowRunProperties`, `TestCrossRunCorrelationAndOneSidedEdges`, `TestSafetyAndBoundedResources`, `TestResolvedOptionsHonorRequestedOptions`, `TestNonOverridableArgumentsPrecedence`, `TestReviewerRegressions`)
- **Related:** #37597, ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables

## Context

AWS Glue Python scripts routinely construct target and source table names, schemas, databases, and
S3 paths at runtime from `awsglue.utils.getResolvedOptions(sys.argv, ...)` job arguments and
`glue.get_workflow_run_properties(...)["RunProperties"]` workflow run properties, combined via
f-strings, `.format()`, `%` formatting, `+` concatenation, string case/trim/replace helpers, lookup
dicts, or small constant-iterable `for` loops. A single Glue workflow or job is often triggered once
per partition or market (`MARKET=DE`, `MARKET=FR`, ...).

Two failure modes must be avoided when resolving runtime parameters statically:

1. **Cross-run Cartesian pollution:** pooling sources and targets across all runs into one flat set
   for a job would link `RAW_DE -> CONTRACT_FR` alongside `RAW_DE -> CONTRACT_DE`.
2. **Guessing partial unknowns or unbounded work:** substituting placeholder text or another run's
   properties when part of a template or run lookup does not match, falling back to regex on
   uninterpolated `{var}` templates, or inspecting an unbounded history of runs or loop iterations.

## Decision

- `GluepipelineSource` collects a `WorkflowSnapshot` at most once per workflow and passes it with
   inspected job runs to the pure `build_parameter_contexts` builder (`context_builder.py`),
   producing up to `MAX_INSPECTED_RUNS = 10` typed `ParameterContext` instances per job. Job
   arguments merge in precedence order `Job.DefaultArguments` < workflow trigger
   `Actions[].Arguments` < `JobRun.Arguments` < `Job.NonOverridableArguments` (merged last in every
   context, fallbacks included, as Glue gives them highest precedence) and workflow run properties
   merge in order `Workflow.DefaultRunProperties` < `WorkflowRun.WorkflowRunProperties`. When
   `get_workflow_runs(..., IncludeGraph=True)` includes per-node `JobDetails.JobRuns`, each workflow
   run's properties pair only with job runs started in that workflow run; when
   `glue:GetWorkflowRuns` fails with `ClientError`, ingestion logs at `DEBUG` and falls back to
   `Workflow.LastRun` and defaults.
- `script_evaluator.py` owns neutral AST binding resolution, bounded expression evaluation
  (`MAX_EXPR_DEPTH = 32`, `MAX_STRING_LENGTH = 4096`), scalar-preserving loop-slice expansion
  (`MAX_LOOP_UNROLLS = 32`), and distinction between immutable tuples and mutable lists under alias
  mutations. `snowflake_parser.py` and `script_parser.py` consume its public API, and
  `script_parser.py` correlates both intra-slice calls and read/write dependencies split across
  sibling loops into typed `LineageGroup` units (`sources` / `targets`: `Resolved | "absent" | "unresolved"`).
- `getResolvedOptions(sys.argv, [...])` mirrors `awsglue.utils`: the result holds only the requested
  options and Glue's built-in options, keyed by argparse dest (`--flag-name` -> `flag_name`), so
  `args.get("NOT_REQUESTED", "x")` is `"x"`. A requested option missing from the context is
  `UNKNOWN`. When the options list or `sys.argv` cannot be established statically (or `sys.argv` or
  a mutable options list is modified), every option value is `UNKNOWN`.
- `get_workflow_run_properties(Name=..., RunId=...)` resolves only when `Name` and `RunId` match the
  workflow and run identity of the active `ParameterContext`; unmatched or indeterminate lookups
  remain `UNKNOWN`.
- Any unknown sub-expression inside a string template or concatenation poisons the entire string to
  `UNKNOWN`, while unknown Snowflake database/schema options with a known table continue to follow
  ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables. Regex fallbacks
  run only when `ast.parse` fails and skip strings containing template placeholders (`{`, `}`, `%s`,
  `%(`).
- Catalog resolution maps `LineageGroup[ScriptRef]` (and Visual ETL nodes) to
  `LineageGroup[EntityReference]`, and `plan_lineage_edges` enforces one contract: both sides
  `Resolved` emit `Table -> Table` edges; `sources == "absent"` with `Resolved` targets emits
  `Pipeline -> Table` edges; `targets == "absent"` with `Resolved` sources emits `Table -> Pipeline`
  edges; either side `"unresolved"` skips the group; and one-sided edges are suppressed for tables
  already linked by a two-sided group. Failed workflow-run fetches mark run properties opaque so
  script-side `.get()` fallbacks are not fabricated into lineage while explicit defaults still
  resolve.

## Consequences

- Multi-market and parameterized Glue workflows emit accurate per-run `Table -> Table`,
  `Pipeline -> Table`, and `Table -> Pipeline` lineage without cross-run or unmatched-lookup false
  positives, while fetching workflow run history once per workflow.
- Runs older than the 10 most recent inspected runs are not re-evaluated on a single ingestion pass;
  prior lineage edges already persisted in OpenMetadata remain intact, and bounded `LRUCache`s cap
  S3 script downloads, `get_job_runs` calls, Glue connection lookups, entity resolutions, and AST
  parses.
- Dynamic table names computed from external I/O (e.g., querying a control table at runtime or
  arbitrary user-defined functions) remain `UNKNOWN` and produce no lineage rather than a guess.
