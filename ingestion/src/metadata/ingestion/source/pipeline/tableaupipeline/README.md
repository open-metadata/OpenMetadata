# Tableau Pipeline Connector

Ingests Tableau Prep flows as OpenMetadata Pipelines. Captures the flow DAG,
run history for observability, and flow-level lineage — the tables and
published data sources a flow reads and writes, and the flows that consume
it — via the Tableau Metadata API. Extract refreshes of published data
sources and workbooks are ingested as pipelines too, with their refresh jobs
as run history.

## Capability matrix

| Capability | Status | Notes |
|------------|--------|-------|
| Pipeline metadata (flow → Pipeline) | Yes | Name, description, display name, source URL |
| Task DAG (node-level) | Yes | Input tasks per upstream table / data source, processing task, output tasks per `FlowOutputStep`, wired via `downstreamTasks` |
| Pipeline status (per flow run) | Yes | Most recent `numberOfStatus` runs per flow, keyed on `startedAt` with `executionId` = flow run id |
| Per-task status | Yes (flow-level) | Every task in a flow run receives the same status — Tableau reports status at flow granularity, not per step |
| Owner extraction | Yes | Resolves the owner of the flow / data source / workbook → Tableau user email (or an email-shaped username, as on Tableau Cloud) → OpenMetadata user; honours `includeOwners` |
| Tag extraction | Yes | Emits a `TableauTags` classification and attaches tags to the pipeline |
| Table and data model lineage (input → output) | Yes | Each input (`Flow.upstreamTables`, `Flow.upstreamDatasources`) is linked to the outputs it feeds (`Flow.downstreamTables` for output to a database, `Flow.downstreamDatasources` for a published data source), with the flow in `lineageDetails.pipeline` |
| Custom SQL input parsing | Yes | Only for upstream tables Tableau returns without a name, as the dashboard connector does |
| Downstream flow lineage (pipeline → pipeline) | Yes | `Flow.nextDownstreamFlows` (direct consumers only); edges to flows listed later are drawn in the post-process |
| Column-level lineage | No | Not built yet: the edges run between assets, so the field lineage the input → output pairing reads could carry it |
| Extract refresh pipelines | Yes | One pipeline per data source / workbook with an extract refresh task; `includeExtractRefreshes` (default on) |
| Extract refresh status | Yes | Refresh jobs (full and incremental) as pipeline status, with Tableau's job notes as the failure reason; needs a site administrator |
| Extract refresh lineage (pipeline → data model) | Yes | The published data source, or each embedded extract of the workbook, resolved to the dashboard connector's data model; see [Lineage resolution](#lineage-resolution) for why the refresh is an endpoint |
| Failure reason on flow runs | Yes | Notes of the flow run's background job |
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
- **Extract refresh status needs a site administrator.** Query Jobs only
  answers server and site administrators; other users still get extract
  refresh pipelines (for the refresh tasks they own), without status.

## Connection configuration

Key fields on `TableauPipelineConnection`:

| Field | Purpose |
|-------|---------|
| `hostPort` | Tableau Server URL |
| `authType` | `BasicAuth` (username/password) or `AccessTokenAuth` (PAT name + secret) |
| `siteName` | Tableau site (empty for default) |
| `apiVersion` | Optional REST API version override |
| `verifySSL` + `sslConfig` | TLS validation mode, CA certificate, and client certificate + key (mutual TLS) when `verifySSL=validate` |
| `pipelineFilterPattern` | Include/exclude regex on the pipeline's display name: the flow name, or `<data source / workbook name> extract refresh` |
| `numberOfStatus` | Most recent runs kept per flow or extract refresh (default 10, 1–100) |
| `includeExtractRefreshes` | Ingest extract refreshes as pipelines (default `true`) |

## Lineage resolution

A flow's edges run between the assets it reads and the assets it writes, with
the flow in `lineageDetails.pipeline`, as other pipeline connectors draw them:
a flow's input and output tables are direct neighbours, and the platform's
pipeline view mode decides whether the flow shows as a node or on the edge.

Which inputs feed which outputs:

1. A flow with a single input, or a single output, links every input to every
   output.
2. A flow with several of each can run separate branches, so the pairs are
   read from the lineage of the fields its output steps write
   (`FlowOutputField.upstream*` / `downstream*`), in a query of its own so a
   flow that exceeds the node budget keeps its main lineage.
3. When Tableau does not say, no input → output edge is drawn for that flow
   (a warning names it) rather than every input being tied to every output.

A flow that also updates a table it reads draws no edge from the table to
itself.

Tables (inputs and outputs) resolve as follows, trying the database, schema
and table Tableau reports first and then those in the table's full name
(`[db].[schema].[table]`, `[schema].[table]` or `schema.table`), as the
dashboard Tableau connector does:

1. With `lineageInformation.dbServiceNames` set, only those services are
   tried, each with its own database naming: a single-database service
   (MySQL, Oracle, Hive, …) files Tableau's database — really its schema —
   under its configured or `default` database, and BigQuery's database is
   left to the search.
2. Without them, a search across every database service is used, and only
   a single match is accepted — a same-named table elsewhere never gets the
   edge, and names that match several tables do not fall back to looser ones.
3. For an upstream table Tableau returns without a name, its custom SQL is
   fetched (in a separate query, so popular tables do not spend the main
   query's node budget) and parsed (ANSI dialect); each source table resolves
   via steps 1–2.

Published data sources resolve to the `DashboardDataModel`s the dashboard
Tableau connector created — in every dashboard service that ingests the site
— matched on the Metadata API `id` (the name that connector gives its data
models). Run the dashboard connector first.

Cross-flow lineage resolves by looking up the downstream flow in the same
pipeline service; a flow listed after its upstream flow is linked in the
post-process, once every flow is ingested. It stays a pipeline → pipeline
edge: the asset between two flows is often not in OpenMetadata (a data source
no workbook uses, a file output).

An extract refresh reads no asset of its own, so it is the upstream end of
its edges to the data models it refreshes. The table → data model edges it
keeps fresh belong to the dashboard Tableau connector; writing them from here
would replace their column lineage whenever `overrideLineage` is on.

## Known limitations

- **Flow runs are fetched per flow.** `GET /flows/runs` is filtered on
  `flowId` and sorted on `startedAt` descending with a page size of
  `numberOfStatus`. TSC's `FlowRuns.get` returns a plain list, so it cannot
  be driven through `Pager`. The endpoint documents neither paging nor
  sorting: if the sort is rejected, runs are read unsorted page by page, and
  the first page that brings no run not seen before ends the listing, so a
  server that ignores `pageNumber` is not read forever.
- **Extract refresh jobs are looked up one by one.** Query Jobs cannot filter
  by data source or workbook, so jobs are read newest first
  (`jobType:in:[refresh_extracts,increment_extracts]`, `createdAt:desc`) and
  each needs a Query Job call to learn its target. Reading stops once every
  extract refresh the filter pattern keeps has `numberOfStatus` runs, or
  after 1,000 lookups per ingestion. If the server rejects the sort, every
  job up to the cap is read and the newest runs are kept.
  History depth is bounded by Tableau's job retention (about 30 days on
  Tableau Cloud). Queued jobs are skipped until they start.
- **Flow-step status is flow-level.** Tableau reports one execution status
  per flow run. Each task in the DAG receives that same status.
- **Intermediate step metadata** (cleaning / join / aggregation nodes
  inside the flow) is not exposed by the Metadata API. The Task DAG captures
  the flow boundary (inputs → processing → outputs) only.
- **Metadata API outages keep the DAG.** When the Metadata API cannot be
  queried, a flow keeps the tasks it already has in OpenMetadata rather than
  collapsing to a single task; a flow with no lineage records is a single
  task.
- **Partial listings delete nothing.** When the extract refresh tasks, or one
  of their data sources / workbooks, cannot be read, no pipeline is marked as
  deleted that run. A data source or workbook that no longer exists is
  skipped normally.
- **Retries.** 429 and 502-504 answers are retried three times with backoff,
  honouring `Retry-After`.
- **Metadata API node limit.** A query that exceeds the node limit (20,000
  by default on Tableau Server) returns partial data plus `errors`; the
  connector logs the errors and ingests what was returned.

## Test connection steps

- `GetPipelines` (mandatory) — lists flows with a single-page REST call.
- `GetRuns` (optional) — lists one flow run, proving run history is readable.
- `GetJobs` (optional) — lists the extract refresh tasks and one extract
  refresh job, proving refresh history is readable (site administrator
  only). Passes without calling Tableau when `includeExtractRefreshes` is off.
- `GetLineage` (optional) — runs a `flowsConnection(first: 1)` Metadata API
  query to confirm lineage extraction will work.
