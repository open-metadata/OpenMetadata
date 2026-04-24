# Tableau Pipeline Connector

Ingests Tableau Prep flows as OpenMetadata Pipelines. Captures the flow DAG,
run history for observability, and full step-level lineage — including
upstream database tables, cross-flow dependencies, and published datasource
outputs — via the Tableau Metadata API.

## Capability matrix

| Capability | Status | Notes |
|------------|--------|-------|
| Pipeline metadata (flow → Pipeline) | Yes | Name, description, display name, source URL |
| Task DAG (node-level) | Yes | Input tasks per upstream table, processing task, output tasks per `FlowOutputStep`, wired via `downstreamTasks` |
| Pipeline status (per flow run) | Yes | Bounded by `numberOfStatus` per flow; millisecond-precision timestamps |
| Per-task status | Yes (flow-level) | Every task in a flow run receives the same status — Tableau reports status at flow granularity, not per step |
| Owner extraction | Yes | Resolves `flow.owner_id` → Tableau user email → OpenMetadata user |
| Tag extraction | Yes | Emits a `TableauTags` classification and attaches tags to the pipeline |
| Upstream lineage (table → pipeline) | Yes | From `Flow.upstreamTables` via GraphQL Metadata API |
| Column-level lineage | Yes | From `Flow.outputFields.upstreamColumns` |
| Custom SQL input parsing | Yes | Parses `referencedByQueries` on upstream tables to extract real source tables |
| Downstream flow lineage (pipeline → pipeline) | Yes | Cross-flow chains via `Flow.downstreamFlows` |
| Downstream datasource lineage (pipeline → DashboardDataModel) | Yes | Published datasource outputs via `Flow.downstreamDatasources` |
| Schedule metadata | No | Planned |
| Domain from Tableau project hierarchy | No | Planned |

## Requirements

- **Tableau Server** or **Tableau Cloud** with authenticated access.
- **Metadata API enabled** for lineage extraction. The connector degrades
  gracefully without it — metadata and status still ingest, but no lineage
  edges are produced. See
  [Start the Metadata API](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html).
- A user with permission to list flows, flow runs, and (for lineage) query
  the Metadata API.

## Connection configuration

Key fields on `TableauPipelineConnection`:

| Field | Purpose |
|-------|---------|
| `hostPort` | Tableau Server URL |
| `authType` | `BasicAuth` (username/password) or `AccessTokenAuth` (PAT name + secret) |
| `siteName` | Tableau site (empty for default) |
| `apiVersion` | Optional REST API version override |
| `verifySSL` + `sslConfig` | TLS validation mode and CA/cert/key when `verifySSL=validate` |
| `pipelineFilterPattern` | Include/exclude regex for flows |
| `numberOfStatus` | Most recent runs kept per flow (default 10) |

## Lineage resolution

Upstream tables resolve in this order:

1. For each `dbServiceName` in `lineageInformation.dbServiceNames`, build
   `{service}.{database}.{schema}.{table}` FQN and look up directly.
2. Fallback to `search_in_any_service` across every database service.
3. For upstream tables backed by custom SQL, parse the SQL (ANSI dialect)
   and resolve each source table via steps 1–2.

Downstream datamodel edges require the dashboard Tableau connector to
have ingested the published datasources first.

Cross-flow lineage resolves by looking up the downstream flow in the
same pipeline service. If a downstream flow has not been ingested yet,
the edge is skipped — it will resolve on a subsequent ingestion.

## Known limitations

- **Tableau REST `/flows/runs` is site-scoped.** TSC's `RequestOptions.Field`
  enum has no `FlowId`, so there is no per-flow endpoint available. We
  stream the site-wide list lazily — `get_flow_runs(flow_id)` advances the
  iterator only until the requested flow has `numberOfStatus` runs or the
  stream exhausts. Subsequent calls for other flows reuse the already-scanned
  runs without re-paging. The `pipelineFilterPattern` still benefits: excluded
  flows never have their runs requested, so the stream can stop early.
- **Flow-step status is flow-level.** Tableau reports one execution status
  per flow run. Each task in the DAG receives that same status.
- **Intermediate step metadata** (cleaning / join / aggregation nodes
  inside the flow) is not exposed by the Metadata API. The Task DAG captures
  the flow boundary (inputs → processing → outputs) only.

## Test connection steps

- `GetPipelines` (mandatory) — lists flows with a single-page REST call.
- `GetLineage` (optional) — executes a `{ serverInfo { serverName } }`
  GraphQL query to confirm the Metadata API is enabled.
