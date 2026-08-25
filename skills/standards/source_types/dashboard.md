# Dashboard Connector Standards

## Base Class
`DashboardServiceSource` in `ingestion/src/metadata/ingestion/source/dashboard/dashboard_service.py`

## Reference Connector
`ingestion/src/metadata/ingestion/source/dashboard/metabase/`

## Entity Hierarchy
```
DashboardService → Dashboard → Chart
                 → DashboardDataModel (optional)
```

## Required Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `get_dashboards_list()` | `Iterable[dict]` | List all dashboards from the source |
| `get_dashboard_name(dashboard)` | `str` | Extract name from dashboard object |
| `get_dashboard_details(dashboard)` | `dict` | Fetch full dashboard details |
| `yield_dashboard(dashboard_details)` | `Iterable[Either[..., CreateDashboardRequest]]` | Create dashboard entity |
| `yield_dashboard_chart(dashboard_details)` | `Iterable[Either[..., CreateChartRequest]]` | Create chart entities |

## Optional Methods (Override No-Op Defaults)

| Method | Purpose |
|--------|---------|
| `yield_dashboard_lineage_details(dashboard_details)` | Dashboard → table lineage |
| `yield_dashboard_usage(dashboard_details)` | Dashboard view counts |
| `get_project_name(dashboard_details)` | Group dashboards by project |
| `get_owners(dashboard_details)` | Extract ownership |
| `yield_data_model(dashboard_details)` | Dashboard data models |

## Connection Pattern

Dashboard connectors use the function-based pattern:

```python
def get_connection(connection: MyDashConnection):
    return MyDashClient(connection)

def test_connection(metadata, client, service_connection, automation_workflow=None):
    test_fn = {
        "CheckAccess": partial(client.test_access),
        "GetDashboards": partial(client.get_dashboards),
        "GetCharts": partial(client.get_charts),
    }
    test_connection_steps(...)
```

## ServiceSpec
```python
ServiceSpec = BaseSpec(metadata_source_class=MyDashSource)
```

## Schema Properties
- `hostPort` (required)
- Auth (token, basic, or OAuth)
- `dashboardFilterPattern`, `chartFilterPattern`, `projectFilterPattern`
- `supportsMetadataExtraction`

## Lineage
Dashboard-to-table lineage comes from chart data sources. If the dashboard tool exposes which tables/queries a chart uses, implement `yield_dashboard_lineage_details()`.
