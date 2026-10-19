# Migrations mark ingestion pipelines for redeploy; the server redeploys them

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `PipelineBotRedeploySchedulerTest`, `IngestionPipelineBotRedeployMigrationIT`
- **Related:** #34788

## Context

What a deployed ingestion pipeline does on its scheduled runs is fixed when it is deployed: the
pipeline service (Airflow, Kubernetes) keeps the configuration it was handed, including the token
the runs authenticate with. An upgrade that changes that configuration for pipelines already
deployed only takes effect once they are deployed again. AutoPilot deploying its agents as
ingestion-bot is the first such case (#34788).

A migration cannot do that redeploy. In the Docker quickstart the ingestion container starts after
the server, which starts after the migrations, so the pipeline service is not reachable while they
run. Even when it is, its plugin may still be the previous release's, whose version check the
server rejects.

## Decision

A migration that needs pipelines redeployed writes a marker row for each of them in
`entity_extension` (extension `pipelineBotRedeploy.pending`) and makes no call to the pipeline
service. `PipelineBotRedeployScheduler`, which every server runs, redeploys the marked pipelines
once the pipeline service reports healthy, and clears a marker only after its deploy succeeds or
its pipeline is gone. It scans one minute after startup and every five minutes after that, and
stops once no marker is left. Two servers may deploy the same pipeline at once; a deploy writes the
same definition either time.

## Consequences

An upgrade completes whether or not the pipeline service is up, and the redeploy happens without
anyone redeploying pipelines by hand. Until the scan reaches a pipeline, its runs keep the old
configuration. A pipeline whose deploy keeps failing stays marked and is retried, with a warning,
every five minutes on every server. A later migration needing the same kind of redeploy adds its
pipelines to the same marker rather than calling the pipeline service.
