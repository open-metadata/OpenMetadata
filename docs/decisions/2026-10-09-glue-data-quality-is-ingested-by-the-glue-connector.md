# AWS Glue Data Quality results are ingested by the Glue database connector, under the AWSGlue test platform

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Manuel Acosta
- **Guard:** `ingestion/tests/unit/topology/database/test_glue_data_quality.py`; reviewer
- **Related:** `ingestion/src/metadata/ingestion/source/database/glue/data_quality.py`

## Context

AWS Glue Data Quality evaluates DQDL rulesets on Data Catalog tables and in the "Evaluate Data
Quality" node of Glue ETL jobs. Each evaluation produces a result that lists a PASS, FAIL or ERROR
outcome for every rule. OpenMetadata already displays externally evaluated tests (dbt, Great
Expectations) as test cases with results. It has no pipeline type for importing results from
another system, and its `TestPlatform` enum had no value for Glue.

## Decision

1. **Host: the Glue database connector's metadata workflow.** The feature is enabled with
   `GlueConnection.dataQualityConfig.includeDataQuality`. It runs as a root `post_process` step of
   `GlueServiceTopology`, after every table exists. We did not add a new pipeline type: that would
   need changes to the server, `PipelineType` and the UI, and would add nothing over the Glue
   client and credentials the connector already has. If the evaluated tables are catalogued under
   another service (e.g. Athena), `targetServiceName` points the test cases at that service.
2. **Test platform: `AWSGlue`, a new `testPlatform` enum value.** Every test definition this
   feature creates carries it. As with every platform other than `OpenMetadata`, the TestSuite
   runner never executes these tests and the UI shows them read-only.
3. **Mapping:**
   - **Test definitions:** one per DQDL rule type, named `glue<RuleType>`. A column rule applied
     to a whole table gets the suffix `Table`.
   - **Test cases:** one per rule, named `<ruleset>_<RuleType>_<sha1(rule)[:8]>`. The name is keyed
     on the rule text, not on Glue's positional `Rule_N`. `<ruleset>` is the result's
     `RulesetName`, else `<JobName>_<EvaluationContext>` (an ETL job result may carry no ruleset
     name, and a node name is unique only within its job), else whichever of the two is set, with every run of characters outside `A-Za-z0-9_-` replaced by `_`, leading and
     trailing `_` stripped, and `glue` used if nothing is left. When that changes the name, or it
     is longer than 100 characters, it is cut to 100 characters and `_<sha1(name)[:8]>` of the raw
     name is appended, so two rulesets never share a test case history and suite names stay
     within 256 characters.
   - **Ruleset score:** each ruleset also gets a `<ruleset>_score` test case.
   - **Suites:** each ruleset's test cases are grouped in a logical test suite named
     `AWS Glue DQ - <service> - <ruleset>`, both parts normalized as above. Suite names are
     global, so the OpenMetadata service name keeps two accounts' same-named rulesets apart.
   - **Status:** PASS → `Success`, FAIL → `Failed`, ERROR → `Aborted`.
   - **Result timestamp:** the run's `CompletedOn`, else its `StartedOn`.
4. **Scope:** a result on a Glue catalog table is imported only when the pipeline's
   `databaseFilterPattern`, `schemaFilterPattern` and `tableFilterPattern` keep that table, the
   same scope the metadata ingestion and its test connection use
   (ADR:2026-10-27-glue-test-connection-probes-what-ingestion-reads). A result outside that scope
   is reported as filtered, not as a failure. So is a result that names no `CatalogId` on a Glue
   database no ingested catalog holds; when several do, it is reported as ambiguous, not guessed.
   `etlJobMappings` name their table explicitly and are not filtered. `includeTables` and
   `includeViews` are not applied: a result does not say whether its table is a view.
5. **Ordering:** the step starts with a sink flush (`Barrier`), so the tables this run created
   exist before any result resolves them.
6. **Incremental runs:** `lookbackDays` defaults to 7. A run lists the results started within
   `[now - lookbackDays, now]` and posts a run only when its test case holds no stored result
   with the same millisecond timestamp (the result timestamp of point 3) in that window, so
   overlapping ingestions post no duplicates.
7. **Test connection:** `GetDataQualityResults` is an optional (`mandatory: false`) step, named
   the same in the service seed `glue.json` and in the ingestion `DatabaseStep`. It calls
   `glue:ListDataQualityResults` with `MaxResults=1`, and only when `includeDataQuality` is true.

## Consequences

- Renaming a test definition or changing the test case naming scheme orphans the history already
  ingested. Changing either needs a new record.
- Editing a rule's text starts a new test case. Rules left untouched keep their history.
- Results that Glue ETL jobs produce without a catalog table are imported only through
  `etlJobMappings`.
- With `targetServiceName`, a Glue table that matches more than one table of the target service
  (the same schema and table under several databases) is reported and skipped, not attached to
  whichever table the search returns first. `targetDatabaseName` names the database instead, and
  the table is then fetched by its FQN, without a search.
- Glue `Observations` and `AnalyzerResults` are not imported.
