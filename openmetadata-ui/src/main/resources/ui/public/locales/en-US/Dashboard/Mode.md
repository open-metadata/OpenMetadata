# Mode

In this section, we provide guides and references to use the Mode connector.

## Requirements

OpenMetadata relies on Mode's API, which is exclusive to members of the Mode Business Workspace. This means that only resources that belong to a Mode Business Workspace can be accessed via the API.

You can find further information on the Mode connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/mode" target="_blank">docs</a>.

## Metadata Mapping

- Mode reports are ingested as dashboards.
- Report visualizations are ingested as charts.
- Each query associated with a report is ingested as a dashboard data model. The data model includes the query name, SQL text, and a link to the query in Mode. Mode's query response does not include result-column metadata, so query data models have an empty column list.
- When the query SQL can be parsed and its source tables can be resolved, lineage is created from the tables to the query data model and then to the report dashboard. If data model ingestion is disabled or a query data model is filtered out, lineage is created directly from the tables to the dashboard.

The connector can only ingest spaces, reports, queries, charts, and data sources visible to the API token. Ensure the token's workspace member has access to every space and report that should be cataloged. See Mode's <a href="https://mode.com/developer/api-cookbook/management/get-all-reports/" target="_blank">report API guide</a> and <a href="https://mode.com/developer/api-reference/analytics/queries/" target="_blank">query API reference</a> for the source API behavior.

## Connection Details

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Mode server. This should be specified as a URI string in the format `https://app.mode.com`.
$$

$$section
### Access Token $(id="accessToken")

Get the Access Token by following these steps:
1. Navigate to your Mode instance homepage.
2. Click on your name in the upper left corner and click `My Account`.
3. Click on `API Tokens` on the left side.
4. To generate a new API token and password, enter a token name and click `Create token`.
5. Copy the generated access token and password.

For detailed information, you can visit the official <a href="https://mode.com/developer/api-reference/introduction/" target="_blank">docs</a>.
$$

$$section
### Access Token Password $(id="accessTokenPassword")

Copy the access token password from the step above where a new token is generated.

For detailed information, you can visit the official <a href="https://mode.com/developer/api-reference/introduction/" target="_blank">docs</a>.
$$

$$section
### Workspace Name $(id="workspaceName")

Name of the Mode workspace.
$$

$$section
### Filter Query Param $(id="filterQueryParam")

This value is the `filter` query parameter passed to Mode's spaces API when discovering reports.
The supported values are `all` and `custom`. If this field is left empty, `all` will be used.

$$
