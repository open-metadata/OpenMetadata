# Glue parameterized script lineage evaluates each inspected run context independently

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** GluePipeline connector maintainers (#37597)
- **Guard:** `test_glue_parameterized_lineage.py` (`TestIssue37597WorkflowRunProperties`, `TestCrossRunCorrelationAndOneSidedEdges`, `TestSafetyAndBoundedResources`)
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
2. **Guessing partial unknowns or unbounded work:** substituting placeholder text when part of a
   template is unknown, falling back to regex on uninterpolated `{var}` templates, or inspecting an
   unbounded history of runs or loop iterations.

## Decision

- `GluepipelineSource` builds up to `MAX_INSPECTED_RUNS = 10` `ParameterContext` instances per job,
  merging job arguments in precedence order `Job.DefaultArguments` < workflow trigger
  `Actions[].Arguments` < `JobRun.Arguments` (with Glue CLI `--flag-name` normalized to both
  `flag-name` and `flag_name`) and workflow run properties in order `Workflow.DefaultRunProperties`
  < `WorkflowRun.WorkflowRunProperties`. When `get_workflow_runs(..., IncludeGraph=True)` includes
  per-node `JobDetails.JobRuns`, each workflow run's properties pair only with job runs started in
  that workflow run; when `glue:GetWorkflowRuns` fails with `ClientError`, ingestion logs at
  `DEBUG` and falls back to `Workflow.LastRun` and defaults.
- The AST evaluator in `snowflake_parser.py` and `script_parser.py` evaluates each
  `ParameterContext` — and each unrolled iteration of a constant-iterable `for` loop (capped at
  `MAX_LOOP_UNROLLS = 32` total slices, `MAX_EXPR_DEPTH = 32`, `MAX_STRING_LENGTH = 4096`) — as an
  isolated execution slice, emitting `(sources, targets)` per slice so lineage pairs only within the
  same run and iteration.
- Any unknown sub-expression inside a string template or concatenation poisons the entire string to
  `UNKNOWN` (emitting no ref rather than a partial name), while unknown Snowflake database/schema
  options with a known table continue to follow
  ADR:2026-10-22-glue-snowflake-refs-with-unknown-schema-link-only-unique-tables. Regex fallbacks
  run only when `ast.parse` fails and skip strings containing template placeholders (`{`, `}`, `%s`,
  `%(`).
- When a slice resolves only targets (`sources == []`) or only sources (`targets == []`),
  `yield_pipeline_lineage_details` emits `Pipeline -> Table` or `Table -> Pipeline` edges with
  `LineageSource.PipelineLineage`, matching the connector's one-sided pipeline lineage convention.
  A slice that declares both sides but resolves only one (unknown or ambiguous ref) is skipped
  instead of degraded to a one-sided edge, and one-sided edges are suppressed for tables already
  linked by a two-sided slice. When fetching job runs or workflow runs fails (e.g. access denied),
  the affected job arguments or run properties are marked opaque, so script-side fallback values
  are not fabricated into lineage; explicitly configured defaults still resolve.

## Consequences

- Multi-market and parameterized Glue workflows emit accurate per-run `Table -> Table`,
  `Pipeline -> Table`, and `Table -> Pipeline` lineage without cross-run false positives.
- Runs older than the 10 most recent inspected runs are not re-evaluated on a single ingestion pass;
  prior lineage edges already persisted in OpenMetadata remain intact, and bounded `LRUCache`s cap
  S3 script downloads, `get_job_runs` calls, Glue connection lookups, and AST parses.
- Dynamic table names computed from external I/O (e.g., querying a control table at runtime or
  arbitrary user-defined functions) remain `UNKNOWN` and produce no lineage rather than a guess.
