# A runner name belongs to the deployed pipeline that holds it

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** @ulixius9
- **Guard:** `IngestionPipelineRepositoryTest` (`*Namesake*`, `runnerNames*`), `EntityRepositorySecretStorageTest.sameNamedPipelinesOfDifferentServicesKeepTheirOwnVaultEntries`
- **Related:** `PipelineServiceClientInterface.addressesPipelinesByName`

## Context
An ingestion pipeline's name is unique only within its service (its FQN is `<service>.<name>`), but
the Airflow and Kubernetes runners know a pipeline by its name alone: the Airflow `dag_id` and DAG
files, the Kubernetes CronJob, ConfigMap, Secret and Job names. Two pipelines that share a name in
different services therefore reach the same runner object: deploying one overwrites the other's DAG,
and triggering, pausing, killing or hard-deleting one acts on the other, while the server keeps
showing the other pipeline as enabled and deployed. With an external secrets manager, pipeline
credentials were keyed by the bare name too, so the pipeline saved last overwrote the other's.

Making names unique across services was rejected: externally run workflows and per-service agents
(Collate's `reverse_metadata`) register the same name under many services by design. Deriving the
runner name from the pipeline id was deferred: it renames every deployed DAG and needs a redeploy
plus cleanup of the old DAGs, with the server and the Airflow plugin upgraded together.

## Decision
- When the runner reports `addressesPipelinesByName()` (Airflow and Kubernetes), the server refuses
  with 400 a deploy, run, toggle or kill of a pipeline whose name maps onto the same runner name as
  another **deployed** pipeline, soft-deleted ones included, and its hard delete skips the runner
  call. The first pipeline deployed under a runner name keeps it.
- Runner names are compared coarser than any runner derives them: case, runs of non-alphanumeric
  characters and edge punctuation are ignored, in both replace-then-lower-case and
  lower-case-then-replace order.
- Runners that tell pipelines apart by more than the name (Argo: runs carry generated names and
  lookups use name plus service labels) keep the default `false` and are not guarded.
- An external secrets manager keys pipeline credentials by the pipeline id, not its name.

## Consequences
- Never-deployed namesakes, the external-workflow case, keep working.
- Two pipelines already deployed under one runner name, which were overwriting each other, are both
  refused until one is deleted; pipeline names cannot change, so it is recreated under another
  name. The error names the other pipeline. Deleting one skips the runner delete and redeploys the
  survivor, since the shared runner object may still hold the deleted pipeline's config.
- A per-service agent under a fixed name (Collate's `reverse_metadata`) already shared one runner
  object on a name-addressed runner; its deploy for a second service is now refused instead of
  overwriting the first. It is unaffected on Argo, which keeps the default.
- Whichever of two same-named pipelines is deployed first keeps the runner name; the other's deploy
  is refused, and the error names the pipeline that holds it.
- Kubernetes cuts names at 53 characters; names that differ only past that still collide there.
- Each guarded call reads the name and FQN of every deployed pipeline; `deployed` lives in the JSON,
  so it is a table scan. Measured at 20,000 pipelines (5,000 deployed): about 30 ms on MySQL 8 and
  155 ms on Postgres 15, against a runner deploy that waits seconds for the DAG to parse. If it
  shows up, index a stored runner-name column and match on it exactly.
- Credentials stored under the old name-based secret id keep their reference until they are entered
  again; the old vault entries are not removed.
- Revisit by deriving runner names from the pipeline id, which would make this guard unnecessary.
