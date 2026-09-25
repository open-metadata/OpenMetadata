# Tableau Pipeline Connector

Ingests Tableau Prep flows as OpenMetadata Pipelines. Captures the flow DAG,
run history for observability, and flow-level lineage — the tables and
published data sources a flow reads and writes, and the flows that consume
it — via the Tableau Metadata API.

## Capability matrix

| Capability | Status | Notes |
|------------|--------|-------|
| Pipeline metadata (flow → Pipeline) | Yes | Name, description, display name, source URL |
| Task DAG (node-level) | Yes | Input tasks per upstream table / data source, processing task, output tasks per `FlowOutputStep`, wired via `downstreamTasks` |
| Pipeline status (per flow run) | Yes | Most recent `numberOfStatus` runs per flow, keyed on `startedAt` with `executionId` = flow run id |
| Per-task status | Yes (flow-level) | Every task in a flow run receives the same status — Tableau reports status at flow granularity, not per step |
| Owner extraction | Yes | Resolves `flow.owner_id` → Tableau user email → OpenMetadata user; honours `includeOwners` |
| Tag extraction | Yes | Emits a `TableauTags` classification and attaches tags to the pipeline |
| Input lineage (table / data model → pipeline) | Yes | `Flow.upstreamTables`, `Flow.upstreamDatasources` |
| Output lineage (pipeline → table / data model) | Yes | `Flow.downstreamTables` (output to a database), `Flow.downstreamDatasources` (published data source) |
| Custom SQL input parsing | Yes | Only for upstream tables Tableau returns without a name, as the dashboard connector does |
| Downstream flow lineage (pipeline → pipeline) | Yes | `Flow.nextDownstreamFlows` (direct consumers only) |
| Column-level lineage | No | The flow is a lineage node, and OpenMetadata drops column lineage on edges that end at a pipeline |
| Extract refresh history | No | Planned — see below |
| Schedule metadata | No | Planned |

## Requirements

- **Tableau Server** or **Tableau Cloud** with authenticated access.
- **Metadata API enabled** for lineage extraction. The connector degrades
  gracefully without it — metadata and status still ingest, but no lineage
  edges are produced. See
  [Start the Metadata API](https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html).
- A user with permission to list flows, flow runs, and (for lineage) query
  the Metadata API. Non-admin users only see runs of flows they can view.
- Flows can run manually without Data Management, but scheduled runs need
  [Tableau Prep Conductor](https://help.tableau.com/current/prep/en-us/prep_conductor_overview.htm).

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

Tables (inputs and outputs) resolve in this order:

1. For each `dbServiceName` in `lineageInformation.dbServiceNames`, build
   `{service}.{database}.{schema}.{table}` FQN and look up directly.
2. Fallback to `search_in_any_service` across every database service.
3. For an upstream table Tableau returns without a name, parse its custom
   SQL (ANSI dialect) and resolve each source table via steps 1–2.

Published data sources resolve to the `DashboardDataModel` the dashboard
Tableau connector created, matched on the Metadata API `id` (the name that
connector gives its data models). Run the dashboard connector first.

Cross-flow lineage resolves by looking up the downstream flow in the
same pipeline service. If a downstream flow has not been ingested yet,
the edge is skipped — it will resolve on a subsequent ingestion.

## Known limitations

- **Flow runs are fetched per flow.** `GET /flows/runs` is filtered on
  `flowId` and sorted on `startedAt` descending with a page size of
  `numberOfStatus`. TSC's `FlowRuns.get` returns a plain list, so it cannot
  be driven through `Pager`.
- **Flow-step status is flow-level.** Tableau reports one execution status
  per flow run. Each task in the DAG receives that same status.
- **Intermediate step metadata** (cleaning / join / aggregation nodes
  inside the flow) is not exposed by the Metadata API. The Task DAG captures
  the flow boundary (inputs → processing → outputs) only.
- **Metadata API node limit.** A query that exceeds the node limit (20,000
  by default on Tableau Server) returns partial data plus `errors`; the
  connector logs the errors and ingests what was returned.

## Test connection steps

- `GetPipelines` (mandatory) — lists flows with a single-page REST call.
- `GetRuns` (optional) — lists one flow run, proving run history is readable.
- `GetLineage` (optional) — runs a `flowsConnection(first: 1)` Metadata API
  query to confirm lineage extraction will work.
