# Rill

In this section, we provide guides and references to use the Rill connector.

## Metadata

The connector ingests Rill Explores and Canvases as dashboards, Canvas
components as charts, and Rill Models and Metrics Views as dashboard data
models. When data model ingestion is enabled, it also reports model
dependencies and Metrics View-to-dashboard lineage.

## Connection Details

$$section
### Host and Port $(id="hostPort")

The URL of the Rill runtime that hosts the project to ingest. For Rill Cloud,
use the project endpoint:
`https://api.rilldata.com/v1/orgs/<organization>/projects/<project>`.

For a local Rill Developer project, this is typically
`http://localhost:9009`.

Branch-level project URLs (ending in `/branch/<branch>`) are not supported
yet; use the project endpoint without a branch segment.
$$

$$section
### API Token $(id="token")

A bearer token used to authenticate requests to the Rill runtime. This token
is **required** when connecting to a Rill Cloud project. Leave it empty when
connecting to a local Rill Developer runtime that does not require
authentication.
$$
