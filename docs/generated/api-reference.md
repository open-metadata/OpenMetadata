<!-- GENERATED FILE — DO NOT EDIT. Run `make generate-api-reference`. -->

# API Reference (endpoint index)

Every REST endpoint, grouped by resource package. **Generated** from the JAX-RS
resource classes under
`openmetadata-service/src/main/java/org/openmetadata/service/resources/**` — do not
hand-edit; run `make generate-api-reference` (or `make generate-reference-docs`).

- **Method + path are exact** (from `@GET`/`@POST`/… and `@Path`).
- **Purpose** is the `@Operation(summary=…)` where present; a blank cell means there is
  no summary annotation, not that the endpoint has no purpose. Purposes are never inferred.
- Source is the annotations, **not** `openapi.yml` (a config stub with no endpoints; the
  full spec is assembled at runtime by Dropwizard).

**1781 endpoints** across 74 resource packages · 1771 carry a summary.

## (root)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/history` | List all entity versions within a time range |
| `GET` | `/name/{fqn}/context` | Get the AI context for an entity by fully qualified name |
| `GET` | `/v1/changeSummary/{entityType}/name/{fqn}` | Get change summary for an entity by fully qualified name |
| `GET` | `/v1/changeSummary/{entityType}/{id}` | Get change summary for an entity by ID |
| `GET` | `/{id}/context` | Get the AI context for an entity by id |

## activity

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/activity` | List activity events |
| `GET` | `/v1/activity/about` | Get activity for a specific entity or field |
| `GET` | `/v1/activity/count` | Get activity event count |
| `GET` | `/v1/activity/entity/{entityType}/name/{fqn}` | Get activity for a specific entity by fully qualified name |
| `GET` | `/v1/activity/entity/{entityType}/{entityId}` | Get activity for a specific entity by ID |
| `GET` | `/v1/activity/following` | Get activity feed for entities the current user follows |
| `GET` | `/v1/activity/my-feed` | Get personalized activity feed for current user |
| `GET` | `/v1/activity/user/{userId}` | Get activity by a specific user |
| `DELETE` | `/v1/activity/{id}/reaction/{reactionType}` | Remove a reaction from an activity event |
| `PUT` | `/v1/activity/{id}/reaction/{reactionType}` | Add a reaction to an activity event |

## ai

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/agentExecutions` | List agent executions |
| `POST` | `/v1/agentExecutions` | Create an agent execution |
| `DELETE` | `/v1/agentExecutions/{agentId}/{timestamp}` | Delete agent execution data at a timestamp |
| `DELETE` | `/v1/agentExecutions/{id}` | Delete an agent execution by Id |
| `GET` | `/v1/agentExecutions/{id}` | Get an agent execution by Id |
| `POST` | `/v1/ai/context/attachedKnowledge` | Batch-resolve the knowledge attached to a set of assets |
| `GET` | `/v1/ai/context/find` | Find company knowledge relevant to a question, routed to candidate assets |
| `GET` | `/v1/aiApplications` | List AI applications |
| `POST` | `/v1/aiApplications` | Create an AI application |
| `PUT` | `/v1/aiApplications` | Create or update an AI application |
| `DELETE` | `/v1/aiApplications/async/{id}` | Asynchronously delete an AI application by Id |
| `DELETE` | `/v1/aiApplications/name/{fqn}` | Delete an AI application by fully qualified name |
| `GET` | `/v1/aiApplications/name/{fqn}` | Get an AI application by fully qualified name |
| `PATCH` | `/v1/aiApplications/name/{fqn}` | Update an AI application by name. |
| `PUT` | `/v1/aiApplications/restore` | Restore a soft deleted AI application |
| `DELETE` | `/v1/aiApplications/{id}` | Delete an AI application by Id |
| `GET` | `/v1/aiApplications/{id}` | Get an AI application by Id |
| `PATCH` | `/v1/aiApplications/{id}` | Update an AI application |
| `PUT` | `/v1/aiApplications/{id}/followers` | Add a follower |
| `DELETE` | `/v1/aiApplications/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/aiApplications/{id}/versions` | List AI application versions |
| `GET` | `/v1/aiApplications/{id}/versions/{version}` | Get a version of the AI application |
| `GET` | `/v1/aiFrameworkControls` | List controls |
| `POST` | `/v1/aiFrameworkControls` | Create a control |
| `PUT` | `/v1/aiFrameworkControls` | Create or update a control |
| `GET` | `/v1/aiFrameworkControls/name/{fqn}` | Get a control by FQN |
| `DELETE` | `/v1/aiFrameworkControls/{id}` | Delete a control |
| `GET` | `/v1/aiFrameworkControls/{id}` | Get a control by id |
| `PATCH` | `/v1/aiFrameworkControls/{id}` | Update a control |
| `GET` | `/v1/aiGovernance/activity` | Curated AI governance activity feed |
| `GET` | `/v1/aiGovernance/dashboard` | Rollup of AI governance state |
| `GET` | `/v1/aiGovernance/intakeChecks/{entityType}/name/{fqn}` | Return the AI governance intake checks for an asset |
| `GET` | `/v1/aiGovernance/policies/{policyId}/violations` | Recent breach events for a single AI governance policy |
| `POST` | `/v1/aiGovernance/shadow/bulkTriage` | Bulk-triage Shadow AI detections |
| `POST` | `/v1/aiGovernance/{entityType}/{id}/approve` | Approve a PendingApproval AI asset |
| `GET` | `/v1/aiGovernance/{entityType}/{id}/policyStatus` | Evaluate AI governance policies attached to an asset |
| `POST` | `/v1/aiGovernance/{entityType}/{id}/reject` | Reject a PendingApproval AI asset |
| `POST` | `/v1/aiGovernance/{entityType}/{id}/submitForReview` | Flip an AI asset's registrationStatus to PendingApproval |
| `GET` | `/v1/aiGovernanceFrameworks` | List frameworks |
| `POST` | `/v1/aiGovernanceFrameworks` | Create a framework |
| `PUT` | `/v1/aiGovernanceFrameworks` | Create or update a framework |
| `GET` | `/v1/aiGovernanceFrameworks/name/{fqn}` | Get a framework by FQN |
| `DELETE` | `/v1/aiGovernanceFrameworks/{id}` | Delete a framework |
| `GET` | `/v1/aiGovernanceFrameworks/{id}` | Get a framework by id |
| `PATCH` | `/v1/aiGovernanceFrameworks/{id}` | Update a framework |
| `GET` | `/v1/aiGovernanceFrameworks/{id}/coverage` | Per-control coverage roll-up for a framework |
| `POST` | `/v1/aiGovernanceFrameworks/{id}/fork` | Fork a built-in framework into a Custom framework |
| `GET` | `/v1/aiGovernancePolicies` | List AI governance policies |
| `POST` | `/v1/aiGovernancePolicies` | Create an AI governance policy |
| `PUT` | `/v1/aiGovernancePolicies` | Create or update an AI governance policy |
| `DELETE` | `/v1/aiGovernancePolicies/async/{id}` | Asynchronously delete an AI governance policy by Id |
| `DELETE` | `/v1/aiGovernancePolicies/name/{fqn}` | Delete an AI governance policy by fully qualified name |
| `GET` | `/v1/aiGovernancePolicies/name/{fqn}` | Get an AI governance policy by fully qualified name |
| `PATCH` | `/v1/aiGovernancePolicies/name/{fqn}` | Update an AI governance policy by name. |
| `PUT` | `/v1/aiGovernancePolicies/restore` | Restore a soft deleted AI governance policy |
| `DELETE` | `/v1/aiGovernancePolicies/{id}` | Delete an AI governance policy by Id |
| `GET` | `/v1/aiGovernancePolicies/{id}` | Get an AI governance policy by Id |
| `PATCH` | `/v1/aiGovernancePolicies/{id}` | Update an AI governance policy |
| `PUT` | `/v1/aiGovernancePolicies/{id}/followers` | Add a follower |
| `DELETE` | `/v1/aiGovernancePolicies/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/aiGovernancePolicies/{id}/versions` | List AI governance policy versions |
| `GET` | `/v1/aiGovernancePolicies/{id}/versions/{version}` | Get a version of the AI governance policy |
| `GET` | `/v1/auditReports` | List audit reports |
| `POST` | `/v1/auditReports` | Submit a new audit pack job |
| `PUT` | `/v1/auditReports` | Create or update an audit report |
| `GET` | `/v1/auditReports/name/{fqn}` | Get an audit report by FQN |
| `DELETE` | `/v1/auditReports/{id}` | Delete an audit report |
| `GET` | `/v1/auditReports/{id}` | Get an audit report by id |
| `PATCH` | `/v1/auditReports/{id}` | Update an audit report |
| `POST` | `/v1/auditReports/{id}/cancel` | Cancel a queued or running audit report |
| `GET` | `/v1/llmModels` | List LLM models |
| `POST` | `/v1/llmModels` | Create an LLM model |
| `PUT` | `/v1/llmModels` | Create or update an LLM model |
| `DELETE` | `/v1/llmModels/async/{id}` | Delete an LLM model asynchronously by Id |
| `DELETE` | `/v1/llmModels/name/{fqn}` | Delete an LLM model by fully qualified name |
| `GET` | `/v1/llmModels/name/{fqn}` | Get an LLM model by fully qualified name |
| `PATCH` | `/v1/llmModels/name/{fqn}` | Update an LLM model by name. |
| `PUT` | `/v1/llmModels/restore` | Restore a soft deleted LLM model |
| `DELETE` | `/v1/llmModels/{id}` | Delete an LLM model by Id |
| `GET` | `/v1/llmModels/{id}` | Get an LLM model by Id |
| `PATCH` | `/v1/llmModels/{id}` | Update an LLM model |
| `PUT` | `/v1/llmModels/{id}/followers` | Add a follower |
| `DELETE` | `/v1/llmModels/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/llmModels/{id}/versions` | List LLM model versions |
| `GET` | `/v1/llmModels/{id}/versions/{version}` | Get a version of the LLM model |
| `GET` | `/v1/mcpExecutions` | List MCP executions |
| `POST` | `/v1/mcpExecutions` | Create an MCP execution |
| `DELETE` | `/v1/mcpExecutions/{id}` | Delete an MCP execution by Id |
| `GET` | `/v1/mcpExecutions/{id}` | Get an MCP execution by Id |
| `DELETE` | `/v1/mcpExecutions/{serverId}/{timestamp}` | Delete MCP execution data at a timestamp |
| `GET` | `/v1/mcpServers` | List MCP servers |
| `POST` | `/v1/mcpServers` | Create an MCP server |
| `PUT` | `/v1/mcpServers` | Create or update an MCP server |
| `DELETE` | `/v1/mcpServers/async/{id}` | Asynchronously delete an MCP server by Id |
| `DELETE` | `/v1/mcpServers/name/{fqn}` | Delete an MCP server by fully qualified name |
| `GET` | `/v1/mcpServers/name/{fqn}` | Get an MCP server by fully qualified name |
| `PATCH` | `/v1/mcpServers/name/{fqn}` | Update an MCP server by name |
| `PUT` | `/v1/mcpServers/restore` | Restore a soft deleted MCP server |
| `DELETE` | `/v1/mcpServers/{id}` | Delete an MCP server by Id |
| `GET` | `/v1/mcpServers/{id}` | Get an MCP server by Id |
| `PATCH` | `/v1/mcpServers/{id}` | Update an MCP server |
| `PUT` | `/v1/mcpServers/{id}/followers` | Add a follower |
| `DELETE` | `/v1/mcpServers/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/mcpServers/{id}/versions` | List MCP server versions |
| `GET` | `/v1/mcpServers/{id}/versions/{version}` | Get a version of the MCP server |
| `GET` | `/v1/promptTemplates` | List prompt templates |
| `POST` | `/v1/promptTemplates` | Create a prompt template |
| `PUT` | `/v1/promptTemplates` | Create or update a prompt template |
| `DELETE` | `/v1/promptTemplates/async/{id}` | Asynchronously delete a prompt template by Id |
| `DELETE` | `/v1/promptTemplates/name/{fqn}` | Delete a prompt template by fully qualified name |
| `GET` | `/v1/promptTemplates/name/{fqn}` | Get a prompt template by fully qualified name |
| `PATCH` | `/v1/promptTemplates/name/{fqn}` | Update a prompt template by name. |
| `PUT` | `/v1/promptTemplates/restore` | Restore a soft deleted prompt template |
| `DELETE` | `/v1/promptTemplates/{id}` | Delete a prompt template by Id |
| `GET` | `/v1/promptTemplates/{id}` | Get a prompt template by Id |
| `PATCH` | `/v1/promptTemplates/{id}` | Update a prompt template |
| `PUT` | `/v1/promptTemplates/{id}/followers` | Add a follower |
| `DELETE` | `/v1/promptTemplates/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/promptTemplates/{id}/versions` | List prompt template versions |
| `GET` | `/v1/promptTemplates/{id}/versions/{version}` | Get a version of the prompt template |

## analytics

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/analytics/dataInsights/data` | List the report data |
| `POST` | `/v1/analytics/dataInsights/data` | Add data to a data insight report |
| `DELETE` | `/v1/analytics/dataInsights/data/{reportDataType}` | Delete all the previous report data for a given report data type |
| `DELETE` | `/v1/analytics/dataInsights/data/{reportDataType}/{date}` | Delete report data for a given report data type ando date |
| `GET` | `/v1/analytics/web/events` | List web analytic event types |
| `POST` | `/v1/analytics/web/events` | Create a web analytic event type |
| `PUT` | `/v1/analytics/web/events` | Update a web analytic event type |
| `DELETE` | `/v1/analytics/web/events/async/{id}` | Asynchronously delete a web analytic event type by Id |
| `GET` | `/v1/analytics/web/events/collect` | Retrieve web analytic data |
| `PUT` | `/v1/analytics/web/events/collect` | Add web analytic event data |
| `DELETE` | `/v1/analytics/web/events/name/{fqn}` | Delete a web analytic event type by fully qualified name |
| `GET` | `/v1/analytics/web/events/name/{fqn}` | Get a web analytic event type by fully qualified name |
| `PATCH` | `/v1/analytics/web/events/name/{fqn}` | Update a web analytic event type by fully qualified name |
| `PUT` | `/v1/analytics/web/events/restore` | Restore a soft deleted web analytic event |
| `DELETE` | `/v1/analytics/web/events/{id}` | Delete a web analytic event type by Id |
| `GET` | `/v1/analytics/web/events/{id}` | Get a web analytic event type by Id |
| `PATCH` | `/v1/analytics/web/events/{id}` | Update a web analytic event type by Id |
| `GET` | `/v1/analytics/web/events/{id}/versions` | List web analytic event type versions |
| `GET` | `/v1/analytics/web/events/{id}/versions/{version}` | Get a version of the report definition |
| `DELETE` | `/v1/analytics/web/events/{name}/{timestamp}/collect` | Delete web analytic event data before a timestamp |

## apis

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/apiCollections` | List API Collections |
| `POST` | `/v1/apiCollections` | Create a APICollection |
| `PUT` | `/v1/apiCollections` | Create or update API Collection |
| `DELETE` | `/v1/apiCollections/async/{id}` | Asynchronously delete a API Collection by Id |
| `PUT` | `/v1/apiCollections/bulk` | Bulk create or update API collections |
| `DELETE` | `/v1/apiCollections/deleteStale` | Delete stale apicollections within a scope |
| `DELETE` | `/v1/apiCollections/name/{fqn}` | Delete a API Collection by fully qualified name |
| `GET` | `/v1/apiCollections/name/{fqn}` | Get a APICollection by fully qualified name |
| `PATCH` | `/v1/apiCollections/name/{fqn}` | Update a APICollection by name. |
| `PUT` | `/v1/apiCollections/restore` | Restore a soft deleted API Collection. |
| `DELETE` | `/v1/apiCollections/{id}` | Delete a API Collection by Id |
| `GET` | `/v1/apiCollections/{id}` | Get a API Collection by Id |
| `PATCH` | `/v1/apiCollections/{id}` | Update a API Collection by Id |
| `GET` | `/v1/apiCollections/{id}/versions` | List API Collection versions |
| `GET` | `/v1/apiCollections/{id}/versions/{version}` | Get a version of the APICollection |
| `PUT` | `/v1/apiCollections/{id}/vote` | Update Vote for a API Collection |
| `GET` | `/v1/apiEndpoints` | List API Endpoints |
| `POST` | `/v1/apiEndpoints` | Create a API Endpoint |
| `PUT` | `/v1/apiEndpoints` | Update API Endpoint |
| `DELETE` | `/v1/apiEndpoints/async/{id}` | Asynchronously delete a APIEndpoint by id |
| `PUT` | `/v1/apiEndpoints/bulk` | Bulk create or update API endpoints |
| `DELETE` | `/v1/apiEndpoints/deleteStale` | Delete stale apiendpoints within a scope |
| `DELETE` | `/v1/apiEndpoints/name/{fqn}` | Delete a APIEndpoint by fully qualified name |
| `GET` | `/v1/apiEndpoints/name/{fqn}` | Get a Endpoint by fully qualified name. |
| `PATCH` | `/v1/apiEndpoints/name/{fqn}` | Update a APIEndpoint using name. |
| `PUT` | `/v1/apiEndpoints/restore` | Restore a soft deleted APIEndpoint |
| `DELETE` | `/v1/apiEndpoints/{id}` | Delete a APIEndpoint by id |
| `GET` | `/v1/apiEndpoints/{id}` | Get a APIEndpoint by id |
| `PATCH` | `/v1/apiEndpoints/{id}` | Update a APIEndpoint |
| `PUT` | `/v1/apiEndpoints/{id}/followers` | Add a follower |
| `DELETE` | `/v1/apiEndpoints/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/apiEndpoints/{id}/versions` | List API Endpoint versions |
| `GET` | `/v1/apiEndpoints/{id}/versions/{version}` | Get a version of the APIEndpoint |
| `PUT` | `/v1/apiEndpoints/{id}/vote` | Update Vote for a APIEndpoint |

## apps

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/apps` | List installed application |
| `POST` | `/v1/apps` | Create a Application |
| `PUT` | `/v1/apps` | Create Or Update App |
| `DELETE` | `/v1/apps/async/{id}` | Asynchronously delete a App by Id |
| `POST` | `/v1/apps/configure/{name}` | Configure an Application |
| `POST` | `/v1/apps/deploy/{name}` | Deploy App to Quartz or Ingestion |
| `GET` | `/v1/apps/installed` | List Entity Reference for installed application |
| `GET` | `/v1/apps/marketplace` | List application |
| `POST` | `/v1/apps/marketplace` | Create a Application |
| `PUT` | `/v1/apps/marketplace` | Create Or Update App |
| `DELETE` | `/v1/apps/marketplace/async/{id}` | Asynchronously delete a App by Id |
| `PATCH` | `/v1/apps/marketplace/name/{fqn}` | Updates an App by name. |
| `DELETE` | `/v1/apps/marketplace/name/{name}` | Delete a App by name |
| `GET` | `/v1/apps/marketplace/name/{name}` | Get a App by name |
| `PUT` | `/v1/apps/marketplace/restore` | Restore a soft deleted KPI |
| `DELETE` | `/v1/apps/marketplace/{id}` | Delete a App by Id |
| `GET` | `/v1/apps/marketplace/{id}` | Get a app by Id |
| `PATCH` | `/v1/apps/marketplace/{id}` | Updates a App |
| `GET` | `/v1/apps/marketplace/{id}/versions` | List Installed Application versions |
| `GET` | `/v1/apps/marketplace/{id}/versions/{version}` | Get a version of the App |
| `PATCH` | `/v1/apps/name/{fqn}` | Updates a App by name. |
| `DELETE` | `/v1/apps/name/{name}` | Delete a App by name |
| `GET` | `/v1/apps/name/{name}` | Get a App by name |
| `GET` | `/v1/apps/name/{name}/extension` | List App Extension data |
| `GET` | `/v1/apps/name/{name}/live-indexing-queue` | List Search Index Retry Queue |
| `GET` | `/v1/apps/name/{name}/logs` | Retrieve all logs from last ingestion pipeline run for the application |
| `GET` | `/v1/apps/name/{name}/runs/latest` | Get Latest App Run Record |
| `GET` | `/v1/apps/name/{name}/status` | List App Run Records |
| `PUT` | `/v1/apps/restore` | Restore a soft deleted KPI |
| `POST` | `/v1/apps/schedule/{name}` | Schedule an Application |
| `POST` | `/v1/apps/stop/{name}` | Stop a Application run |
| `POST` | `/v1/apps/trigger/{name}` | Trigger an Application run |
| `DELETE` | `/v1/apps/{id}` | Delete a App by Id |
| `GET` | `/v1/apps/{id}` | Get a app by Id |
| `PATCH` | `/v1/apps/{id}` | Updates a App |
| `GET` | `/v1/apps/{id}/versions` | List Installed Application versions |
| `GET` | `/v1/apps/{id}/versions/{version}` | Get a version of the App |

## attachments

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/attachments/fqn/{fqn}/{assetType}` |  |
| `POST` | `/v1/attachments/upload` |  |
| `DELETE` | `/v1/attachments/{id}` |  |
| `GET` | `/v1/attachments/{id}` |  |
| `GET` | `/v1/attachments/{id}/download` |  |

## audit

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/audit/logs` | List audit log events |
| `GET` | `/v1/audit/logs/export` | Export audit log events as JSON (async) |
| `GET` | `/v1/audit/logs/export/{jobId}` | Get the status of an audit log export job |
| `GET` | `/v1/audit/logs/export/{jobId}/result` | Download a completed audit log export |

## automations

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/automations/workflows` | List automations workflows |
| `POST` | `/v1/automations/workflows` | Create a Workflow |
| `PUT` | `/v1/automations/workflows` | Update Workflow |
| `DELETE` | `/v1/automations/workflows/async/{id}` | Asynchronously delete a Workflow |
| `PATCH` | `/v1/automations/workflows/name/{fqn}` | Update a Workflow by name. |
| `DELETE` | `/v1/automations/workflows/name/{name}` | Delete a Workflow |
| `GET` | `/v1/automations/workflows/name/{name}` | Get a Workflow by name |
| `PUT` | `/v1/automations/workflows/restore` | Restore a soft deleted Workflow |
| `POST` | `/v1/automations/workflows/trigger/{id}` | Trigger an workflow run |
| `DELETE` | `/v1/automations/workflows/{id}` | Delete a Workflow |
| `GET` | `/v1/automations/workflows/{id}` | Get a Workflow by Id |
| `PATCH` | `/v1/automations/workflows/{id}` | Update a Workflow |
| `GET` | `/v1/automations/workflows/{id}/versions` | List Workflow versions |
| `GET` | `/v1/automations/workflows/{id}/versions/{version}` | Get a version of the Workflow |

## bots

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/bots` | List bots |
| `POST` | `/v1/bots` | Create a bot |
| `PUT` | `/v1/bots` | Create or update a bot |
| `DELETE` | `/v1/bots/async/{id}` | Asynchronously delete a bot by Id |
| `PATCH` | `/v1/bots/name/{fqn}` | Update a bot by name. |
| `DELETE` | `/v1/bots/name/{name}` | Delete a bot by name |
| `GET` | `/v1/bots/name/{name}` | Get a bot by name |
| `PUT` | `/v1/bots/restore` | Restore a soft deleted bot |
| `DELETE` | `/v1/bots/{id}` | Delete a bot by Id |
| `GET` | `/v1/bots/{id}` | Get a bot by Id |
| `PATCH` | `/v1/bots/{id}` | Update a bot |
| `GET` | `/v1/bots/{id}/versions` | List bot versions |
| `GET` | `/v1/bots/{id}/versions/{version}` | Get a version of the bot |

## charts

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/charts` | List charts |
| `POST` | `/v1/charts` | Create a chart |
| `PUT` | `/v1/charts` | Create or update chart |
| `DELETE` | `/v1/charts/async/{id}` | Asynchronously delete a chart by Id |
| `PUT` | `/v1/charts/bulk` | Bulk create or update charts |
| `DELETE` | `/v1/charts/deleteStale` | Delete stale charts within a scope |
| `DELETE` | `/v1/charts/name/{fqn}` | Delete a chart by fully qualified name |
| `GET` | `/v1/charts/name/{fqn}` | Get a chart by fully qualified name |
| `PATCH` | `/v1/charts/name/{fqn}` | Update a chart by name. |
| `PUT` | `/v1/charts/restore` | Restore a soft deleted chart |
| `DELETE` | `/v1/charts/{id}` | Delete a chart by Id |
| `GET` | `/v1/charts/{id}` | Get a chart by Id |
| `PATCH` | `/v1/charts/{id}` | Update a chart |
| `PUT` | `/v1/charts/{id}/followers` | Add a follower |
| `DELETE` | `/v1/charts/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/charts/{id}/versions` | List chart versions |
| `GET` | `/v1/charts/{id}/versions/{version}` | Get a version of the chart |
| `PUT` | `/v1/charts/{id}/vote` | Update Vote for a Entity |

## columns

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/columns/bulk-update-async` | Bulk update columns asynchronously |
| `POST` | `/v1/columns/bulk-update-preview` | Preview bulk column updates (dry-run) |
| `GET` | `/v1/columns/export` | Export unique column names to CSV |
| `GET` | `/v1/columns/grid` | Get column grid with metadata grouping |
| `POST` | `/v1/columns/import` | Import column metadata from CSV (with dry-run) |
| `POST` | `/v1/columns/import-async` | Import column metadata from CSV asynchronously |
| `GET` | `/v1/columns/name/{fqn}` | Get a column by fully qualified name |
| `PUT` | `/v1/columns/name/{fqn}` | Update a column by fully qualified name |
| `GET` | `/v1/columns/search` | Search and group columns by name |

## context

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/contextCenter/memories` | List context memories |
| `POST` | `/v1/contextCenter/memories` | Create a memory |
| `PUT` | `/v1/contextCenter/memories` | Create or update a memory |
| `DELETE` | `/v1/contextCenter/memories/name/{fqn}` | Delete a memory by fully qualified name |
| `GET` | `/v1/contextCenter/memories/name/{fqn}` | Get a memory by fully qualified name |
| `PUT` | `/v1/contextCenter/memories/restore` | Restore a soft-deleted memory |
| `DELETE` | `/v1/contextCenter/memories/{id}` | Delete a memory by id |
| `GET` | `/v1/contextCenter/memories/{id}` | Get a memory by id |
| `PATCH` | `/v1/contextCenter/memories/{id}` | Update a memory |
| `DELETE` | `/v1/contextCenter/memories/{id}/pin` | Unpin a memory |
| `PUT` | `/v1/contextCenter/memories/{id}/pin` | Pin a memory |
| `GET` | `/v1/contextCenter/memories/{id}/versions` | List context memory versions |
| `GET` | `/v1/contextCenter/memories/{id}/versions/{version}` | Get a version of a context memory |

## csv

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/csv/v1/csv` | Get CSV column documentation |
| `GET` | `/v1/csvAsyncJobs` | List CSV import and export jobs |
| `GET` | `/v1/csvAsyncJobs/{jobId}` | Get a CSV import or export job |
| `PUT` | `/v1/csvAsyncJobs/{jobId}/cancel` | Cancel a CSV import or export job |
| `GET` | `/v1/csvAsyncJobs/{jobId}/result` | Download the CSV produced by a completed export job |

## dashboards

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/dashboards` | List dashboards |
| `POST` | `/v1/dashboards` | Create a dashboard |
| `PUT` | `/v1/dashboards` | Create or update a dashboard |
| `DELETE` | `/v1/dashboards/async/{id}` | Asynchronously delete a dashboard by Id |
| `PUT` | `/v1/dashboards/bulk` | Bulk create or update dashboards |
| `DELETE` | `/v1/dashboards/deleteStale` | Delete stale dashboards within a scope |
| `DELETE` | `/v1/dashboards/name/{fqn}` | Delete a dashboard by fully qualified name |
| `GET` | `/v1/dashboards/name/{fqn}` | Get a dashboard by fully qualified name |
| `PATCH` | `/v1/dashboards/name/{fqn}` | Update a dashboard by name. |
| `PUT` | `/v1/dashboards/restore` | Restore a soft deleted dashboard |
| `DELETE` | `/v1/dashboards/{id}` | Delete a dashboard by Id |
| `GET` | `/v1/dashboards/{id}` | Get a dashboard by Id |
| `PATCH` | `/v1/dashboards/{id}` | Update a dashboard |
| `PUT` | `/v1/dashboards/{id}/followers` | Add a follower |
| `DELETE` | `/v1/dashboards/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/dashboards/{id}/versions` | List dashboard versions |
| `GET` | `/v1/dashboards/{id}/versions/{version}` | Get a version of the dashboard |
| `PUT` | `/v1/dashboards/{id}/vote` | Update Vote for a Entity |

## data

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/dataContracts` | List data contracts |
| `POST` | `/v1/dataContracts` | Create a data contract |
| `POST` | `/v1/dataContracts` | Create a data contract from YAML |
| `PUT` | `/v1/dataContracts` | Create or update a data contract |
| `PUT` | `/v1/dataContracts` | Create or update a data contract from YAML |
| `DELETE` | `/v1/dataContracts/async/{id}` | Delete a data contract by id asynchronously |
| `GET` | `/v1/dataContracts/entity` | Get the effective data contract for an entity |
| `POST` | `/v1/dataContracts/entity/validate` | Validate a data contract for an entity |
| `DELETE` | `/v1/dataContracts/name/{fqn}` | Delete a data contract by fully qualified name |
| `GET` | `/v1/dataContracts/name/{fqn}` | Get a data contract by fully qualified name |
| `GET` | `/v1/dataContracts/name/{fqn}/odcs` | Export data contract to ODCS format by FQN |
| `GET` | `/v1/dataContracts/name/{fqn}/odcs/yaml` | Export data contract to ODCS YAML format by FQN |
| `POST` | `/v1/dataContracts/odcs` | Import data contract from ODCS format |
| `PUT` | `/v1/dataContracts/odcs` | Create or update data contract from ODCS format |
| `POST` | `/v1/dataContracts/odcs/parse/yaml` | Parse ODCS YAML and return metadata |
| `POST` | `/v1/dataContracts/odcs/validate/yaml` | Validate ODCS YAML without importing |
| `POST` | `/v1/dataContracts/odcs/yaml` | Import data contract from ODCS YAML format |
| `PUT` | `/v1/dataContracts/odcs/yaml` | Create or update data contract from ODCS YAML format |
| `PUT` | `/v1/dataContracts/restore` | Restore a soft deleted data contract |
| `GET` | `/v1/dataContracts/search` | Search data contracts |
| `POST` | `/v1/dataContracts/validate` | Validate data contract request without creating |
| `POST` | `/v1/dataContracts/validate/yaml` | Validate data contract request from YAML without creating |
| `DELETE` | `/v1/dataContracts/{id}` | Delete a data contract by id |
| `GET` | `/v1/dataContracts/{id}` | Get a data contract by id |
| `PATCH` | `/v1/dataContracts/{id}` | Update a data contract |
| `GET` | `/v1/dataContracts/{id}/odcs` | Export data contract to ODCS format |
| `GET` | `/v1/dataContracts/{id}/odcs/yaml` | Export data contract to ODCS YAML format |
| `GET` | `/v1/dataContracts/{id}/results` | List data contract results |
| `PUT` | `/v1/dataContracts/{id}/results` | Create or update data contract result |
| `DELETE` | `/v1/dataContracts/{id}/results/before/{timestamp}` | Delete data contract results before timestamp |
| `GET` | `/v1/dataContracts/{id}/results/latest` | Get latest data contract result |
| `GET` | `/v1/dataContracts/{id}/results/{resultId}` | Get a data contract result by ID |
| `DELETE` | `/v1/dataContracts/{id}/results/{timestamp}` | Delete data contract result |
| `POST` | `/v1/dataContracts/{id}/validate` | Validate a data contract |
| `GET` | `/v1/dataContracts/{id}/versions` | List all versions of a data contract |
| `GET` | `/v1/dataContracts/{id}/versions/{version}` | Get a version of a data contract |

## databases

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/databaseSchemas` | List database schemas |
| `POST` | `/v1/databaseSchemas` | Create a schema |
| `PUT` | `/v1/databaseSchemas` | Create or update schema |
| `DELETE` | `/v1/databaseSchemas/async/{id}` | Asynchronously delete a schema by Id |
| `PUT` | `/v1/databaseSchemas/bulk` | Bulk create or update databaseSchemas |
| `DELETE` | `/v1/databaseSchemas/deleteStale` | Delete stale databaseschemas within a scope |
| `GET` | `/v1/databaseSchemas/entityRelationship` | Search Schema Entity Relationship |
| `DELETE` | `/v1/databaseSchemas/name/{fqn}` | Delete a schema by fully qualified name |
| `GET` | `/v1/databaseSchemas/name/{fqn}` | Get a schema by fully qualified name |
| `PATCH` | `/v1/databaseSchemas/name/{fqn}` | Update a database schema by name. |
| `GET` | `/v1/databaseSchemas/name/{name}/export` | Export database schema in CSV format |
| `GET` | `/v1/databaseSchemas/name/{name}/exportAsync` | Export database schema in CSV format |
| `PUT` | `/v1/databaseSchemas/name/{name}/import` | Import tables from CSV to update database schema (no creation allowed) |
| `PUT` | `/v1/databaseSchemas/name/{name}/importAsync` | Import tables from CSV to update database schema asynchronously (no creation allowed) |
| `PUT` | `/v1/databaseSchemas/restore` | Restore a soft deleted database schema. |
| `DELETE` | `/v1/databaseSchemas/{id}` | Delete a schema by Id |
| `GET` | `/v1/databaseSchemas/{id}` | Get a schema by Id |
| `PATCH` | `/v1/databaseSchemas/{id}` | Update a database schema |
| `DELETE` | `/v1/databaseSchemas/{id}/databaseSchemaProfilerConfig` | Delete database profiler config |
| `GET` | `/v1/databaseSchemas/{id}/databaseSchemaProfilerConfig` | Get databaseSchema profile config |
| `PUT` | `/v1/databaseSchemas/{id}/databaseSchemaProfilerConfig` | Add databaseSchema profile config |
| `PUT` | `/v1/databaseSchemas/{id}/followers` | Add a follower |
| `DELETE` | `/v1/databaseSchemas/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/databaseSchemas/{id}/versions` | List schema versions |
| `GET` | `/v1/databaseSchemas/{id}/versions/{version}` | Get a version of the schema |
| `PUT` | `/v1/databaseSchemas/{id}/vote` | Update Vote for a Entity |
| `GET` | `/v1/databases` | List databases |
| `POST` | `/v1/databases` | Create a database |
| `PUT` | `/v1/databases` | Create or update database |
| `DELETE` | `/v1/databases/async/{id}` | Asynchronously delete a database by Id |
| `PUT` | `/v1/databases/bulk` | Bulk create or update databases |
| `DELETE` | `/v1/databases/deleteStale` | Delete stale databases within a scope |
| `DELETE` | `/v1/databases/name/{fqn}` | Delete a database by fully qualified name |
| `GET` | `/v1/databases/name/{fqn}` | Get a database by fully qualified name |
| `PATCH` | `/v1/databases/name/{fqn}` | Update a database by name. |
| `GET` | `/v1/databases/name/{name}/export` | Export database in CSV format |
| `GET` | `/v1/databases/name/{name}/exportAsync` | Export database in CSV format |
| `PUT` | `/v1/databases/name/{name}/import` | Import database schemas from CSV to update database schemas (no creation  |
| `PUT` | `/v1/databases/name/{name}/importAsync` | Import database schemas from CSV asynchronously |
| `PUT` | `/v1/databases/restore` | Restore a soft deleted Database. |
| `DELETE` | `/v1/databases/{id}` | Delete a database by Id |
| `GET` | `/v1/databases/{id}` | Get a database by Id |
| `PATCH` | `/v1/databases/{id}` | Update a database |
| `DELETE` | `/v1/databases/{id}/databaseProfilerConfig` | Delete database profiler config |
| `GET` | `/v1/databases/{id}/databaseProfilerConfig` | Get database profile config |
| `PUT` | `/v1/databases/{id}/databaseProfilerConfig` | Add database profile config |
| `PUT` | `/v1/databases/{id}/followers` | Add a follower |
| `DELETE` | `/v1/databases/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/databases/{id}/versions` | List database versions |
| `GET` | `/v1/databases/{id}/versions/{version}` | Get a version of the database |
| `PUT` | `/v1/databases/{id}/vote` | Update Vote for a Entity |
| `GET` | `/v1/storedProcedures` | List Stored Procedures |
| `POST` | `/v1/storedProcedures` | Create a Stored Procedure |
| `PUT` | `/v1/storedProcedures` | Create or update Stored Procedure |
| `DELETE` | `/v1/storedProcedures/async/{id}` | Asynchronously delete a StoredProcedure by Id |
| `PUT` | `/v1/storedProcedures/bulk` | Bulk create or update storedProcedures |
| `DELETE` | `/v1/storedProcedures/deleteStale` | Delete stale storedprocedures within a scope |
| `DELETE` | `/v1/storedProcedures/name/{fqn}` | Delete a schema by fully qualified name |
| `GET` | `/v1/storedProcedures/name/{fqn}` | Get a Stored Procedure by fully qualified name |
| `PATCH` | `/v1/storedProcedures/name/{fqn}` | Update a Stored Procedure by name. |
| `PUT` | `/v1/storedProcedures/restore` | Restore a soft deleted stored procedure. |
| `DELETE` | `/v1/storedProcedures/{id}` | Delete a StoredProcedure by Id |
| `GET` | `/v1/storedProcedures/{id}` | Get a stored procedure by Id |
| `PATCH` | `/v1/storedProcedures/{id}` | Update a Stored Procedure |
| `PUT` | `/v1/storedProcedures/{id}/followers` | Add a follower |
| `DELETE` | `/v1/storedProcedures/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/storedProcedures/{id}/versions` | List stored procedure versions |
| `GET` | `/v1/storedProcedures/{id}/versions/{version}` | Get a version of the Stored Procedure |
| `PUT` | `/v1/storedProcedures/{id}/vote` | Update Vote for a Entity |
| `GET` | `/v1/tables` | List tables |
| `POST` | `/v1/tables` | Create a table |
| `PUT` | `/v1/tables` | Create or update a table |
| `DELETE` | `/v1/tables/async/{id}` | Asynchronously delete a table by Id |
| `PUT` | `/v1/tables/bulk` | Bulk create or update tables |
| `DELETE` | `/v1/tables/deleteStale` | Delete stale tables within a scope |
| `GET` | `/v1/tables/entityRelationship` | Search Entity Relationship |
| `GET` | `/v1/tables/entityRelationship/{direction}` | Search entity relationship with Direction |
| `DELETE` | `/v1/tables/name/{fqn}` | Delete a table by fully qualified name |
| `GET` | `/v1/tables/name/{fqn}` | Get a table by fully qualified name |
| `PATCH` | `/v1/tables/name/{fqn}` | Update a table by name. |
| `GET` | `/v1/tables/name/{fqn}/columns` | Get table columns with pagination by FQN |
| `GET` | `/v1/tables/name/{fqn}/columns/search` | Search table columns with pagination by FQN |
| `GET` | `/v1/tables/name/{fqn}/pipelineObservability` | Get pipeline observability data by table FQN |
| `GET` | `/v1/tables/name/{name}/export` | Export table in CSV format |
| `GET` | `/v1/tables/name/{name}/exportAsync` | Export table in CSV format |
| `PUT` | `/v1/tables/name/{name}/import` | Import columns from CSV to update table (no creation allowed) |
| `PUT` | `/v1/tables/name/{name}/importAsync` | Import columns from CSV to update table asynchronously (no creation allowed) |
| `PUT` | `/v1/tables/restore` | Restore a soft deleted table |
| `GET` | `/v1/tables/{fqn}/columnProfile` | List of column profiles |
| `GET` | `/v1/tables/{fqn}/systemProfile` | List of system profiles |
| `GET` | `/v1/tables/{fqn}/tableProfile` | List of table profiles |
| `GET` | `/v1/tables/{fqn}/tableProfile/latest` | Get the latest table profile |
| `DELETE` | `/v1/tables/{fqn}/{entityType}/{timestamp}/profile` | Delete table profile data |
| `DELETE` | `/v1/tables/{id}` | Delete a table by Id |
| `GET` | `/v1/tables/{id}` | Get a table by Id |
| `PATCH` | `/v1/tables/{id}` | Update a table |
| `GET` | `/v1/tables/{id}/columns` | Get table columns with pagination |
| `GET` | `/v1/tables/{id}/columns/search` | Search table columns with pagination by ID |
| `PUT` | `/v1/tables/{id}/customMetric` | Add custom metrics |
| `DELETE` | `/v1/tables/{id}/customMetric/{columnName}/{customMetricName}` | Delete custom metric from a column |
| `DELETE` | `/v1/tables/{id}/customMetric/{customMetricName}` | Delete custom metric from a table |
| `PUT` | `/v1/tables/{id}/dataModel` | Add data modeling information to a table |
| `PUT` | `/v1/tables/{id}/followers` | Add a follower |
| `DELETE` | `/v1/tables/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/tables/{id}/joins` | Add table join information |
| `DELETE` | `/v1/tables/{id}/pipelineObservability` | Delete pipeline observability data |
| `GET` | `/v1/tables/{id}/pipelineObservability` | Get pipeline observability data |
| `PUT` | `/v1/tables/{id}/pipelineObservability` | Add pipeline observability data |
| `DELETE` | `/v1/tables/{id}/pipelineObservability/{pipelineFqn}` | Delete single pipeline observability data |
| `PUT` | `/v1/tables/{id}/pipelineObservability/{pipelineFqn}` | Add or update single pipeline observability data |
| `DELETE` | `/v1/tables/{id}/sampleData` | Delete sample data |
| `GET` | `/v1/tables/{id}/sampleData` | Get sample data |
| `PUT` | `/v1/tables/{id}/sampleData` | Add sample data |
| `PUT` | `/v1/tables/{id}/tableProfile` | Add table profile data |
| `DELETE` | `/v1/tables/{id}/tableProfilerConfig` | Delete table profiler config |
| `GET` | `/v1/tables/{id}/tableProfilerConfig` | Get table profile config |
| `PUT` | `/v1/tables/{id}/tableProfilerConfig` | Add table profile config |
| `GET` | `/v1/tables/{id}/versions` | List table versions |
| `GET` | `/v1/tables/{id}/versions/{version}` | Get a version of the table |
| `PUT` | `/v1/tables/{id}/vote` | Update Vote for a Entity |

## datainsight

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/analytics/dataInsights/charts` | List data insight charts |
| `POST` | `/v1/analytics/dataInsights/charts` | Create a data insight chart |
| `PUT` | `/v1/analytics/dataInsights/charts` | Update data insight chart |
| `GET` | `/v1/analytics/dataInsights/charts/aggregate` | Get aggregated data for a data insight chart |
| `DELETE` | `/v1/analytics/dataInsights/charts/async/{id}` | Asynchronously delete a data insight chart by Id |
| `DELETE` | `/v1/analytics/dataInsights/charts/name/{fqn}` | Delete a data insight chart by fully qualified name |
| `GET` | `/v1/analytics/dataInsights/charts/name/{fqn}` | Get a data insight chart by fully qualified name |
| `PATCH` | `/v1/analytics/dataInsights/charts/name/{fqn}` | Update a data insight chart by name. |
| `PUT` | `/v1/analytics/dataInsights/charts/restore` | Restore a soft deleted data insight chart |
| `DELETE` | `/v1/analytics/dataInsights/charts/{id}` | Delete a data insight chart by Id |
| `GET` | `/v1/analytics/dataInsights/charts/{id}` | Get a data insight chart by Id |
| `PATCH` | `/v1/analytics/dataInsights/charts/{id}` | Update a data insight chart |
| `GET` | `/v1/analytics/dataInsights/charts/{id}/versions` | List data insight chart versions |
| `GET` | `/v1/analytics/dataInsights/charts/{id}/versions/{version}` | Get a version of the data insight chart |

## datainsight/system

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/analytics/dataInsights/system/charts/listChartData` | Get data insight chart data |
| `GET` | `/v1/analytics/dataInsights/system/charts/name/{fqn}/data` | Get data insight chart data |
| `POST` | `/v1/analytics/dataInsights/system/charts/stream` | Start streaming chart data via WebSocket |
| `DELETE` | `/v1/analytics/dataInsights/system/charts/stream/{sessionId}` | Stop streaming chart data |

## datamodels

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/dashboard/datamodels` | List Dashboard Data Models |
| `POST` | `/v1/dashboard/datamodels` | Create a dashboard datamodel |
| `PUT` | `/v1/dashboard/datamodels` | Create or update dashboard datamodel |
| `DELETE` | `/v1/dashboard/datamodels/async/{id}` | Asynchronously delete a data model by `id`. |
| `PUT` | `/v1/dashboard/datamodels/bulk` | Bulk create or update dashboardDataModels |
| `DELETE` | `/v1/dashboard/datamodels/deleteStale` | Delete stale dashboarddatamodels within a scope |
| `DELETE` | `/v1/dashboard/datamodels/name/{fqn}` | Delete a data model by fully qualified name. |
| `GET` | `/v1/dashboard/datamodels/name/{fqn}` | Get a dashboard datamodel by fully qualified name |
| `PATCH` | `/v1/dashboard/datamodels/name/{fqn}` | Update a dashboard datamodel by name. |
| `GET` | `/v1/dashboard/datamodels/name/{fqn}/columns` | Get data model columns with pagination by FQN |
| `GET` | `/v1/dashboard/datamodels/name/{fqn}/columns/search` | Search data model columns with pagination by FQN |
| `PUT` | `/v1/dashboard/datamodels/restore` | Restore a soft deleted data model. |
| `DELETE` | `/v1/dashboard/datamodels/{id}` | Delete a data model by `id`. |
| `GET` | `/v1/dashboard/datamodels/{id}` | Get a dashboard datamodel by Id |
| `PATCH` | `/v1/dashboard/datamodels/{id}` | Update a dashboard datamodel |
| `GET` | `/v1/dashboard/datamodels/{id}/columns` | Get data model columns with pagination |
| `GET` | `/v1/dashboard/datamodels/{id}/columns/search` | Search data model columns with pagination by ID |
| `PUT` | `/v1/dashboard/datamodels/{id}/followers` | Add a follower |
| `DELETE` | `/v1/dashboard/datamodels/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/dashboard/datamodels/{id}/versions` | List dashboard datamodel versions |
| `GET` | `/v1/dashboard/datamodels/{id}/versions/{version}` | Get a version of the dashboard datamodel |
| `PUT` | `/v1/dashboard/datamodels/{id}/vote` | Update Vote for a Entity |

## docstore

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/docStore` | List Documents |
| `POST` | `/v1/docStore` | Create a Document |
| `PUT` | `/v1/docStore` | Update Document |
| `DELETE` | `/v1/docStore/async/{id}` | Asynchronously delete a Document by id |
| `PATCH` | `/v1/docStore/name/{fqn}` | Update a Document by name. |
| `DELETE` | `/v1/docStore/name/{name}` | Delete a Document by name |
| `GET` | `/v1/docStore/name/{name}` | Get a Document by name |
| `POST` | `/v1/docStore/resetEmailTemplate` | Reset seed data of EmailTemplate type |
| `PUT` | `/v1/docStore/validateTemplate/{templateName}` | Validate Email Template |
| `DELETE` | `/v1/docStore/{id}` | Delete a Document by id |
| `GET` | `/v1/docStore/{id}` | Get a Document by id |
| `PATCH` | `/v1/docStore/{id}` | Update a Document. |
| `GET` | `/v1/docStore/{id}/versions` | List Document versions |
| `GET` | `/v1/docStore/{id}/versions/{version}` | Get a version of the Document |

## domains

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/dataProducts` | List dataProducts |
| `POST` | `/v1/dataProducts` | Create a dataProduct |
| `PUT` | `/v1/dataProducts` | Create or update a dataProduct |
| `GET` | `/v1/dataProducts/assets/counts` | Get all data products with their asset counts |
| `DELETE` | `/v1/dataProducts/async/{id}` | Asynchronously delete a dataProduct by Id |
| `PATCH` | `/v1/dataProducts/name/{fqn}` | Update a dataProduct by name. |
| `GET` | `/v1/dataProducts/name/{fqn}/assets` | Get assets for a data product by name |
| `GET` | `/v1/dataProducts/name/{fqn}/inputPorts` | Get input ports for a data product by name |
| `PUT` | `/v1/dataProducts/name/{fqn}/inputPorts/add` | Bulk Add Input Ports by Name |
| `PUT` | `/v1/dataProducts/name/{fqn}/inputPorts/remove` | Bulk Remove Input Ports by Name |
| `GET` | `/v1/dataProducts/name/{fqn}/odps` | Export data product to ODPS v4.1 format by FQN |
| `GET` | `/v1/dataProducts/name/{fqn}/odps/yaml` | Export data product to ODPS v4.1 YAML format by FQN |
| `GET` | `/v1/dataProducts/name/{fqn}/outputPorts` | Get output ports for a data product by name |
| `PUT` | `/v1/dataProducts/name/{fqn}/outputPorts/add` | Bulk Add Output Ports by Name |
| `PUT` | `/v1/dataProducts/name/{fqn}/outputPorts/remove` | Bulk Remove Output Ports by Name |
| `GET` | `/v1/dataProducts/name/{fqn}/portsView` | Get combined input/output ports view for a data product by name |
| `DELETE` | `/v1/dataProducts/name/{name}` | Delete a dataProduct by name |
| `GET` | `/v1/dataProducts/name/{name}` | Get a dataProduct by name |
| `POST` | `/v1/dataProducts/odps` | Import data product from ODPS v4.1 JSON |
| `PUT` | `/v1/dataProducts/odps` | Create or smart-merge a data product from ODPS v4.1 JSON |
| `POST` | `/v1/dataProducts/odps/validate/yaml` | Validate an ODPS v4.1 YAML document without importing |
| `POST` | `/v1/dataProducts/odps/yaml` | Import data product from ODPS v4.1 YAML |
| `PUT` | `/v1/dataProducts/odps/yaml` | Create or smart-merge a data product from ODPS v4.1 YAML |
| `DELETE` | `/v1/dataProducts/{id}` | Delete a dataProduct by Id |
| `GET` | `/v1/dataProducts/{id}` | Get a dataProduct by Id |
| `PATCH` | `/v1/dataProducts/{id}` | Update a dataProduct |
| `GET` | `/v1/dataProducts/{id}/assets` | Get assets for a data product |
| `GET` | `/v1/dataProducts/{id}/dataContract` | Get data contract for a data product |
| `PUT` | `/v1/dataProducts/{id}/followers` | Add a follower |
| `DELETE` | `/v1/dataProducts/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/dataProducts/{id}/inputPorts` | Get input ports for a data product |
| `GET` | `/v1/dataProducts/{id}/odps` | Export data product to ODPS v4.1 format |
| `GET` | `/v1/dataProducts/{id}/odps/yaml` | Export data product to ODPS v4.1 YAML format |
| `GET` | `/v1/dataProducts/{id}/outputPorts` | Get output ports for a data product |
| `GET` | `/v1/dataProducts/{id}/portsView` | Get combined input/output ports view for a data product |
| `GET` | `/v1/dataProducts/{id}/versions` | List dataProduct versions |
| `GET` | `/v1/dataProducts/{id}/versions/{version}` | Get a version of the dataProduct |
| `PUT` | `/v1/dataProducts/{id}/vote` | Update Vote for an Entity |
| `PUT` | `/v1/dataProducts/{name}/assets/add` | Bulk Add Assets |
| `PUT` | `/v1/dataProducts/{name}/assets/remove` | Bulk Remove Assets |
| `PUT` | `/v1/dataProducts/{name}/inputPorts/add` | Bulk Add Input Ports |
| `PUT` | `/v1/dataProducts/{name}/inputPorts/remove` | Bulk Remove Input Ports |
| `PUT` | `/v1/dataProducts/{name}/outputPorts/add` | Bulk Add Output Ports |
| `PUT` | `/v1/dataProducts/{name}/outputPorts/remove` | Bulk Remove Output Ports |
| `GET` | `/v1/domains` | List domains |
| `POST` | `/v1/domains` | Create a domain |
| `PUT` | `/v1/domains` | Create or update a domain |
| `GET` | `/v1/domains/assets/counts` | Get all domains with their asset counts |
| `DELETE` | `/v1/domains/async/{id}` | Asynchronously delete a domain by Id |
| `GET` | `/v1/domains/hierarchy` | List domains in hierarchical order |
| `PATCH` | `/v1/domains/name/{fqn}` | Update a domain by name. |
| `GET` | `/v1/domains/name/{fqn}/assets` | Get assets for a domain by name |
| `DELETE` | `/v1/domains/name/{name}` | Delete a domain by name |
| `GET` | `/v1/domains/name/{name}` | Get a domain by name |
| `GET` | `/v1/domains/{fqn}/tasks` | List tasks for a domain |
| `DELETE` | `/v1/domains/{id}` | Delete a domain by Id |
| `GET` | `/v1/domains/{id}` | Get a domain by Id |
| `PATCH` | `/v1/domains/{id}` | Update a domain |
| `GET` | `/v1/domains/{id}/assets` | Get assets for a domain |
| `PUT` | `/v1/domains/{id}/followers` | Add a follower |
| `DELETE` | `/v1/domains/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/domains/{id}/versions` | List domain versions |
| `GET` | `/v1/domains/{id}/versions/{version}` | Get a version of the domain |
| `PUT` | `/v1/domains/{id}/vote` | Update Vote for an Entity |
| `PUT` | `/v1/domains/{name}/assets/add` | Bulk Add Assets |
| `PUT` | `/v1/domains/{name}/assets/remove` | Bulk Remove Assets |

## dqtests

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/dataQuality/testCases` | List test cases |
| `POST` | `/v1/dataQuality/testCases` | Create a test case |
| `PUT` | `/v1/dataQuality/testCases` | Update test case |
| `DELETE` | `/v1/dataQuality/testCases/async/{id}` | Asynchronously delete a test case by Id |
| `POST` | `/v1/dataQuality/testCases/createMany` | Create multiple test cases at once |
| `GET` | `/v1/dataQuality/testCases/dimensionResults/{fqn}` | List test case dimensional results |
| `GET` | `/v1/dataQuality/testCases/dimensionResults/{fqn}/dimensions` | List available dimensions for a test case |
| `PUT` | `/v1/dataQuality/testCases/logicalTestCases` | Add test cases to a logical test suite |
| `PUT` | `/v1/dataQuality/testCases/logicalTestCases/bulk` | Add test cases to a logical test suite |
| `DELETE` | `/v1/dataQuality/testCases/logicalTestCases/{testSuiteId}/{id}` | Delete a logical test case by Id from a test suite |
| `DELETE` | `/v1/dataQuality/testCases/name/{fqn}` | Delete a test case by fully qualified name |
| `GET` | `/v1/dataQuality/testCases/name/{fqn}` | Get a test case by fully qualified name |
| `GET` | `/v1/dataQuality/testCases/name/{name}/export` | Export test cases in CSV format |
| `GET` | `/v1/dataQuality/testCases/name/{name}/exportAsync` | Export test cases in CSV format asynchronously |
| `PUT` | `/v1/dataQuality/testCases/name/{name}/import` | Import test cases from CSV |
| `PUT` | `/v1/dataQuality/testCases/name/{name}/importAsync` | Import test cases from CSV asynchronously |
| `PUT` | `/v1/dataQuality/testCases/restore` | Restore a soft deleted test case |
| `GET` | `/v1/dataQuality/testCases/search/list` | List test cases using search service |
| `GET` | `/v1/dataQuality/testCases/testCaseIncidentStatus` | List the test case failure statuses |
| `POST` | `/v1/dataQuality/testCases/testCaseIncidentStatus` | Create a new test case failure status |
| `PUT` | `/v1/dataQuality/testCases/testCaseIncidentStatus/bulk` | Bulk create test case failure statuses |
| `GET` | `/v1/dataQuality/testCases/testCaseIncidentStatus/incidentGroups` | List open incident counts grouped by a dimension |
| `GET` | `/v1/dataQuality/testCases/testCaseIncidentStatus/search/list` | List test case resolution status using search service |
| `GET` | `/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/{stateId}` | Get test case failure statuses for a sequence id |
| `GET` | `/v1/dataQuality/testCases/testCaseIncidentStatus/{id}` | Get test case failure status by id |
| `PATCH` | `/v1/dataQuality/testCases/testCaseIncidentStatus/{id}` | Update an existing test case failure status |
| `GET` | `/v1/dataQuality/testCases/testCaseResults/search/latest` | Latest test case results using search service |
| `GET` | `/v1/dataQuality/testCases/testCaseResults/search/list` | List test case results using search service |
| `GET` | `/v1/dataQuality/testCases/testCaseResults/{fqn}` | List of test case results for a given test case |
| `POST` | `/v1/dataQuality/testCases/testCaseResults/{fqn}` | Add test case result data to a testCase |
| `DELETE` | `/v1/dataQuality/testCases/testCaseResults/{fqn}/{timestamp}` | Delete test case result |
| `PATCH` | `/v1/dataQuality/testCases/testCaseResults/{fqn}/{timestamp}` | Update a test case result |
| `DELETE` | `/v1/dataQuality/testCases/{id}` | Delete a test case by Id |
| `GET` | `/v1/dataQuality/testCases/{id}` | Get a test case by Id |
| `PATCH` | `/v1/dataQuality/testCases/{id}` | Update a test case |
| `DELETE` | `/v1/dataQuality/testCases/{id}/failedRowsSample` | Delete failed rows sample data |
| `GET` | `/v1/dataQuality/testCases/{id}/failedRowsSample` | Get failed rows sample data |
| `PUT` | `/v1/dataQuality/testCases/{id}/failedRowsSample` | Add failed rows sample data |
| `PUT` | `/v1/dataQuality/testCases/{id}/inspectionQuery` | Add inspection query data |
| `GET` | `/v1/dataQuality/testCases/{id}/versions` | List test case versions |
| `GET` | `/v1/dataQuality/testCases/{id}/versions/{version}` | Get a version of the test case |
| `GET` | `/v1/dataQuality/testDefinitions` | List test definitions |
| `POST` | `/v1/dataQuality/testDefinitions` | Create a test definition |
| `PUT` | `/v1/dataQuality/testDefinitions` | Update test definition |
| `DELETE` | `/v1/dataQuality/testDefinitions/async/{id}` | Asynchronously delete a test definition |
| `DELETE` | `/v1/dataQuality/testDefinitions/name/{name}` | Delete a test definition |
| `GET` | `/v1/dataQuality/testDefinitions/name/{name}` | Get a test definition by name |
| `PUT` | `/v1/dataQuality/testDefinitions/restore` | Restore a soft deleted test definition |
| `DELETE` | `/v1/dataQuality/testDefinitions/{id}` | Delete a test definition |
| `GET` | `/v1/dataQuality/testDefinitions/{id}` | Get a test definition by Id |
| `PATCH` | `/v1/dataQuality/testDefinitions/{id}` | Update a test definition |
| `GET` | `/v1/dataQuality/testDefinitions/{id}/versions` | List test definition versions |
| `GET` | `/v1/dataQuality/testDefinitions/{id}/versions/{version}` | Get a version of the test definition |
| `GET` | `/v1/dataQuality/testSuites` | List test suites |
| `POST` | `/v1/dataQuality/testSuites` | Create a logical test suite |
| `PUT` | `/v1/dataQuality/testSuites` | Update logical test suite |
| `DELETE` | `/v1/dataQuality/testSuites/async/{id}` | Delete a logical test suite asynchronously |
| `POST` | `/v1/dataQuality/testSuites/basic` | Create a basic test suite |
| `PUT` | `/v1/dataQuality/testSuites/basic` | Create or Update Basic test suite |
| `DELETE` | `/v1/dataQuality/testSuites/basic/name/{name}` | Delete a test suite |
| `DELETE` | `/v1/dataQuality/testSuites/basic/{id}` | Delete a test suite |
| `GET` | `/v1/dataQuality/testSuites/dataQualityReport` | Get Data Quality Report |
| `POST` | `/v1/dataQuality/testSuites/dataQualityReport/batch` | Run a batch of Data Quality Reports |
| `PUT` | `/v1/dataQuality/testSuites/executable` | Create or Update Executable test suite |
| `DELETE` | `/v1/dataQuality/testSuites/executable/name/{name}` | Delete a test suite |
| `DELETE` | `/v1/dataQuality/testSuites/executable/{id}` | Delete a test suite |
| `GET` | `/v1/dataQuality/testSuites/executionSummary` | Get the execution summary of test suites |
| `DELETE` | `/v1/dataQuality/testSuites/name/{name}` | Delete a logical test suite |
| `GET` | `/v1/dataQuality/testSuites/name/{name}` | Get a test suite by name |
| `PUT` | `/v1/dataQuality/testSuites/restore` | Restore a soft deleted test suite |
| `GET` | `/v1/dataQuality/testSuites/search/list` | List test suite using search service |
| `DELETE` | `/v1/dataQuality/testSuites/{id}` | Delete a logical test suite |
| `GET` | `/v1/dataQuality/testSuites/{id}` | Get a test suite by Id |
| `PATCH` | `/v1/dataQuality/testSuites/{id}` | Update a test suite |
| `GET` | `/v1/dataQuality/testSuites/{id}/versions` | List test suite versions |
| `GET` | `/v1/dataQuality/testSuites/{id}/versions/{version}` | Get a version of the test suite |

## drive

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/contextCenter/drive/files` | List files |
| `POST` | `/v1/contextCenter/drive/files` | Create a file entry |
| `PUT` | `/v1/contextCenter/drive/files` | Create or update a file |
| `POST` | `/v1/contextCenter/drive/files/bulk/delete` | Delete multiple drive files |
| `POST` | `/v1/contextCenter/drive/files/bulk/download` | Download multiple drive files |
| `PUT` | `/v1/contextCenter/drive/files/bulk/move` | Move multiple drive files |
| `GET` | `/v1/contextCenter/drive/files/name/{fqn}` | Get a file by FQN |
| `PUT` | `/v1/contextCenter/drive/files/restore` | Restore a soft deleted drive file |
| `POST` | `/v1/contextCenter/drive/files/upload` | Upload a file to Drive |
| `DELETE` | `/v1/contextCenter/drive/files/{id}` | Delete a file |
| `GET` | `/v1/contextCenter/drive/files/{id}` | Get a file by ID |
| `PATCH` | `/v1/contextCenter/drive/files/{id}` | Update a file via JSON Patch |
| `GET` | `/v1/contextCenter/drive/files/{id}/download` | Download a file by ID |
| `PUT` | `/v1/contextCenter/drive/files/{id}/move` | Move a drive file to a different folder |
| `GET` | `/v1/contextCenter/drive/folders` | List folders |
| `POST` | `/v1/contextCenter/drive/folders` | Create a folder |
| `PUT` | `/v1/contextCenter/drive/folders` | Create or update a folder |
| `GET` | `/v1/contextCenter/drive/folders/name/{fqn}` | Get a folder by FQN |
| `PUT` | `/v1/contextCenter/drive/folders/restore` | Restore a soft deleted drive folder |
| `DELETE` | `/v1/contextCenter/drive/folders/{id}` | Delete a folder |
| `GET` | `/v1/contextCenter/drive/folders/{id}` | Get a folder by ID |
| `PATCH` | `/v1/contextCenter/drive/folders/{id}` | Update a folder via JSON Patch |
| `GET` | `/v1/contextCenter/drive/folders/{id}/contents` | Get the direct contents of a folder |

## drives

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/drives/directories` | List directories |
| `POST` | `/v1/drives/directories` | Create a directory |
| `PUT` | `/v1/drives/directories` | Create or update a directory |
| `DELETE` | `/v1/drives/directories/async/{id}` | Asynchronously delete a directory by Id |
| `PUT` | `/v1/drives/directories/bulk` | Bulk create or update directories |
| `DELETE` | `/v1/drives/directories/deleteStale` | Delete stale directories within a scope |
| `GET` | `/v1/drives/directories/export` | Export directories to CSV |
| `POST` | `/v1/drives/directories/import` | Import directory from CSV |
| `DELETE` | `/v1/drives/directories/name/{fqn}` | Delete a directory by fully qualified name |
| `GET` | `/v1/drives/directories/name/{fqn}` | Get a directory by fully qualified name |
| `PATCH` | `/v1/drives/directories/name/{fqn}` | Update a directory by name. |
| `PUT` | `/v1/drives/directories/restore` | Restore a soft deleted directory by id |
| `DELETE` | `/v1/drives/directories/{id}` | Delete a directory by Id |
| `GET` | `/v1/drives/directories/{id}` | Get a directory by Id |
| `PATCH` | `/v1/drives/directories/{id}` | Update a directory |
| `PUT` | `/v1/drives/directories/{id}/followers` | Add a follower |
| `DELETE` | `/v1/drives/directories/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/drives/directories/{id}/restore` | Restore a soft deleted directory |
| `GET` | `/v1/drives/directories/{id}/versions` | List directory versions |
| `GET` | `/v1/drives/directories/{id}/versions/{version}` | Get a specific version of the directory |
| `PUT` | `/v1/drives/directories/{id}/vote` | Update Vote for a directory |
| `GET` | `/v1/drives/files` | List files |
| `POST` | `/v1/drives/files` | Create a file |
| `PUT` | `/v1/drives/files` | Create or update a file |
| `DELETE` | `/v1/drives/files/async/{id}` | Asynchronously delete a file by Id |
| `PUT` | `/v1/drives/files/bulk` | Bulk create or update files |
| `DELETE` | `/v1/drives/files/deleteStale` | Delete stale files within a scope |
| `DELETE` | `/v1/drives/files/name/{fqn}` | Delete a file by fully qualified name |
| `GET` | `/v1/drives/files/name/{fqn}` | Get a file by fully qualified name |
| `PATCH` | `/v1/drives/files/name/{fqn}` | Update a file by name. |
| `PUT` | `/v1/drives/files/restore` | Restore a soft deleted file by id |
| `DELETE` | `/v1/drives/files/{id}` | Delete a file by Id |
| `GET` | `/v1/drives/files/{id}` | Get a file by Id |
| `PATCH` | `/v1/drives/files/{id}` | Update a file |
| `PUT` | `/v1/drives/files/{id}/followers` | Add a follower |
| `DELETE` | `/v1/drives/files/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/drives/files/{id}/restore` | Restore a soft deleted file |
| `DELETE` | `/v1/drives/files/{id}/sampleData` | Delete sample data |
| `GET` | `/v1/drives/files/{id}/sampleData` | Get sample data |
| `PUT` | `/v1/drives/files/{id}/sampleData` | Add sample data |
| `GET` | `/v1/drives/files/{id}/versions` | List file versions |
| `GET` | `/v1/drives/files/{id}/versions/{version}` | Get a specific version of the file |
| `PUT` | `/v1/drives/files/{id}/vote` | Update Vote for a file |
| `GET` | `/v1/drives/spreadsheets` | List spreadsheets |
| `POST` | `/v1/drives/spreadsheets` | Create a spreadsheet |
| `PUT` | `/v1/drives/spreadsheets` | Create or update a spreadsheet |
| `DELETE` | `/v1/drives/spreadsheets/async/{id}` | Asynchronously delete a spreadsheet by Id |
| `PUT` | `/v1/drives/spreadsheets/bulk` | Bulk create or update spreadsheets |
| `DELETE` | `/v1/drives/spreadsheets/deleteStale` | Delete stale spreadsheets within a scope |
| `DELETE` | `/v1/drives/spreadsheets/name/{fqn}` | Delete a spreadsheet by fully qualified name |
| `GET` | `/v1/drives/spreadsheets/name/{fqn}` | Get a spreadsheet by fully qualified name |
| `PATCH` | `/v1/drives/spreadsheets/name/{fqn}` | Update a spreadsheet by name. |
| `PUT` | `/v1/drives/spreadsheets/restore` | Restore a soft deleted spreadsheet |
| `DELETE` | `/v1/drives/spreadsheets/{id}` | Delete a spreadsheet by Id |
| `GET` | `/v1/drives/spreadsheets/{id}` | Get a spreadsheet by Id |
| `PATCH` | `/v1/drives/spreadsheets/{id}` | Update a spreadsheet |
| `PUT` | `/v1/drives/spreadsheets/{id}/followers` | Add a follower |
| `DELETE` | `/v1/drives/spreadsheets/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/drives/spreadsheets/{id}/versions` | List spreadsheet versions |
| `GET` | `/v1/drives/spreadsheets/{id}/versions/{version}` | Get a specific version of the spreadsheet |
| `PUT` | `/v1/drives/spreadsheets/{id}/vote` | Update Vote for a spreadsheet |
| `GET` | `/v1/drives/worksheets` | List worksheets |
| `POST` | `/v1/drives/worksheets` | Create a worksheet |
| `PUT` | `/v1/drives/worksheets` | Create or update a worksheet |
| `DELETE` | `/v1/drives/worksheets/async/{id}` | Asynchronously delete a worksheet by Id |
| `PUT` | `/v1/drives/worksheets/bulk` | Bulk create or update worksheets |
| `DELETE` | `/v1/drives/worksheets/deleteStale` | Delete stale worksheets within a scope |
| `DELETE` | `/v1/drives/worksheets/name/{fqn}` | Delete a worksheet by fully qualified name |
| `GET` | `/v1/drives/worksheets/name/{fqn}` | Get a worksheet by fully qualified name |
| `PATCH` | `/v1/drives/worksheets/name/{fqn}` | Update a worksheet by name. |
| `PUT` | `/v1/drives/worksheets/restore` | Restore a soft deleted worksheet by id |
| `DELETE` | `/v1/drives/worksheets/{id}` | Delete a worksheet by Id |
| `GET` | `/v1/drives/worksheets/{id}` | Get a worksheet by Id |
| `PATCH` | `/v1/drives/worksheets/{id}` | Update a worksheet |
| `PUT` | `/v1/drives/worksheets/{id}/followers` | Add a follower |
| `DELETE` | `/v1/drives/worksheets/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/drives/worksheets/{id}/versions` | List worksheet versions |
| `GET` | `/v1/drives/worksheets/{id}/versions/{version}` | Get a specific version of the worksheet |
| `PUT` | `/v1/drives/worksheets/{id}/vote` | Update Vote for a worksheet |

## entityProfiles

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/entity/profiles/id/{entityType}/{id}` | Add profile data for an entity |
| `DELETE` | `/v1/entity/profiles/id/{entityType}/{id}/{timestamp}` | Delete profile data for an entity |
| `POST` | `/v1/entity/profiles/name/{entityType}/{fqn}` | Add profile data for an entity |
| `DELETE` | `/v1/entity/profiles/name/{entityType}/{fqn}/{timestamp}` | Delete profile data for an entity |
| `GET` | `/v1/entity/profiles/{entityType}` | List all profile data  |
| `GET` | `/v1/entity/profiles/{entityType}/{fqn}` | List of profiles |

## events

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/events` | Get change events |
| `GET` | `/v1/notificationTemplates` | List notification templates |
| `POST` | `/v1/notificationTemplates` | Create a notification template |
| `PUT` | `/v1/notificationTemplates` | Create or update a notification template |
| `DELETE` | `/v1/notificationTemplates/async/{id}` | Asynchronously delete a notification template by Id |
| `GET` | `/v1/notificationTemplates/helpers` | Get available Handlebars helpers |
| `DELETE` | `/v1/notificationTemplates/name/{fqn}` | Delete a notification template by fully qualified name |
| `GET` | `/v1/notificationTemplates/name/{fqn}` | Get a notification template by fully qualified name |
| `PATCH` | `/v1/notificationTemplates/name/{fqn}` | Update a notification template by name |
| `PUT` | `/v1/notificationTemplates/name/{fqn}/reset` | Reset a notification template to its default state by fully qualified name |
| `POST` | `/v1/notificationTemplates/render` | Render notification template with mock data |
| `PUT` | `/v1/notificationTemplates/restore` | Restore a soft deleted notification template |
| `POST` | `/v1/notificationTemplates/send` | Validate and send notification template to external destinations |
| `POST` | `/v1/notificationTemplates/validate` | Validate notification template syntax |
| `DELETE` | `/v1/notificationTemplates/{id}` | Delete a notification template by Id |
| `GET` | `/v1/notificationTemplates/{id}` | Get a notification template by Id |
| `PATCH` | `/v1/notificationTemplates/{id}` | Update a notification template |
| `PUT` | `/v1/notificationTemplates/{id}/reset` | Reset a notification template to its default state by Id |
| `GET` | `/v1/notificationTemplates/{id}/versions` | List notification template versions |
| `GET` | `/v1/notificationTemplates/{id}/versions/{version}` | Get a version of the notification template |

## events/subscription

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/events/subscriptions` | List all available Event Subscriptions |
| `POST` | `/v1/events/subscriptions` | Create a new Event Subscription |
| `PUT` | `/v1/events/subscriptions` | Updated an existing or create a new Event Subscription |
| `DELETE` | `/v1/events/subscriptions/async/{id}` | Asynchronously delete an Event Subscription by Id |
| `GET` | `/v1/events/subscriptions/history` |  |
| `GET` | `/v1/events/subscriptions/id/{eventSubscriptionId}/destinations` | Get the destinations for a specific Event Subscription |
| `GET` | `/v1/events/subscriptions/id/{id}/failedEvents` | Get failed events for a subscription by id |
| `GET` | `/v1/events/subscriptions/id/{id}/listEvents` | Retrieve events based on various filters |
| `GET` | `/v1/events/subscriptions/id/{id}/listSuccessfullySentChangeEvents` | Get successfully sent change events for an alert |
| `GET` | `/v1/events/subscriptions/id/{subscriptionId}/diagnosticInfo` | Get event subscription diagnostic info |
| `GET` | `/v1/events/subscriptions/id/{subscriptionId}/eventsRecord` | Get event subscription events record |
| `GET` | `/v1/events/subscriptions/listAllFailedEvents` | Get all failed events |
| `GET` | `/v1/events/subscriptions/name/{eventSubscriptionName}` | Get an Event Subscription by name |
| `GET` | `/v1/events/subscriptions/name/{eventSubscriptionName}/destinations` | Get the destinations for a specific Event Subscription by its name |
| `GET` | `/v1/events/subscriptions/name/{eventSubscriptionName}/failedEvents` | Get failed events for a subscription by name |
| `GET` | `/v1/events/subscriptions/name/{eventSubscriptionName}/listSuccessfullySentChangeEvents` | Get successfully sent change events for an alert by name |
| `GET` | `/v1/events/subscriptions/name/{eventSubscriptionName}/status/{destinationId}` | Get Event Subscription status |
| `PUT` | `/v1/events/subscriptions/name/{eventSubscriptionName}/syncOffset` | Sync Offset for a specific Event Subscription by its name |
| `PATCH` | `/v1/events/subscriptions/name/{fqn}` | Update an Event Subscriptions by name. |
| `DELETE` | `/v1/events/subscriptions/name/{name}` | Delete an Event Subscription by name |
| `GET` | `/v1/events/subscriptions/name/{subscriptionName}/diagnosticInfo` | Get event subscription diagnostic info by name |
| `GET` | `/v1/events/subscriptions/name/{subscriptionName}/eventsRecord` | Get event subscription events record by name |
| `POST` | `/v1/events/subscriptions/testDestination` | Send a test message alert to external destinations. |
| `GET` | `/v1/events/subscriptions/{alertType}/resources` | Get list of Event Subscriptions Resources used in filtering Event Subscription |
| `GET` | `/v1/events/subscriptions/{eventSubscriptionId}/status/{destinationId}` | Get Event Subscription status by Id |
| `DELETE` | `/v1/events/subscriptions/{id}` | Delete an Event Subscription by Id |
| `GET` | `/v1/events/subscriptions/{id}` | Get a event Subscription by ID |
| `PATCH` | `/v1/events/subscriptions/{id}` | Update an Event Subscriptions |
| `GET` | `/v1/events/subscriptions/{id}/processedEvents` | Check If the Publisher Processed All Events |
| `GET` | `/v1/events/subscriptions/{id}/versions` | List Event Subscription versions |
| `GET` | `/v1/events/subscriptions/{id}/versions/{version}` | Get a version of the Event Subscription |

## feeds

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/announcements` | List announcements |
| `POST` | `/v1/announcements` | Create an announcement |
| `PUT` | `/v1/announcements` | Create or update an announcement |
| `GET` | `/v1/announcements/name/{fqn}` | Get an announcement by fully qualified name |
| `PUT` | `/v1/announcements/restore` | Restore a soft deleted announcement |
| `DELETE` | `/v1/announcements/{id}` | Delete an announcement |
| `GET` | `/v1/announcements/{id}` | Get an announcement by ID |
| `PATCH` | `/v1/announcements/{id}` | Update an announcement |
| `GET` | `/v1/announcements/{id}/versions` | List announcement versions |
| `GET` | `/v1/announcements/{id}/versions/{version}` | Get a specific version of an announcement |
| `GET` | `/v1/feed` | List threads |
| `POST` | `/v1/feed` | Create a thread |
| `GET` | `/v1/feed/count` | Count of threads |
| `GET` | `/v1/feed/tasks/{id}` | Get a task thread by task Id |
| `PUT` | `/v1/feed/tasks/{id}/close` | Close a task |
| `PUT` | `/v1/feed/tasks/{id}/resolve` | Resolve a task |
| `GET` | `/v1/feed/{id}` | Get a thread by Id |
| `PATCH` | `/v1/feed/{id}` | Update a thread by `Id`. |
| `GET` | `/v1/feed/{id}/posts` | Get all the posts of a thread |
| `POST` | `/v1/feed/{id}/posts` | Add post to a thread |
| `DELETE` | `/v1/feed/{threadId}` | Delete a thread by Id |
| `DELETE` | `/v1/feed/{threadId}/posts/{postId}` | Delete a post from its thread |
| `PATCH` | `/v1/feed/{threadId}/posts/{postId}` | Update post of a thread by `Id`. |
| `GET` | `/v1/taskFormSchemas` | List task form schemas |
| `POST` | `/v1/taskFormSchemas` | Create a task form schema |
| `PUT` | `/v1/taskFormSchemas` | Create or update a task form schema |
| `GET` | `/v1/taskFormSchemas/name/{fqn}` | Get a task form schema by name |
| `PUT` | `/v1/taskFormSchemas/restore` | Restore a soft deleted task form schema |
| `DELETE` | `/v1/taskFormSchemas/{id}` | Delete a task form schema |
| `GET` | `/v1/taskFormSchemas/{id}` | Get a task form schema by ID |
| `PATCH` | `/v1/taskFormSchemas/{id}` | Update a task form schema |
| `GET` | `/v1/taskFormSchemas/{id}/versions` | List task form schema versions |
| `GET` | `/v1/taskFormSchemas/{id}/versions/{version}` | Get a specific version of a task form schema |

## glossary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/glossaries` | List glossaries |
| `POST` | `/v1/glossaries` | Create a glossary |
| `PUT` | `/v1/glossaries` | Create or update a glossary |
| `DELETE` | `/v1/glossaries/async/{id}` | Asynchronously delete a glossary by Id |
| `GET` | `/v1/glossaries/documentation/csv` | Get CSV documentation |
| `PATCH` | `/v1/glossaries/name/{fqn}` | Update a glossary using name. |
| `DELETE` | `/v1/glossaries/name/{name}` | Delete a glossary by name |
| `GET` | `/v1/glossaries/name/{name}` | Get a glossary by name |
| `GET` | `/v1/glossaries/name/{name}/export` | Export glossary in CSV format |
| `GET` | `/v1/glossaries/name/{name}/exportAsync` | Export glossary in CSV format |
| `PUT` | `/v1/glossaries/name/{name}/import` | Import glossary terms from CSV to create, and update glossary terms |
| `PUT` | `/v1/glossaries/name/{name}/importAsync` | Import glossary in CSV format asynchronously |
| `PUT` | `/v1/glossaries/name/{name}/importRdf` | Import an OWL/SKOS ontology (RDF) into glossaries |
| `PUT` | `/v1/glossaries/restore` | Restore a soft deleted glossary |
| `DELETE` | `/v1/glossaries/{id}` | Delete a glossary by Id |
| `GET` | `/v1/glossaries/{id}` | Get a glossary by Id |
| `PATCH` | `/v1/glossaries/{id}` | Update a glossary |
| `GET` | `/v1/glossaries/{id}/versions` | List glossary versions |
| `GET` | `/v1/glossaries/{id}/versions/{version}` | Get a version of the glossaries |
| `PUT` | `/v1/glossaries/{id}/vote` | Update Vote for a Entity |
| `GET` | `/v1/glossaryTerms` | List glossary terms |
| `POST` | `/v1/glossaryTerms` | Create a glossary term |
| `PUT` | `/v1/glossaryTerms` | Create or update a glossary term |
| `GET` | `/v1/glossaryTerms/assets/counts` | Get all glossary terms with their asset counts |
| `DELETE` | `/v1/glossaryTerms/async/{id}` | Asynchronously delete a glossary term by Id |
| `GET` | `/v1/glossaryTerms/byIds` | Get multiple glossary terms by Ids |
| `POST` | `/v1/glossaryTerms/createMany` | Create multiple glossary terms at once |
| `DELETE` | `/v1/glossaryTerms/name/{fqn}` | Delete a glossary term by fully qualified name |
| `GET` | `/v1/glossaryTerms/name/{fqn}` | Get a glossary term by fully qualified name |
| `PATCH` | `/v1/glossaryTerms/name/{fqn}` | Update a glossary term by name. |
| `GET` | `/v1/glossaryTerms/name/{fqn}/assets` | List assets tagged with this glossary term by fully qualified name |
| `GET` | `/v1/glossaryTerms/name/{fqn}/export` | Export glossary term in CSV format |
| `GET` | `/v1/glossaryTerms/name/{fqn}/exportAsync` | Export glossary term in CSV format asynchronously |
| `PUT` | `/v1/glossaryTerms/name/{fqn}/import` | Import glossary terms from CSV |
| `PUT` | `/v1/glossaryTerms/name/{fqn}/importAsync` | Import glossary term from CSV asynchronously |
| `GET` | `/v1/glossaryTerms/relationTypes/usage` | Get usage counts for all relation types |
| `PUT` | `/v1/glossaryTerms/restore` | Restore a soft deleted glossary term |
| `GET` | `/v1/glossaryTerms/search` | Search glossary terms with pagination |
| `DELETE` | `/v1/glossaryTerms/{id}` | Delete a glossary term by Id |
| `GET` | `/v1/glossaryTerms/{id}` | Get a glossary term by Id |
| `PATCH` | `/v1/glossaryTerms/{id}` | Update a glossary term |
| `GET` | `/v1/glossaryTerms/{id}/assets` | List assets tagged with this glossary term |
| `PUT` | `/v1/glossaryTerms/{id}/assets/add` | Bulk Add Glossary Term to Assets |
| `PUT` | `/v1/glossaryTerms/{id}/assets/remove` | Bulk Remove Glossary Term from Assets |
| `PUT` | `/v1/glossaryTerms/{id}/moveAsync` | Move a glossary term to a new parent or glossary |
| `POST` | `/v1/glossaryTerms/{id}/relations` | Add a typed relation to another glossary term |
| `DELETE` | `/v1/glossaryTerms/{id}/relations/{toTermId}` | Remove a relation to another glossary term |
| `GET` | `/v1/glossaryTerms/{id}/relationsGraph` | Get the relation graph for a glossary term |
| `PUT` | `/v1/glossaryTerms/{id}/tags/validate` | Validate Tags Addition to Glossary Term |
| `GET` | `/v1/glossaryTerms/{id}/versions` | List glossary term versions |
| `GET` | `/v1/glossaryTerms/{id}/versions/{version}` | Get a version of the glossary term |
| `PUT` | `/v1/glossaryTerms/{id}/vote` | Update Vote for a Entity |

## governance

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/governance/intakeForms` | List IntakeForms |
| `POST` | `/v1/governance/intakeForms` | Create a new IntakeForm |
| `PUT` | `/v1/governance/intakeForms` | Create or update an IntakeForm |
| `GET` | `/v1/governance/intakeForms/entityType/{entityType}` | Get the IntakeForm configured for a specific entity type |
| `GET` | `/v1/governance/intakeForms/name/{name}` | Get an IntakeForm by name |
| `DELETE` | `/v1/governance/intakeForms/{id}` | Delete an IntakeForm |
| `GET` | `/v1/governance/intakeForms/{id}` | Get an IntakeForm by ID |
| `PATCH` | `/v1/governance/intakeForms/{id}` | Patch an IntakeForm |
| `GET` | `/v1/governance/intakeForms/{id}/versions` | List versions of an IntakeForm |
| `GET` | `/v1/governance/intakeForms/{id}/versions/{version}` | Get a specific version of an IntakeForm |
| `GET` | `/v1/governance/workflowDefinitions` | List Workflow Definitions |
| `POST` | `/v1/governance/workflowDefinitions` | Create a Workflow Definition |
| `PUT` | `/v1/governance/workflowDefinitions` | Create or update Workflow Definition |
| `DELETE` | `/v1/governance/workflowDefinitions/async/{id}` | Asynchronously delete a Workflow Definition by Id |
| `DELETE` | `/v1/governance/workflowDefinitions/name/{fqn}` | Delete a Workflow Definition by fully qualified name |
| `GET` | `/v1/governance/workflowDefinitions/name/{fqn}` | Get a Workflow Definition by fully qualified name |
| `PATCH` | `/v1/governance/workflowDefinitions/name/{fqn}` | Update a Workflow Definition by name. |
| `PUT` | `/v1/governance/workflowDefinitions/name/{fqn}/resume` | Resume a suspended Workflow Definition |
| `PUT` | `/v1/governance/workflowDefinitions/name/{fqn}/suspend` | Suspend a Workflow Definition |
| `POST` | `/v1/governance/workflowDefinitions/name/{fqn}/trigger` | Start a new instance of a Workflow Definition |
| `PUT` | `/v1/governance/workflowDefinitions/restore` | Restore a soft deleted Workflow Definition. |
| `POST` | `/v1/governance/workflowDefinitions/validate` | Validate a Workflow Definition |
| `DELETE` | `/v1/governance/workflowDefinitions/{id}` | Delete a Workflow Definition by Id |
| `GET` | `/v1/governance/workflowDefinitions/{id}` | Get a Workflow Definition by Id |
| `PATCH` | `/v1/governance/workflowDefinitions/{id}` | Update a Workflow Definition by Id |
| `POST` | `/v1/governance/workflowDefinitions/{id}/redeploy` | Get a Workflow Definition by Id |
| `GET` | `/v1/governance/workflowDefinitions/{id}/versions` | List Workflow Definition versions |
| `GET` | `/v1/governance/workflowDefinitions/{id}/versions/{version}` | Get a version of the Workflow Definition |
| `GET` | `/v1/governance/workflowInstanceStates` | List the Workflow Instance States |
| `GET` | `/v1/governance/workflowInstanceStates/{id}` | Get a Workflow Instance State by id |
| `GET` | `/v1/governance/workflowInstanceStates/{workflowDefinitionName}/{workflowInstanceId}` | Get all the Workflow Instance States for a Workflow Instance id |
| `GET` | `/v1/governance/workflowInstances` | List the Workflow Instances |

## knowledge

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/contextCenter/pages` | Get a list of Knowledge Pages |
| `POST` | `/v1/contextCenter/pages` | Create a Knowledge Page |
| `PUT` | `/v1/contextCenter/pages` | Create or update a Knowledge Page |
| `DELETE` | `/v1/contextCenter/pages/async/{id}` | Asynchronously delete a Knowledge Page |
| `GET` | `/v1/contextCenter/pages/hierarchy` | List Page with hierarchy |
| `DELETE` | `/v1/contextCenter/pages/name/{fqn}` | Delete a Knowledge Page |
| `GET` | `/v1/contextCenter/pages/name/{fqn}` | Get a KnowledgePage by name |
| `PUT` | `/v1/contextCenter/pages/restore` | Restore a soft deleted Knowledge Page |
| `GET` | `/v1/contextCenter/pages/search/hierarchy` | List Page with hierarchy from Search |
| `DELETE` | `/v1/contextCenter/pages/{id}` | Delete a Knowledge Page |
| `GET` | `/v1/contextCenter/pages/{id}` | Get a Knowledge Page |
| `PATCH` | `/v1/contextCenter/pages/{id}` | Update a Knowledge Page |
| `PUT` | `/v1/contextCenter/pages/{id}/followers` | Add a follower |
| `DELETE` | `/v1/contextCenter/pages/{id}/followers/{userId}` | Remove a follower |
| `DELETE` | `/v1/contextCenter/pages/{id}/usage` | remove Knowledge Page usage |
| `PUT` | `/v1/contextCenter/pages/{id}/usage` | Add Knowledge Page usage |
| `GET` | `/v1/contextCenter/pages/{id}/versions` | Get List of all KnowledgePage versions |
| `GET` | `/v1/contextCenter/pages/{id}/versions/{version}` | Get a specific version of the KnowledgePage |
| `PUT` | `/v1/contextCenter/pages/{id}/vote` | Update Vote for a this entity |

## kpi

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/kpi` | List KPIs |
| `POST` | `/v1/kpi` | Create a KPI |
| `PUT` | `/v1/kpi` | Update KPI |
| `DELETE` | `/v1/kpi/async/{id}` | Asynchronously delete a KPI by Id |
| `PATCH` | `/v1/kpi/name/{fqn}` | Update a KPI by name. |
| `DELETE` | `/v1/kpi/name/{name}` | Delete a KPI by name |
| `GET` | `/v1/kpi/name/{name}` | Get a KPI by name |
| `PUT` | `/v1/kpi/restore` | Restore a soft deleted KPI |
| `DELETE` | `/v1/kpi/{id}` | Delete a KPI by Id |
| `GET` | `/v1/kpi/{id}` | Get a KPI by Id |
| `PATCH` | `/v1/kpi/{id}` | Update a KPI |
| `GET` | `/v1/kpi/{id}/versions` | List KPI versions |
| `GET` | `/v1/kpi/{id}/versions/{version}` | Get a version of the KPI |
| `GET` | `/v1/kpi/{name}/kpiResult` | List of KPI results |
| `GET` | `/v1/kpi/{name}/latestKpiResult` | Get a latest KPI Result |

## learning

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/learning/resources` | List learning resources |
| `POST` | `/v1/learning/resources` | Create a learning resource |
| `PUT` | `/v1/learning/resources` | Create or update a learning resource |
| `GET` | `/v1/learning/resources/name/{name}` | Get a learning resource by name |
| `PUT` | `/v1/learning/resources/restore` | Restore a soft-deleted learning resource |
| `DELETE` | `/v1/learning/resources/{id}` | Delete a learning resource |
| `GET` | `/v1/learning/resources/{id}` | Get a learning resource by id |
| `PATCH` | `/v1/learning/resources/{id}` | Update a learning resource |
| `GET` | `/v1/learning/resources/{id}/versions` | List learning resource versions |
| `GET` | `/v1/learning/resources/{id}/versions/{version}` | Get a learning resource version |

## limits

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/limits` | Get Limits configuration |
| `GET` | `/v1/limits/features/{name}` | Get Limits configuration for a feature |

## lineage

| Method | Path | Purpose |
|---|---|---|
| `PUT` | `/v1/lineage` | Add a lineage edge |
| `GET` | `/v1/lineage/export` | Export lineage |
| `GET` | `/v1/lineage/exportAsync` | Export lineage |
| `GET` | `/v1/lineage/exportByEntityCountAsync` | Export lineage by entity count |
| `GET` | `/v1/lineage/getDataQualityLineage` | Search Data Quality lineage |
| `GET` | `/v1/lineage/getLineage` | Search lineage |
| `GET` | `/v1/lineage/getLineage/{direction}` | Search lineage with Direction |
| `GET` | `/v1/lineage/getLineageByEntityCount` | Get lineage with entity count based pagination |
| `GET` | `/v1/lineage/getLineageEdge/{fromEntity}/name/{fromFQN}/{toEntity}/name/{toFQN}` | Get a lineage edge by entity FQNs |
| `GET` | `/v1/lineage/getLineageEdge/{fromId}/{toId}` | Get  a lineage edge |
| `GET` | `/v1/lineage/getPaginationInfo` | Get lineage pagination information |
| `GET` | `/v1/lineage/getPlatformLineage` | Get Platform Lineage |
| `POST` | `/v1/lineage/hydrate` | Batch-hydrate lineage nodes into full entity objects |
| `DELETE` | `/v1/lineage/source/name/{entityType}/{entityFQN}/type/{lineageSource}` | Delete lineage edges by type and entity FQN |
| `DELETE` | `/v1/lineage/{entityType}/{entityId}/type/{lineageSource}` | Delete a lineage edge by Type |
| `GET` | `/v1/lineage/{entity}/name/{fqn}` | Get lineage by fully qualified name |
| `GET` | `/v1/lineage/{entity}/{id}` | Get lineage by Id |
| `DELETE` | `/v1/lineage/{fromEntity}/name/{fromFQN}/{toEntity}/name/{toFQN}` | Delete a lineage edge by FQNs |
| `PATCH` | `/v1/lineage/{fromEntity}/name/{fromFQN}/{toEntity}/name/{toFQN}` | Patch a lineage edge by FQNs |
| `PUT` | `/v1/lineage/{fromEntity}/name/{fromFQN}/{toEntity}/name/{toFQN}` | Add a lineage edge by entity FQNs |
| `DELETE` | `/v1/lineage/{fromEntity}/{fromId}/{toEntity}/{toId}` | Delete a lineage edge |
| `PATCH` | `/v1/lineage/{fromEntity}/{fromId}/{toEntity}/{toId}` | Patch a lineage edge |
| `POST` | `/v1/openlineage/lineage` | Receive a single OpenLineage event |
| `POST` | `/v1/openlineage/lineage/batch` | Receive multiple OpenLineage events |

## mcp

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/mcp/usage/breakdown/tools` | Per-tool call counts with errors + latency |
| `GET` | `/v1/mcp/usage/breakdown/users` | Per-user call counts with client name |
| `GET` | `/v1/mcp/usage/history` | Daily MCP usage counts |
| `GET` | `/v1/mcp/usage/me` | Self-service MCP usage counters |
| `GET` | `/v1/mcp/usage/summary` | Get aggregate MCP usage counters |

## metrics

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/metricGroups` | List metric groups |
| `POST` | `/v1/metricGroups` | Create a metric group |
| `PUT` | `/v1/metricGroups` | Create or update a metric group |
| `DELETE` | `/v1/metricGroups/name/{fqn}` | Delete a metric group by fully qualified name |
| `GET` | `/v1/metricGroups/name/{fqn}` | Get a metric group by fully qualified name |
| `PUT` | `/v1/metricGroups/restore` | Restore a soft deleted metric group |
| `DELETE` | `/v1/metricGroups/{id}` | Delete a metric group by Id |
| `GET` | `/v1/metricGroups/{id}` | Get a metric group by Id |
| `PATCH` | `/v1/metricGroups/{id}` | Update a metric group |
| `GET` | `/v1/metricGroups/{id}/metrics` | List Metrics in a Metric Group |
| `GET` | `/v1/metricGroups/{id}/versions` | List metric group versions |
| `GET` | `/v1/metricGroups/{id}/versions/{version}` | Get a version of the metric group |
| `PUT` | `/v1/metricGroups/{name}/metrics/add` | Add metrics to a group |
| `PUT` | `/v1/metricGroups/{name}/metrics/remove` | Remove metrics from a group |
| `GET` | `/v1/metrics` | List metrics |
| `POST` | `/v1/metrics` | Create a Metric |
| `PUT` | `/v1/metrics` | Create or update a metric |
| `DELETE` | `/v1/metrics/async/{id}` | Asynchronously delete a Metric by id |
| `PUT` | `/v1/metrics/bulk` | Bulk create or update metrics |
| `GET` | `/v1/metrics/customUnits` | Get list of custom units of measurement |
| `GET` | `/v1/metrics/documentation/csv` | Get CSV documentation for metric import/export |
| `GET` | `/v1/metrics/hierarchy` | List top-level Metric hierarchy entries |
| `DELETE` | `/v1/metrics/name/{fqn}` | Delete a Metric by fully qualified name |
| `GET` | `/v1/metrics/name/{fqn}` | Get a Metric by fully qualified name. |
| `PATCH` | `/v1/metrics/name/{fqn}` | Update a Metric using name. |
| `GET` | `/v1/metrics/name/{name}/export` | Export metrics in CSV format |
| `GET` | `/v1/metrics/name/{name}/exportAsync` | Export metrics in CSV format asynchronously |
| `PUT` | `/v1/metrics/name/{name}/import` | Import metrics from CSV to create or update metrics |
| `PUT` | `/v1/metrics/name/{name}/importAsync` | Import metrics from CSV asynchronously |
| `PUT` | `/v1/metrics/restore` | Restore a soft deleted Metric. |
| `DELETE` | `/v1/metrics/{id}` | Delete a Metric by id |
| `GET` | `/v1/metrics/{id}` | Get a metric by Id |
| `PATCH` | `/v1/metrics/{id}` | Update a Metric |
| `GET` | `/v1/metrics/{id}/assets` | List a metric's linked assets with their lineage direction |
| `PUT` | `/v1/metrics/{id}/followers` | Add a follower |
| `DELETE` | `/v1/metrics/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/metrics/{id}/hierarchy` | Get the hierarchy context for one Metric |
| `GET` | `/v1/metrics/{id}/observability` | Get a metric's health rollup |
| `GET` | `/v1/metrics/{id}/versions` | List Metric versions |
| `GET` | `/v1/metrics/{id}/versions/{version}` | Get a version of the Metric |
| `PUT` | `/v1/metrics/{id}/vote` | Update Vote for a Metric |
| `PUT` | `/v1/metrics/{name}/assets/add` | Link data assets to a metric |
| `PUT` | `/v1/metrics/{name}/assets/remove` | Unlink data assets from a metric |

## mlmodels

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/mlmodels` | List ML models |
| `POST` | `/v1/mlmodels` | Create an ML model |
| `PUT` | `/v1/mlmodels` | Create or update an ML model |
| `DELETE` | `/v1/mlmodels/async/{id}` | Asynchronously delete an ML model by Id |
| `PUT` | `/v1/mlmodels/bulk` | Bulk create or update ML models |
| `DELETE` | `/v1/mlmodels/deleteStale` | Delete stale mlmodels within a scope |
| `DELETE` | `/v1/mlmodels/name/{fqn}` | Delete a ML model by fully qualified name |
| `GET` | `/v1/mlmodels/name/{fqn}` | Get an ML model by fully qualified name |
| `PATCH` | `/v1/mlmodels/name/{fqn}` | Update an ML model by name. |
| `PUT` | `/v1/mlmodels/restore` | Restore a soft deleted ML model |
| `DELETE` | `/v1/mlmodels/{id}` | Delete an ML model by Id |
| `GET` | `/v1/mlmodels/{id}` | Get an ML model by Id |
| `PATCH` | `/v1/mlmodels/{id}` | Update an ML model |
| `PUT` | `/v1/mlmodels/{id}/followers` | Add a follower |
| `DELETE` | `/v1/mlmodels/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/mlmodels/{id}/versions` | List ML model versions |
| `GET` | `/v1/mlmodels/{id}/versions/{version}` | Get a version of the ML model |
| `PUT` | `/v1/mlmodels/{id}/vote` | Update Vote for a Entity |

## permissions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/permissions` | Get permissions for logged in user |
| `GET` | `/v1/permissions/debug/evaluate` | Debug permission evaluation for a specific operation |
| `GET` | `/v1/permissions/debug/me` | Debug permissions for the current user |
| `GET` | `/v1/permissions/debug/user/{username}` | Debug permissions for a user |
| `GET` | `/v1/permissions/policies` | Get permissions for a set of policies |
| `GET` | `/v1/permissions/view/{entityType}` | Get permissions for a given entity type at field level. |
| `GET` | `/v1/permissions/{resource}` | Get permissions a given resource/entity type for logged in user |
| `GET` | `/v1/permissions/{resource}/name/{name}` | Get permissions for a given entity name for a logged in user |
| `GET` | `/v1/permissions/{resource}/{id}` | Get permissions for a given entity for a logged in user |

## pipelines

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/pipelines` | List pipelines |
| `POST` | `/v1/pipelines` | Create a pipeline |
| `PUT` | `/v1/pipelines` | Create or update a pipeline |
| `DELETE` | `/v1/pipelines/async/{id}` | Asynchronously delete a pipeline by Id |
| `PUT` | `/v1/pipelines/bulk` | Bulk create or update pipelines |
| `DELETE` | `/v1/pipelines/deleteStale` | Delete stale pipelines within a scope |
| `GET` | `/v1/pipelines/executionTrend` | Get pipeline execution trend |
| `GET` | `/v1/pipelines/metrics` | Get aggregated pipeline metrics |
| `DELETE` | `/v1/pipelines/name/{fqn}` | Delete a pipeline by fully qualified name |
| `GET` | `/v1/pipelines/name/{fqn}` | Get a pipeline by fully qualified name |
| `PATCH` | `/v1/pipelines/name/{fqn}` | Update a pipeline by name. |
| `GET` | `/v1/pipelines/name/{fqn}/observability` | Get pipeline observability data |
| `PUT` | `/v1/pipelines/restore` | Restore a soft deleted pipeline |
| `GET` | `/v1/pipelines/runtimeTrend` | Get pipeline runtime trend |
| `GET` | `/v1/pipelines/summary` | List pipeline summaries with impacted assets count |
| `GET` | `/v1/pipelines/{fqn}/status` | List pipeline status |
| `PUT` | `/v1/pipelines/{fqn}/status` | Add status data |
| `PUT` | `/v1/pipelines/{fqn}/status/bulk` | Add bulk status data |
| `DELETE` | `/v1/pipelines/{fqn}/status/{timestamp}` | Delete pipeline status |
| `DELETE` | `/v1/pipelines/{id}` | Delete a pipeline by Id |
| `GET` | `/v1/pipelines/{id}` | Get a pipeline by Id |
| `PATCH` | `/v1/pipelines/{id}` | Update a pipeline |
| `PUT` | `/v1/pipelines/{id}/followers` | Add a follower |
| `DELETE` | `/v1/pipelines/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/pipelines/{id}/versions` | List pipeline versions |
| `GET` | `/v1/pipelines/{id}/versions/{version}` | Get a version of the pipeline |
| `PUT` | `/v1/pipelines/{id}/vote` | Update Vote for a Entity |

## policies

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/policies` | List policies |
| `POST` | `/v1/policies` | Create a policy |
| `PUT` | `/v1/policies` | Create or update a policy |
| `DELETE` | `/v1/policies/async/{id}` | Asynchronously delete a policy by Id |
| `GET` | `/v1/policies/functions` | Get list of policy functions used in authoring conditions in policy rules. |
| `DELETE` | `/v1/policies/name/{fqn}` | Delete a policy by fully qualified name |
| `GET` | `/v1/policies/name/{fqn}` | Get a policy by fully qualified name |
| `PATCH` | `/v1/policies/name/{fqn}` | Update a policy by name. |
| `GET` | `/v1/policies/resources` | Get list of policy resources used in authoring a policy |
| `PUT` | `/v1/policies/restore` | Restore a soft deleted policy |
| `GET` | `/v1/policies/validation/condition/{expression}` | Validate a given condition |
| `DELETE` | `/v1/policies/{id}` | Delete a policy by Id |
| `GET` | `/v1/policies/{id}` | Get a policy by id |
| `PATCH` | `/v1/policies/{id}` | Update a policy |
| `GET` | `/v1/policies/{id}/versions` | List policy versions |
| `GET` | `/v1/policies/{id}/versions/{version}` | Get a version of the policy by Id |

## query

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/queries` | Get a list of Queries |
| `POST` | `/v1/queries` | Create a query |
| `PUT` | `/v1/queries` | Create or update a query |
| `DELETE` | `/v1/queries/async/{id}` | Asynchronously delete a query |
| `PUT` | `/v1/queries/bulk` | Bulk create or update queries |
| `DELETE` | `/v1/queries/name/{fqn}` | Delete a query |
| `GET` | `/v1/queries/name/{fqn}` | Get a query by name |
| `PATCH` | `/v1/queries/name/{fqn}` | Update a query using name. |
| `PUT` | `/v1/queries/restore` | Restore a soft deleted Query |
| `DELETE` | `/v1/queries/{id}` | Delete a query |
| `GET` | `/v1/queries/{id}` | Get a query |
| `PATCH` | `/v1/queries/{id}` | Update a query |
| `PUT` | `/v1/queries/{id}/followers` | Add a follower |
| `DELETE` | `/v1/queries/{id}/followers/{userId}` | Remove a follower |
| `DELETE` | `/v1/queries/{id}/usage` | remove query used in |
| `PUT` | `/v1/queries/{id}/usage` | Add query usage |
| `PUT` | `/v1/queries/{id}/usedBy` | Populate Used By Field |
| `PUT` | `/v1/queries/{id}/users` | Add query users |
| `GET` | `/v1/queries/{id}/versions` | Get List of all query versions |
| `GET` | `/v1/queries/{id}/versions/{version}` | Get a specific version of the query |
| `PUT` | `/v1/queries/{id}/vote` | Update Vote for a Entity |
| `POST` | `/v1/queryCostRecord` | Create query cost record |
| `GET` | `/v1/queryCostRecord/service/{serviceName}` | Get Query Cost By Service |
| `GET` | `/v1/queryCostRecord/{id}` | Get query cost record by id |

## rdf

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/rdf/debug/glossary-relations` | Debug glossary term relations in RDF |
| `GET` | `/v1/rdf/entity/{entityType}/{id}` | Get entity as RDF |
| `GET` | `/v1/rdf/glossary/graph` | Get glossary term relationship graph |
| `GET` | `/v1/rdf/glossary/{id}/export` | Export glossary as ontology |
| `GET` | `/v1/rdf/graph/explore` | Explore entity graph |
| `GET` | `/v1/rdf/graph/explore/export` | Export explored entity graph |
| `GET` | `/v1/rdf/inference/lineage/{entityId}` | Get full lineage with inference |
| `GET` | `/v1/rdf/search/recommendations/{userId}` | Get personalized recommendations |
| `GET` | `/v1/rdf/search/semantic` | Semantic search across entities |
| `GET` | `/v1/rdf/search/similar/{entityType}/{id}` | Find similar entities |
| `GET` | `/v1/rdf/sparql` | Execute SPARQL query via GET |
| `POST` | `/v1/rdf/sparql` | Execute SPARQL query via POST |
| `POST` | `/v1/rdf/sparql/update` | Execute SPARQL UPDATE |
| `POST` | `/v1/rdf/sql/query` | Execute SQL query over RDF data |
| `POST` | `/v1/rdf/sql/translate` | Translate SQL to SPARQL |
| `GET` | `/v1/rdf/status` | Get RDF service status |

## reports

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/reports` | List reports |
| `POST` | `/v1/reports` | Create a report |
| `PUT` | `/v1/reports` | Create or update a report |
| `GET` | `/v1/reports/{id}` | Get a report by Id |
| `PUT` | `/v1/reports/{id}/vote` | Update Vote for a Entity |

## scim

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/scim` | Get SCIM Service Provider Config |
| `GET` | `/v1/scim/Groups` | List SCIM groups |
| `POST` | `/v1/scim/Groups` | Create SCIM group |
| `DELETE` | `/v1/scim/Groups/{id}` | Delete SCIM group |
| `GET` | `/v1/scim/Groups/{id}` | Get SCIM group by ID |
| `PATCH` | `/v1/scim/Groups/{id}` | Patch SCIM group |
| `PUT` | `/v1/scim/Groups/{id}` | Update SCIM group |
| `GET` | `/v1/scim/Schemas` | Get SCIM schemas |
| `GET` | `/v1/scim/ServiceProviderConfig` | Alias endpoint for SCIM Service Provider Config |
| `GET` | `/v1/scim/Users` | List SCIM users |
| `POST` | `/v1/scim/Users` | Create SCIM user |
| `DELETE` | `/v1/scim/Users/{id}` | Delete SCIM user |
| `GET` | `/v1/scim/Users/{id}` | Get SCIM user by ID |
| `PATCH` | `/v1/scim/Users/{id}` | Patch SCIM user |
| `PUT` | `/v1/scim/Users/{id}` | Update SCIM user |

## search

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/search/aggregate` | Get aggregated fields |
| `POST` | `/v1/search/aggregate` | Get aggregated Search Request |
| `GET` | `/v1/search/entityTypeCounts` | Get exact entity type counts |
| `GET` | `/v1/search/export` | Export search results as CSV (streaming) |
| `GET` | `/v1/search/export/async` | Export search results as a background CSV job |
| `GET` | `/v1/search/fieldQuery` | Search entities |
| `GET` | `/v1/search/get/{index}/doc/{id}` | Search entities in ES index with Id |
| `GET` | `/v1/search/nlq/query` | Search entities using Natural Language Query (NLQ) |
| `POST` | `/v1/search/preview` | Preview Search Results |
| `GET` | `/v1/search/query` | Search entities |
| `GET` | `/v1/search/reindex/failures` | Get reindex failures |
| `POST` | `/v1/search/reindexEntities` | Only Reindex the selected entities in Elasticsearch. |
| `GET` | `/v1/search/sourceUrl` | Search entities |
| `GET` | `/v1/search/stats` | Get search cluster statistics |
| `DELETE` | `/v1/search/stats/orphan` | Clean orphan indexes |
| `PUT` | `/v1/search/templates` | Sync all index templates |
| `PUT` | `/v1/search/templates/{entityType}` | Sync index template for a specific entity type |
| `GET` | `/v1/search/vector/fingerprint` | Get vector fingerprint |
| `POST` | `/v1/search/vector/query` | Vector semantic search |

## searchindex

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/searchIndexes` | List searchIndexes |
| `POST` | `/v1/searchIndexes` | Create a SearchIndex |
| `PUT` | `/v1/searchIndexes` | Update SearchIndex |
| `DELETE` | `/v1/searchIndexes/async/{id}` | Asynchronously delete a SearchIndex by id |
| `PUT` | `/v1/searchIndexes/bulk` | Bulk create or update search indexes |
| `DELETE` | `/v1/searchIndexes/deleteStale` | Delete stale searchindexes within a scope |
| `DELETE` | `/v1/searchIndexes/name/{fqn}` | Delete a SearchIndex by fully qualified name |
| `GET` | `/v1/searchIndexes/name/{fqn}` | Get a SearchIndex by fully qualified name |
| `PATCH` | `/v1/searchIndexes/name/{fqn}` | Update a SearchIndex using name. |
| `PUT` | `/v1/searchIndexes/restore` | Restore a soft deleted SearchIndex |
| `DELETE` | `/v1/searchIndexes/{id}` | Delete a SearchIndex by id |
| `GET` | `/v1/searchIndexes/{id}` | Get a SearchIndex by id |
| `PATCH` | `/v1/searchIndexes/{id}` | Update a SearchIndex |
| `PUT` | `/v1/searchIndexes/{id}/followers` | Add a follower |
| `DELETE` | `/v1/searchIndexes/{id}/followers/{userId}` | Remove a follower |
| `GET` | `/v1/searchIndexes/{id}/sampleData` | Get sample data |
| `PUT` | `/v1/searchIndexes/{id}/sampleData` | Add sample data |
| `GET` | `/v1/searchIndexes/{id}/versions` | List SearchIndex versions |
| `GET` | `/v1/searchIndexes/{id}/versions/{version}` | Get a version of the SearchIndex |
| `PUT` | `/v1/searchIndexes/{id}/vote` | Update Vote for a Entity |

## services

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/overview` | Get service counts and one merged, name-sorted page of services |

## services/apiservices

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/apiServices` | List API services |
| `POST` | `/v1/services/apiServices` | Create API service |
| `PUT` | `/v1/services/apiServices` | Update API service |
| `DELETE` | `/v1/services/apiServices/async/{id}` | Asynchronously delete an API service |
| `DELETE` | `/v1/services/apiServices/name/{fqn}` | Delete an APIService by fully qualified name |
| `PATCH` | `/v1/services/apiServices/name/{fqn}` | Update an API service using name. |
| `GET` | `/v1/services/apiServices/name/{name}` | Get API service by name |
| `PUT` | `/v1/services/apiServices/restore` | Restore a soft deleted API Service. |
| `DELETE` | `/v1/services/apiServices/{id}` | Delete an API service |
| `GET` | `/v1/services/apiServices/{id}` | Get an API service |
| `PATCH` | `/v1/services/apiServices/{id}` | Update an API service |
| `PUT` | `/v1/services/apiServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/apiServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/apiServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/apiServices/{id}/versions` | List API service versions |
| `GET` | `/v1/services/apiServices/{id}/versions/{version}` | Get a version of the API service |

## services/connections

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/testConnectionDefinitions` | List test connection definitions |
| `GET` | `/v1/services/testConnectionDefinitions/name/{name}` | Get a test connection definition by name |
| `GET` | `/v1/services/testConnectionDefinitions/{id}` | Get a test connection definition by Id |

## services/dashboard

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/dashboardServices` | List dashboard services |
| `POST` | `/v1/services/dashboardServices` | Create a dashboard service |
| `PUT` | `/v1/services/dashboardServices` | Update a dashboard service |
| `DELETE` | `/v1/services/dashboardServices/async/{id}` | Asynchronously delete a dashboard service by Id |
| `PATCH` | `/v1/services/dashboardServices/name/{fqn}` | Update a dashboard service using name. |
| `DELETE` | `/v1/services/dashboardServices/name/{name}` | Delete a dashboard service by name |
| `GET` | `/v1/services/dashboardServices/name/{name}` | Get dashboard service by name |
| `PUT` | `/v1/services/dashboardServices/restore` | Restore a soft deleted dashboard service |
| `DELETE` | `/v1/services/dashboardServices/{id}` | Delete a dashboard service by Id |
| `GET` | `/v1/services/dashboardServices/{id}` | Get a dashboard service by Id |
| `PATCH` | `/v1/services/dashboardServices/{id}` | Update a dashboard service |
| `PUT` | `/v1/services/dashboardServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/dashboardServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/dashboardServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/dashboardServices/{id}/versions` | List dashboard service versions |
| `GET` | `/v1/services/dashboardServices/{id}/versions/{version}` | Get a version of the dashboard service |

## services/database

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/databaseServices` | List database services |
| `POST` | `/v1/services/databaseServices` | Create database service |
| `PUT` | `/v1/services/databaseServices` | Update database service |
| `DELETE` | `/v1/services/databaseServices/async/{id}` | Asynchronously delete a database service by Id |
| `PATCH` | `/v1/services/databaseServices/name/{fqn}` | Update a database service using name. |
| `DELETE` | `/v1/services/databaseServices/name/{name}` | Delete a database service by name |
| `GET` | `/v1/services/databaseServices/name/{name}` | Get database service by name |
| `GET` | `/v1/services/databaseServices/name/{name}/export` | Export database service in CSV format |
| `GET` | `/v1/services/databaseServices/name/{name}/exportAsync` | Export database service in CSV format |
| `PUT` | `/v1/services/databaseServices/name/{name}/import` | Import service from CSV to update database service (no creation allowed) |
| `PUT` | `/v1/services/databaseServices/name/{name}/importAsync` | Import service from CSV to update database service asynchronously (no creation allowed) |
| `PUT` | `/v1/services/databaseServices/restore` | Restore a soft deleted database service |
| `DELETE` | `/v1/services/databaseServices/{id}` | Delete a database service by Id |
| `GET` | `/v1/services/databaseServices/{id}` | Get a database service |
| `PATCH` | `/v1/services/databaseServices/{id}` | Update a database service |
| `PUT` | `/v1/services/databaseServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/databaseServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/databaseServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/databaseServices/{id}/versions` | List database service versions |
| `GET` | `/v1/services/databaseServices/{id}/versions/{version}` | Get a version of the database service |

## services/drive

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/driveServices` | List drive services |
| `POST` | `/v1/services/driveServices` | Create a drive service |
| `PUT` | `/v1/services/driveServices` | Update drive service |
| `DELETE` | `/v1/services/driveServices/async/{id}` | Asynchronously delete a drive service by Id |
| `GET` | `/v1/services/driveServices/name/{fqn}` | Get a drive service by name |
| `DELETE` | `/v1/services/driveServices/name/{name}` | Delete a drive service by name |
| `GET` | `/v1/services/driveServices/name/{name}/export` | Export drive service in CSV format |
| `PUT` | `/v1/services/driveServices/name/{name}/import` | Import service from CSV to update drive service (no creation allowed) |
| `PUT` | `/v1/services/driveServices/restore` | Restore a soft deleted drive service |
| `DELETE` | `/v1/services/driveServices/{id}` | Delete a drive service by Id |
| `GET` | `/v1/services/driveServices/{id}` | Get a drive service |
| `PATCH` | `/v1/services/driveServices/{id}` | Update a drive service |
| `PUT` | `/v1/services/driveServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/driveServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/driveServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/driveServices/{id}/versions` | List drive service versions |
| `GET` | `/v1/services/driveServices/{id}/versions/{version}` | Get a version of the drive service |

## services/ingestionpipelines

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/ingestionPipelines` | List ingestion pipelines for metadata operations |
| `POST` | `/v1/services/ingestionPipelines` | Create an ingestion pipeline |
| `PUT` | `/v1/services/ingestionPipelines` | Create or update an ingestion pipeline |
| `DELETE` | `/v1/services/ingestionPipelines/async/{id}` | Asynchronously delete an ingestion pipeline by Id |
| `POST` | `/v1/services/ingestionPipelines/bulk/deploy` | Bulk deploy a list of Ingestion Pipeline |
| `POST` | `/v1/services/ingestionPipelines/deploy/{id}` | Deploy an ingestion pipeline run |
| `GET` | `/v1/services/ingestionPipelines/ip` | Check the airflow REST host IP |
| `POST` | `/v1/services/ingestionPipelines/kill/{id}` | Mark as failed and kill any not-finished workflow or task for the ingestion pipeline |
| `GET` | `/v1/services/ingestionPipelines/logs/{fqn}` | List available runs for a pipeline |
| `GET` | `/v1/services/ingestionPipelines/logs/{fqn}/stream/{runId}` | Stream logs for a pipeline run |
| `GET` | `/v1/services/ingestionPipelines/logs/{fqn}/{runId}` | Get logs for a pipeline run |
| `POST` | `/v1/services/ingestionPipelines/logs/{fqn}/{runId}` | Write logs for a pipeline run |
| `POST` | `/v1/services/ingestionPipelines/logs/{fqn}/{runId}/close` | Close log stream for a pipeline run |
| `GET` | `/v1/services/ingestionPipelines/logs/{id}/last` | Retrieve all logs from last ingestion pipeline run |
| `GET` | `/v1/services/ingestionPipelines/logs/{id}/last/download` | Download all logs from last ingestion pipeline run as a stream |
| `POST` | `/v1/services/ingestionPipelines/metrics/{fqn}/{runId}` | Submit operation metrics batch |
| `DELETE` | `/v1/services/ingestionPipelines/name/{fqn}` | Delete an ingestion pipeline by fully qualified name |
| `GET` | `/v1/services/ingestionPipelines/name/{fqn}` | Get an ingestion pipeline by fully qualified name |
| `PATCH` | `/v1/services/ingestionPipelines/name/{fqn}` | Update an ingestion pipeline using name. |
| `GET` | `/v1/services/ingestionPipelines/progress/service/{serviceType}/{serviceFqn}/stream` | Stream progress for all pipelines of a service |
| `GET` | `/v1/services/ingestionPipelines/progress/{fqn}/stream/{runId}` | Stream progress updates for a pipeline run |
| `PUT` | `/v1/services/ingestionPipelines/progress/{fqn}/{runId}` | Update pipeline progress |
| `PUT` | `/v1/services/ingestionPipelines/restore` | Restore a soft deleted ingestion pipeline |
| `GET` | `/v1/services/ingestionPipelines/status` | Check the airflow REST status |
| `POST` | `/v1/services/ingestionPipelines/toggleIngestion/{id}` | Set an ingestion pipeline either as enabled or disabled |
| `POST` | `/v1/services/ingestionPipelines/trigger/{id}` | Trigger an ingestion pipeline run |
| `GET` | `/v1/services/ingestionPipelines/{fqn}/pipelineStatus` | List of pipeline status |
| `PUT` | `/v1/services/ingestionPipelines/{fqn}/pipelineStatus` | Add pipeline status |
| `GET` | `/v1/services/ingestionPipelines/{fqn}/pipelineStatus/{id}` | Get pipeline status |
| `DELETE` | `/v1/services/ingestionPipelines/{id}` | Delete an ingestion pipeline by Id |
| `GET` | `/v1/services/ingestionPipelines/{id}` | Get an ingestion pipeline by Id |
| `PATCH` | `/v1/services/ingestionPipelines/{id}` | Update an ingestion pipeline |
| `PUT` | `/v1/services/ingestionPipelines/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/ingestionPipelines/{id}/followers/{userId}` | Remove a follower |
| `DELETE` | `/v1/services/ingestionPipelines/{id}/pipelineStatus` | Delete Pipeline Status |
| `DELETE` | `/v1/services/ingestionPipelines/{id}/pipelineStatus/{runId}` | Delete pipeline status by run ID |
| `GET` | `/v1/services/ingestionPipelines/{id}/versions` | List ingestion workflow versions |
| `GET` | `/v1/services/ingestionPipelines/{id}/versions/{version}` | Get a version of the ingestion pipeline |

## services/llm

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/llmServices` | List LLM services |
| `POST` | `/v1/services/llmServices` | Create LLM service |
| `PUT` | `/v1/services/llmServices` | Update LLM service |
| `DELETE` | `/v1/services/llmServices/async/{id}` | Asynchronously delete an LLM service by Id |
| `PATCH` | `/v1/services/llmServices/name/{fqn}` | Update an LLM service using name. |
| `DELETE` | `/v1/services/llmServices/name/{name}` | Delete an LLM service by name |
| `GET` | `/v1/services/llmServices/name/{name}` | Get LLM service by name |
| `PUT` | `/v1/services/llmServices/restore` | Restore a soft deleted LLM service |
| `DELETE` | `/v1/services/llmServices/{id}` | Delete an LLM service by Id |
| `GET` | `/v1/services/llmServices/{id}` | Get an LLM service |
| `PATCH` | `/v1/services/llmServices/{id}` | Update an LLM service |
| `PUT` | `/v1/services/llmServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/llmServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/llmServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/llmServices/{id}/versions` | List LLM service versions |
| `GET` | `/v1/services/llmServices/{id}/versions/{version}` | Get a version of the LLM service |

## services/mcp

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/mcpServices` | List MCP services |
| `POST` | `/v1/services/mcpServices` | Create MCP service |
| `PUT` | `/v1/services/mcpServices` | Update MCP service |
| `DELETE` | `/v1/services/mcpServices/async/{id}` | Asynchronously delete an MCP service by Id |
| `PATCH` | `/v1/services/mcpServices/name/{fqn}` | Update an MCP service using name. |
| `DELETE` | `/v1/services/mcpServices/name/{name}` | Delete an MCP service by name |
| `GET` | `/v1/services/mcpServices/name/{name}` | Get MCP service by name |
| `PUT` | `/v1/services/mcpServices/restore` | Restore a soft deleted MCP service |
| `DELETE` | `/v1/services/mcpServices/{id}` | Delete an MCP service by Id |
| `GET` | `/v1/services/mcpServices/{id}` | Get an MCP service |
| `PATCH` | `/v1/services/mcpServices/{id}` | Update an MCP service |
| `PUT` | `/v1/services/mcpServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/mcpServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/mcpServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/mcpServices/{id}/versions` | List MCP service versions |
| `GET` | `/v1/services/mcpServices/{id}/versions/{version}` | Get a version of the MCP service |

## services/messaging

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/messagingServices` | List messaging services |
| `POST` | `/v1/services/messagingServices` | Create a messaging service |
| `PUT` | `/v1/services/messagingServices` | Update messaging service |
| `DELETE` | `/v1/services/messagingServices/async/{id}` | Asynchronously delete a messaging service by Id |
| `PATCH` | `/v1/services/messagingServices/name/{fqn}` | Update a messaging service using name. |
| `DELETE` | `/v1/services/messagingServices/name/{name}` | Delete a messaging service by name |
| `GET` | `/v1/services/messagingServices/name/{name}` | Get messaging service by name |
| `PUT` | `/v1/services/messagingServices/restore` | Restore a soft deleted messaging service |
| `DELETE` | `/v1/services/messagingServices/{id}` | Delete a messaging service by Id |
| `GET` | `/v1/services/messagingServices/{id}` | Get a messaging service by Id |
| `PATCH` | `/v1/services/messagingServices/{id}` | Update a messaging service |
| `PUT` | `/v1/services/messagingServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/messagingServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/messagingServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/messagingServices/{id}/versions` | List messaging service versions |
| `GET` | `/v1/services/messagingServices/{id}/versions/{version}` | Get a version of the messaging service |

## services/metadata

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/metadataServices` | List metadata services |
| `POST` | `/v1/services/metadataServices` | Create metadata service |
| `PUT` | `/v1/services/metadataServices` | Update metadata service |
| `DELETE` | `/v1/services/metadataServices/async/{id}` | Asynchronously delete a metadata service by Id |
| `PATCH` | `/v1/services/metadataServices/name/{fqn}` | Update a metadata service using name. |
| `DELETE` | `/v1/services/metadataServices/name/{name}` | Delete a metadata service by name |
| `GET` | `/v1/services/metadataServices/name/{name}` | Get a metadata service by name |
| `PUT` | `/v1/services/metadataServices/restore` | Restore a soft deleted metadata service. |
| `DELETE` | `/v1/services/metadataServices/{id}` | Delete a metadata service by Id |
| `GET` | `/v1/services/metadataServices/{id}` | Get a metadata service by Id |
| `PATCH` | `/v1/services/metadataServices/{id}` | Update a metadata service |
| `PUT` | `/v1/services/metadataServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/metadataServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/metadataServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/metadataServices/{id}/versions` | List metadata service versions |
| `GET` | `/v1/services/metadataServices/{id}/versions/{version}` | Get a version of the metadata service |

## services/mlmodel

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/mlmodelServices` | List ML model services |
| `POST` | `/v1/services/mlmodelServices` | Create an ML model service |
| `PUT` | `/v1/services/mlmodelServices` | Update ML model service |
| `DELETE` | `/v1/services/mlmodelServices/async/{id}` | Asynchronously delete an ML model service by Id |
| `PATCH` | `/v1/services/mlmodelServices/name/{fqn}` | Update an ML model service using name. |
| `DELETE` | `/v1/services/mlmodelServices/name/{name}` | Delete an ML model service by name |
| `GET` | `/v1/services/mlmodelServices/name/{name}` | Get an ML model service by name |
| `PUT` | `/v1/services/mlmodelServices/restore` | Restore a soft deleted ML model service |
| `DELETE` | `/v1/services/mlmodelServices/{id}` | Delete an ML model service by Id |
| `GET` | `/v1/services/mlmodelServices/{id}` | Get an ML model service by Id |
| `PATCH` | `/v1/services/mlmodelServices/{id}` | Update an ML model service |
| `PUT` | `/v1/services/mlmodelServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/mlmodelServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/mlmodelServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/mlmodelServices/{id}/versions` | List ML model service versions |
| `GET` | `/v1/services/mlmodelServices/{id}/versions/{version}` | Get a version of the ML model service |

## services/pipeline

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/pipelineServices` | List pipeline services |
| `POST` | `/v1/services/pipelineServices` | Create a pipeline service |
| `PUT` | `/v1/services/pipelineServices` | Update pipeline service |
| `DELETE` | `/v1/services/pipelineServices/async/{id}` | Asynchronously delete a pipeline service by Id |
| `DELETE` | `/v1/services/pipelineServices/name/{fqn}` | Delete a pipeline service by fully qualified name |
| `GET` | `/v1/services/pipelineServices/name/{fqn}` | Get pipeline service by fully qualified name |
| `PATCH` | `/v1/services/pipelineServices/name/{fqn}` | Update a pipeline service using name. |
| `PUT` | `/v1/services/pipelineServices/restore` | Restore a soft deleted pipeline service. |
| `DELETE` | `/v1/services/pipelineServices/{id}` | Delete a pipeline service by Id |
| `GET` | `/v1/services/pipelineServices/{id}` | Get a pipeline service by Id |
| `PATCH` | `/v1/services/pipelineServices/{id}` | Update a pipeline service |
| `PUT` | `/v1/services/pipelineServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/pipelineServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/pipelineServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/pipelineServices/{id}/versions` | List pipeline service versions |
| `GET` | `/v1/services/pipelineServices/{id}/versions/{version}` | Get a version of the pipeline service |

## services/searchIndexes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/searchServices` | List search services |
| `POST` | `/v1/services/searchServices` | Create search service |
| `PUT` | `/v1/services/searchServices` | Update search service |
| `DELETE` | `/v1/services/searchServices/async/{id}` | Asynchronously delete an search service |
| `DELETE` | `/v1/services/searchServices/name/{fqn}` | Delete an SearchService by fully qualified name |
| `PATCH` | `/v1/services/searchServices/name/{fqn}` | Update an search service using name. |
| `GET` | `/v1/services/searchServices/name/{name}` | Get search service by name |
| `PUT` | `/v1/services/searchServices/restore` | Restore a soft deleted SearchService. |
| `DELETE` | `/v1/services/searchServices/{id}` | Delete an search service |
| `GET` | `/v1/services/searchServices/{id}` | Get an search service |
| `PATCH` | `/v1/services/searchServices/{id}` | Update an search service |
| `PUT` | `/v1/services/searchServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/searchServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/searchServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/searchServices/{id}/versions` | List search service versions |
| `GET` | `/v1/services/searchServices/{id}/versions/{version}` | Get a version of the search service |

## services/security

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/securityServices` | List security services |
| `POST` | `/v1/services/securityServices` | Create security service |
| `PUT` | `/v1/services/securityServices` | Update security service |
| `DELETE` | `/v1/services/securityServices/async/{id}` | Asynchronously delete a security service by Id |
| `PATCH` | `/v1/services/securityServices/name/{fqn}` | Update a security service using name. |
| `DELETE` | `/v1/services/securityServices/name/{name}` | Delete a security service by name |
| `GET` | `/v1/services/securityServices/name/{name}` | Get security service by name |
| `GET` | `/v1/services/securityServices/name/{name}/export` | Export security service in CSV format |
| `GET` | `/v1/services/securityServices/name/{name}/exportAsync` | Export security service in CSV format |
| `PUT` | `/v1/services/securityServices/name/{name}/import` | Import service from CSV to update security service (no creation allowed) |
| `PUT` | `/v1/services/securityServices/name/{name}/importAsync` | Import service from CSV to update security service asynchronously (no creation allowed) |
| `PUT` | `/v1/services/securityServices/restore` | Restore a soft deleted security service |
| `DELETE` | `/v1/services/securityServices/{id}` | Delete a security service by Id |
| `GET` | `/v1/services/securityServices/{id}` | Get a security service |
| `PATCH` | `/v1/services/securityServices/{id}` | Update a security service |
| `PUT` | `/v1/services/securityServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/securityServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/securityServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/securityServices/{id}/versions` | List security service versions |
| `GET` | `/v1/services/securityServices/{id}/versions/{version}` | Get a version of the security service |

## services/storage

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/services/storageServices` | List storage services |
| `POST` | `/v1/services/storageServices` | Create storage service |
| `PUT` | `/v1/services/storageServices` | Update storage service |
| `DELETE` | `/v1/services/storageServices/async/{id}` | Asynchronously delete an storage service |
| `DELETE` | `/v1/services/storageServices/name/{fqn}` | Delete an StorageService by fully qualified name |
| `PATCH` | `/v1/services/storageServices/name/{fqn}` | Update an storage service by FQN |
| `GET` | `/v1/services/storageServices/name/{name}` | Get storage service by name |
| `PUT` | `/v1/services/storageServices/restore` | Restore a soft deleted StorageService. |
| `DELETE` | `/v1/services/storageServices/{id}` | Delete an storage service |
| `GET` | `/v1/services/storageServices/{id}` | Get an storage service |
| `PATCH` | `/v1/services/storageServices/{id}` | Update an storage service |
| `PUT` | `/v1/services/storageServices/{id}/followers` | Add a follower |
| `DELETE` | `/v1/services/storageServices/{id}/followers/{userId}` | Remove a follower |
| `PUT` | `/v1/services/storageServices/{id}/testConnectionResult` | Add test connection result |
| `GET` | `/v1/services/storageServices/{id}/versions` | List storage service versions |
| `GET` | `/v1/services/storageServices/{id}/versions/{version}` | Get a version of the storage service |

## storages

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/containers` | List Containers |
| `POST` | `/v1/containers` | Create a Container |
| `PUT` | `/v1/containers` | Create or update a Container |
| `DELETE` | `/v1/containers/async/{id}` | Asynchronously delete a Container |
| `PUT` | `/v1/containers/bulk` | Bulk create or update containers |
| `DELETE` | `/v1/containers/deleteStale` | Delete stale containers within a scope |
| `DELETE` | `/v1/containers/name/{fqn}` | Delete a Container by fully qualified name |
| `GET` | `/v1/containers/name/{fqn}` | Get an Container by name |
| `PATCH` | `/v1/containers/name/{fqn}` | Update a Container using name. |
| `GET` | `/v1/containers/name/{fqn}/ancestors` | List ancestor containers (parent chain) |
| `GET` | `/v1/containers/name/{fqn}/children` | List children containers |
| `PUT` | `/v1/containers/restore` | Restore a soft deleted Container. |
| `DELETE` | `/v1/containers/{id}` | Delete a Container |
| `GET` | `/v1/containers/{id}` | Get an Object Store Container |
| `PATCH` | `/v1/containers/{id}` | Update a Container |
| `PUT` | `/v1/containers/{id}/followers` | Add a follower |
| `DELETE` | `/v1/containers/{id}/followers/{userId}` | Remove a follower |
| `DELETE` | `/v1/containers/{id}/sampleData` | Delete sample data |
| `GET` | `/v1/containers/{id}/sampleData` | Get sample data |
| `PUT` | `/v1/containers/{id}/sampleData` | Add sample data |
| `GET` | `/v1/containers/{id}/versions` | List Container versions |
| `GET` | `/v1/containers/{id}/versions/{version}` | Get a version of the Container |
| `PUT` | `/v1/containers/{id}/vote` | Update Vote for a Entity |

## system

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` |  |
| `POST` | `/v1/system/cache/invalidate` | Invalidate cache keys matching a pattern (admin) |
| `POST` | `/v1/system/cache/invalidate/entity` | Invalidate every cache layer for a single entity (admin) |
| `GET` | `/v1/system/cache/keys` | SCAN keys matching a pattern (admin) |
| `GET` | `/v1/system/cache/stats` | Get cache statistics |
| `GET` | `/v1/system/config` |  |
| `GET` | `/v1/system/config` | Get Custom Ui Theme Preference |
| `GET` | `/v1/system/config` | Get JWKS public key |
| `GET` | `/v1/system/config` | Get Login configuration |
| `GET` | `/v1/system/config` | Get Pipeline Service Client configuration |
| `GET` | `/v1/system/config` | Get auth configuration |
| `GET` | `/v1/system/config` | Get authorizer configuration |
| `GET` | `/v1/system/diagnostics` | Get system diagnostics |
| `PUT` | `/v1/system/email/test` | Sends a Test Email |
| `GET` | `/v1/system/entities/count` | List all entities counts |
| `GET` | `/v1/system/health` | Health check endpoint |
| `GET` | `/v1/system/mcp/config` | Get MCP server configuration |
| `PUT` | `/v1/system/mcp/config` | Update MCP server configuration |
| `GET` | `/v1/system/search/fitness` | Diagnose whether the search cluster is sized for current data |
| `GET` | `/v1/system/search/nlq` | Check if Nlq is enabled in elastic search setting |
| `GET` | `/v1/system/security/config` | Get complete security configuration |
| `PATCH` | `/v1/system/security/config` | Patch security configuration |
| `PUT` | `/v1/system/security/config` | Update complete security configuration |
| `POST` | `/v1/system/security/test-login/validate-token` | Validate an OIDC id_token against a candidate security configuration |
| `POST` | `/v1/system/security/validate` | Validate security configuration |
| `GET` | `/v1/system/services/count` | List all services counts |
| `GET` | `/v1/system/settings` | List all settings |
| `PUT` | `/v1/system/settings` | Update setting |
| `GET` | `/v1/system/settings/customLogicOps` | Get a list of custom JSON logic operations |
| `GET` | `/v1/system/settings/entityRulesSettings/{entityType}` | Get a setting for an entity type |
| `GET` | `/v1/system/settings/glossaryTermRelationSettings/relationTypes` | List glossary term relation types |
| `POST` | `/v1/system/settings/glossaryTermRelationSettings/relationTypes` | Create a glossary term relation type |
| `DELETE` | `/v1/system/settings/glossaryTermRelationSettings/relationTypes/{name}` | Delete a glossary term relation type |
| `PUT` | `/v1/system/settings/glossaryTermRelationSettings/relationTypes/{name}` | Update a glossary term relation type |
| `GET` | `/v1/system/settings/profilerConfiguration` | Get profiler configuration setting |
| `PUT` | `/v1/system/settings/reset/{name}` | Reset a setting to default |
| `GET` | `/v1/system/settings/{name}` | Get a setting |
| `PATCH` | `/v1/system/settings/{settingName}` | Patch a setting |
| `GET` | `/v1/system/status` | Validate the OpenMetadata deployment |

## tags

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/classifications` | List classifications |
| `POST` | `/v1/classifications` | Create a classification |
| `PUT` | `/v1/classifications` | Update a classification |
| `DELETE` | `/v1/classifications/async/{id}` | Asynchronously delete classification by id |
| `PATCH` | `/v1/classifications/name/{fqn}` | Update a classification using name. |
| `DELETE` | `/v1/classifications/name/{name}` | Delete classification by name |
| `GET` | `/v1/classifications/name/{name}` | Get a classification by name |
| `PUT` | `/v1/classifications/restore` | Restore a soft deleted classification |
| `DELETE` | `/v1/classifications/{id}` | Delete classification by id |
| `GET` | `/v1/classifications/{id}` | Get a classification by id |
| `PATCH` | `/v1/classifications/{id}` | Update a classification |
| `GET` | `/v1/classifications/{id}/versions` | List classification versions |
| `GET` | `/v1/classifications/{id}/versions/{version}` | Get a version of the classification |
| `GET` | `/v1/tags` | List tags |
| `POST` | `/v1/tags` | Create a tag |
| `PUT` | `/v1/tags` | Create or update a tag |
| `GET` | `/v1/tags/assets/counts` | Get all tags with their asset counts |
| `DELETE` | `/v1/tags/async/{id}` | Asynchronously delete a tag by id |
| `GET` | `/v1/tags/feedback/pending` | Get all pending feedback |
| `GET` | `/v1/tags/feedback/{id}` | Get feedback by ID |
| `DELETE` | `/v1/tags/name/{fqn}` | Delete a tag by fully qualified name |
| `GET` | `/v1/tags/name/{fqn}` | Get a tag by fully qualified name |
| `PATCH` | `/v1/tags/name/{fqn}` | Update a tag using name. |
| `GET` | `/v1/tags/name/{fqn}/assets` | List assets tagged with this tag by fully qualified name |
| `GET` | `/v1/tags/name/{fqn}/feedback` | Get all feedback for a tag |
| `POST` | `/v1/tags/name/{fqn}/feedback` | Submit feedback on auto-applied tag |
| `GET` | `/v1/tags/name/{fqn}/recognizers` | Lists a tag's recognizers |
| `PUT` | `/v1/tags/restore` | Restore a soft deleted tag. |
| `DELETE` | `/v1/tags/{id}` | Delete a tag by id |
| `GET` | `/v1/tags/{id}` | Get a tag by id |
| `PATCH` | `/v1/tags/{id}` | Update a tag |
| `GET` | `/v1/tags/{id}/assets` | List assets tagged with this tag |
| `PUT` | `/v1/tags/{id}/assets/add` | Bulk Add Classification Tag to Assets |
| `PUT` | `/v1/tags/{id}/assets/remove` | Bulk Remove Tag from Assets |
| `GET` | `/v1/tags/{id}/recognizers` | Lists a tag's recognizers |
| `GET` | `/v1/tags/{id}/versions` | List tag versions |
| `GET` | `/v1/tags/{id}/versions/{version}` | Get a version of the tags |

## tasks

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/tasks` | List tasks |
| `POST` | `/v1/tasks` | Create a task |
| `PUT` | `/v1/tasks` | Create or update a task |
| `GET` | `/v1/tasks/assigned` | List tasks assigned to the current user |
| `POST` | `/v1/tasks/bulk` | Perform bulk operations on tasks |
| `GET` | `/v1/tasks/count` | Get task counts by status |
| `GET` | `/v1/tasks/created` | List tasks created by the current user |
| `GET` | `/v1/tasks/dataAccessRequests` | List data access requests |
| `GET` | `/v1/tasks/name/{taskId}` | Get a task by task ID |
| `GET` | `/v1/tasks/owned` | List tasks for entities owned by the current user |
| `GET` | `/v1/tasks/visible` | List tasks visible to the current user |
| `DELETE` | `/v1/tasks/{id}` | Delete a task |
| `GET` | `/v1/tasks/{id}` | Get a task by id |
| `PATCH` | `/v1/tasks/{id}` | Update a task |
| `POST` | `/v1/tasks/{id}/close` | Close a task without resolution |
| `POST` | `/v1/tasks/{id}/comments` | Add a comment to a task |
| `DELETE` | `/v1/tasks/{id}/comments/{commentId}` | Delete a task comment |
| `PATCH` | `/v1/tasks/{id}/comments/{commentId}` | Edit a task comment |
| `POST` | `/v1/tasks/{id}/resolve` | Resolve a task |
| `PUT` | `/v1/tasks/{id}/suggestion/apply` | Apply a suggestion task |
| `GET` | `/v1/tasks/{id}/versions` | List task versions |
| `GET` | `/v1/tasks/{id}/versions/{version}` | Get a specific version of the task |

## teams

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/personas` | List personas |
| `POST` | `/v1/personas` | Create a Persona |
| `PUT` | `/v1/personas` | Update Persona |
| `DELETE` | `/v1/personas/async/{id}` | Asynchronously delete a Persona by id |
| `GET` | `/v1/personas/me/context` | Get the materialized AI context for the caller's active persona |
| `PATCH` | `/v1/personas/name/{fqn}` | Update a Persona using name. |
| `GET` | `/v1/personas/name/{fqn}/context` | Get the materialized AI context for a persona by name |
| `DELETE` | `/v1/personas/name/{name}` | Delete a Persona by name |
| `GET` | `/v1/personas/name/{name}` | Get a Persona by name |
| `GET` | `/v1/personas/search` | Search personas |
| `DELETE` | `/v1/personas/{id}` | Delete a Persona by id |
| `GET` | `/v1/personas/{id}` | Get a persona by id |
| `PATCH` | `/v1/personas/{id}` | Update a Persona |
| `GET` | `/v1/personas/{id}/aiContext` | Get a persona AI context configuration |
| `PUT` | `/v1/personas/{id}/aiContext` | Update persona AI context settings |
| `GET` | `/v1/personas/{id}/aiContext/document` | Get the compiled persona AI context document |
| `POST` | `/v1/personas/{id}/aiContext/document:refresh` | Force recompilation of a persona AI context document |
| `POST` | `/v1/personas/{id}/aiContext/rules` | Create a persona AI context rule |
| `POST` | `/v1/personas/{id}/aiContext/rules/preview` | Preview the entities matched by a persona AI context rule |
| `DELETE` | `/v1/personas/{id}/aiContext/rules/{ruleId:[0-9a-fA-F\\-]{36}}` | Delete a persona AI context rule |
| `PUT` | `/v1/personas/{id}/aiContext/rules/{ruleId:[0-9a-fA-F\\-]{36}}` | Update a persona AI context rule |
| `GET` | `/v1/personas/{id}/context` | Get the materialized AI context for a persona by id |
| `GET` | `/v1/personas/{id}/versions` | List Persona versions |
| `GET` | `/v1/personas/{id}/versions/{version}` | Get a version of the Persona |
| `GET` | `/v1/roles` | List roles |
| `POST` | `/v1/roles` | Create a role |
| `PUT` | `/v1/roles` | Update role |
| `DELETE` | `/v1/roles/async/{id}` | Asynchronously delete a role |
| `PATCH` | `/v1/roles/name/{fqn}` | Update a role using name. |
| `DELETE` | `/v1/roles/name/{name}` | Delete a role |
| `GET` | `/v1/roles/name/{name}` | Get a role by name |
| `PUT` | `/v1/roles/restore` | Restore a soft deleted role |
| `GET` | `/v1/roles/search` | Search roles |
| `DELETE` | `/v1/roles/{id}` | Delete a role |
| `GET` | `/v1/roles/{id}` | Get a role by id |
| `PATCH` | `/v1/roles/{id}` | Update a role |
| `GET` | `/v1/roles/{id}/versions` | List role versions |
| `GET` | `/v1/roles/{id}/versions/{version}` | Get a version of the role |
| `GET` | `/v1/teams` | List teams |
| `POST` | `/v1/teams` | Create a team |
| `PUT` | `/v1/teams` | Update team |
| `GET` | `/v1/teams/assets/counts` | Get all teams with their asset counts |
| `DELETE` | `/v1/teams/async/{id}` | Asynchronously delete a team by id |
| `GET` | `/v1/teams/documentation/csv` | Get CSV documentation for team import/export |
| `GET` | `/v1/teams/hierarchy` | List teams with hierarchy |
| `PATCH` | `/v1/teams/name/{fqn}` | Update a team using name. |
| `GET` | `/v1/teams/name/{fqn}/assets` | List assets owned by this team by fully qualified name |
| `DELETE` | `/v1/teams/name/{name}` | Delete a team by name |
| `GET` | `/v1/teams/name/{name}` | Get a team by name |
| `GET` | `/v1/teams/name/{name}/export` | Export teams in CSV format |
| `GET` | `/v1/teams/name/{name}/exportAsync` | Export teams in CSV format |
| `PUT` | `/v1/teams/name/{name}/import` | Import from CSV to create, and update teams. |
| `PUT` | `/v1/teams/name/{name}/importAsync` | Import from CSV to create, and update teams asynchronously. |
| `PUT` | `/v1/teams/restore` | Restore a soft deleted team |
| `DELETE` | `/v1/teams/{id}` | Delete a team by id |
| `GET` | `/v1/teams/{id}` | Get a team by id |
| `PATCH` | `/v1/teams/{id}` | Update a team |
| `GET` | `/v1/teams/{id}/assets` | List assets owned by this team |
| `GET` | `/v1/teams/{id}/versions` | List team versions |
| `GET` | `/v1/teams/{id}/versions/{version}` | Get a version of the team |
| `PUT` | `/v1/teams/{name}/assets/add` | Bulk Add Assets |
| `PUT` | `/v1/teams/{name}/assets/remove` | Bulk Remove Assets |
| `PUT` | `/v1/teams/{teamId}/users` | Update team users |
| `DELETE` | `/v1/teams/{teamId}/users/{userId}` | Remove a user from a team |
| `GET` | `/v1/users` | List users |
| `POST` | `/v1/users` | Create a user |
| `PUT` | `/v1/users` | Update user |
| `DELETE` | `/v1/users/async/{id}` | Asynchronously delete a user |
| `GET` | `/v1/users/auth-mechanism/{id}` | Get Authentication Mechanism for a Bot User |
| `PUT` | `/v1/users/changePassword` | Change Password For User |
| `POST` | `/v1/users/checkEmailVerified` | Check if a mail is verified |
| `GET` | `/v1/users/documentation/csv` | Get CSV documentation for user import/export |
| `GET` | `/v1/users/export` | Export users in a team in CSV format |
| `GET` | `/v1/users/exportAsync` | Export users in a team in CSV format |
| `POST` | `/v1/users/generatePasswordResetLink` | Generate Password Reset Link |
| `GET` | `/v1/users/generateRandomPwd` | Generate a random password |
| `POST` | `/v1/users/generateToken` | Generate JWT Token for a User |
| `PUT` | `/v1/users/generateToken/{id}` | Generate JWT Token for a Bot User |
| `PUT` | `/v1/users/import` | Import from CSV to create, and update teams. |
| `PUT` | `/v1/users/importAsync` | Import from CSV to create, and update teams asynchronously. |
| `GET` | `/v1/users/loggedInUser` | Get current logged in user |
| `GET` | `/v1/users/loggedInUser/groupTeams` | Get group type of teams for current logged in user |
| `POST` | `/v1/users/login` | Login User with email (plain-text) and Password (encoded in base 64) |
| `POST` | `/v1/users/logout` | Logout a User(Only called for saml and basic Auth) |
| `DELETE` | `/v1/users/name/{name}` | Delete a user |
| `GET` | `/v1/users/name/{name}` | Get a user by name |
| `GET` | `/v1/users/name/{name}/assets` | List assets owned by this user or their teams by name |
| `GET` | `/v1/users/online` | List online users |
| `POST` | `/v1/users/password/reset` | Reset Password For User |
| `POST` | `/v1/users/refresh` | Provide access token to User with refresh token |
| `PUT` | `/v1/users/registrationConfirmation` | Confirm User Email |
| `PUT` | `/v1/users/resendRegistrationToken` | Resend Registration Token |
| `PUT` | `/v1/users/restore` | Restore a soft deleted User. |
| `PUT` | `/v1/users/revokeToken` | Revoke JWT Token for a Bot User |
| `GET` | `/v1/users/security/token` | Get personal access token to User |
| `PUT` | `/v1/users/security/token` | Provide access token to User |
| `PUT` | `/v1/users/security/token/revoke` | Revoke personal access token to User |
| `POST` | `/v1/users/signup` | Register User |
| `GET` | `/v1/users/token/{id}` | Get JWT Token for a Bot User |
| `DELETE` | `/v1/users/{id}` | Delete a user |
| `GET` | `/v1/users/{id}` | Get a user |
| `PATCH` | `/v1/users/{id}` | Update a user |
| `GET` | `/v1/users/{id}/assets` | List assets owned by this user or their teams |
| `GET` | `/v1/users/{id}/versions` | List user versions |
| `GET` | `/v1/users/{id}/versions/{version}` | Get a version of the user |
| `GET` | `/v1/users/{userId}/preferences` | Get user preferences |
| `DELETE` | `/v1/users/{userId}/preferences/{type}` | Delete a user preference |
| `PUT` | `/v1/users/{userId}/preferences/{type}` | Create or replace a user preference |

## testsupport

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/test-support/search/alias` | Backing indices for an alias |
| `GET` | `/v1/test-support/search/cluster-alias` | The server's configured search cluster alias (index name prefix) |
| `GET` | `/v1/test-support/search/count` | Document count for an index/alias |
| `POST` | `/v1/test-support/search/count` | Document count for an index/alias matching a query |
| `GET` | `/v1/test-support/search/exists` | Whether an index or alias exists |
| `GET` | `/v1/test-support/search/indices` | Index names matching a pattern (_cat/indices) |
| `GET` | `/v1/test-support/search/mapping` | Mapping for an index/alias |
| `POST` | `/v1/test-support/search/search` | Search an index/alias with a query body |

## topics

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/topics` | List topics |
| `POST` | `/v1/topics` | Create a topic |
| `PUT` | `/v1/topics` | Update topic |
| `DELETE` | `/v1/topics/async/{id}` | Asynchronously delete a topic by id |
| `PUT` | `/v1/topics/bulk` | Bulk create or update topics |
| `DELETE` | `/v1/topics/deleteStale` | Delete stale topics within a scope |
| `DELETE` | `/v1/topics/name/{fqn}` | Delete a topic by fully qualified name |
| `GET` | `/v1/topics/name/{fqn}` | Get a topic by fully qualified name |
| `PATCH` | `/v1/topics/name/{fqn}` | Update a topic using name. |
| `PUT` | `/v1/topics/restore` | Restore a soft deleted topic |
| `DELETE` | `/v1/topics/{id}` | Delete a topic by id |
| `GET` | `/v1/topics/{id}` | Get a topic by id |
| `PATCH` | `/v1/topics/{id}` | Update a topic |
| `PUT` | `/v1/topics/{id}/followers` | Add a follower |
| `DELETE` | `/v1/topics/{id}/followers/{userId}` | Remove a follower |
| `DELETE` | `/v1/topics/{id}/sampleData` | Delete sample data |
| `GET` | `/v1/topics/{id}/sampleData` | Get sample data |
| `PUT` | `/v1/topics/{id}/sampleData` | Add sample data |
| `GET` | `/v1/topics/{id}/versions` | List topic versions |
| `GET` | `/v1/topics/{id}/versions/{version}` | Get a version of the topic |
| `PUT` | `/v1/topics/{id}/vote` | Update Vote for a Entity |

## types

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/metadata/types` | List types |
| `POST` | `/v1/metadata/types` | Create a custom property definition |
| `PUT` | `/v1/metadata/types` | Create or update a type |
| `DELETE` | `/v1/metadata/types/async/{id}` | Asynchronously delete a type by id |
| `GET` | `/v1/metadata/types/customProperties` |  |
| `GET` | `/v1/metadata/types/fields/{entityType}` |  |
| `GET` | `/v1/metadata/types/name/{entityType}/customProperties` | Get custom properties for an entity type |
| `PATCH` | `/v1/metadata/types/name/{fqn}` | Update a type using name. |
| `DELETE` | `/v1/metadata/types/name/{name}` | Delete a type by name |
| `GET` | `/v1/metadata/types/name/{name}` | Get a type by name |
| `DELETE` | `/v1/metadata/types/{id}` | Delete a type by id |
| `GET` | `/v1/metadata/types/{id}` | Get a type |
| `PATCH` | `/v1/metadata/types/{id}` | Update a type |
| `PUT` | `/v1/metadata/types/{id}` | Add or update a Property to an entity |
| `GET` | `/v1/metadata/types/{id}/versions` | List type versions |
| `GET` | `/v1/metadata/types/{id}/versions/{version}` | Get a version of the types |

## usage

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/usage/compute.percentile/{entity}/{date}` | Compute percentiles |
| `GET` | `/v1/usage/{entity}/name/{fqn}` | Get usage by fully qualified name |
| `POST` | `/v1/usage/{entity}/name/{fqn}` | Report usage by fully qualified name |
| `PUT` | `/v1/usage/{entity}/name/{fqn}` | Report usage by fully qualified name |
| `GET` | `/v1/usage/{entity}/{id}` | Get usage by id |
| `POST` | `/v1/usage/{entity}/{id}` | Report usage |
| `PUT` | `/v1/usage/{entity}/{id}` | Report usage |

## version

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/system/version` | Get version of metadata service |
