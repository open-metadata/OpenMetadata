# dbt Cloud artifacts from several jobs are merged per environment, and reading all jobs is opt-in

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** ulixius9
- **Guard:** `ingestion/tests/unit/test_dbt_config_errors.py::TestDbtCloudMultipleJobs`
- **Related:** #22769

## Context
The dbt Cloud artifact source (`dbtConfigType: cloud`) read one run: the given job's latest, or,
with no job ID, the latest completed run of any job. Projects that split their models across jobs
could ingest only one of them. Every job's `manifest.json` lists the whole project, but dbt only
sets `compiled_code` on the nodes that run compiled, and only a job running `docs generate` has a
catalog. Feeding the jobs to the source one after another lets a partial job overwrite every
model's data model written by a full one, with no SQL and no catalog columns.

## Decision
- `dbtCloudJobId` takes comma-separated job IDs. It stays a string so stored pipelines need no
  migration.
- `dbtCloudIngestAllJobs` (default `false`) lists every job of the project, or of the account when
  no project is set, and skips `job_type == "ci"` jobs, which build into temporary PR schemas. Job
  IDs take precedence over it. With neither set, the single latest run is read, as before.
- When more than one job is read, the latest completed run of each job is fetched and the
  artifacts are merged into one set per dbt Cloud `environment_id`. The newest run's manifest
  decides which nodes exist and how they are configured, so a model removed since an older run
  does not come back; an older run only fills in the compiled fields of nodes the newest run did
  not compile. Catalog entries are unioned, newest run first. The `run_results` files are
  concatenated (the source keeps the newest result per test).
- Environments are never merged: they build into different schemas. A job can still override its
  environment's dbt version; when two jobs of one environment wrote different manifest schema
  versions, the run fails naming both jobs, since one manifest schema cannot validate the other's
  nodes and processing them apart would bring back the overwrite above.
- Only a job with no completed run is skipped. Auth errors and failures listing runs fail the
  run at once. Any other failure on a job (an exhausted retry, a missing manifest, mismatched
  manifest versions) leaves that job's whole environment un-ingested, since merging without the
  job's artifacts would overwrite the models only it compiled with no SQL; the other environments
  are still ingested, and the run is then failed naming the skipped environments. An abandoned
  job whose last run died before compiling is common, and must not block the rest of the account. When merging, the catalog and `run_results`
  are fetched with `get_raw`, so only a 404 reads as "absent"; `get` returns `None` for a request
  that ran out of retries too. 429 is retried, since an all-jobs scan makes one runs call per job.
- The latest runs are listed first, then one environment's artifacts are downloaded, merged and
  yielded at a time, so memory holds one merged manifest rather than one per environment.

## Consequences
The project's models are processed once per environment rather than once per job. Keeping the
single-run default means existing pipelines behave the same; making all-jobs the default would
need a release note. If dbt Cloud starts serving one merged manifest per environment, the merge
can go.
