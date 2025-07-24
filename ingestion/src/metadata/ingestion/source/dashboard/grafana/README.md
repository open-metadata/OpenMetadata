# Grafana Dashboard Connector

This connector extracts metadata from Grafana dashboards and creates the corresponding entities in OpenMetadata.

## Features

- **Dashboard Discovery**: Automatically discovers and imports all dashboards from your Grafana instance
- **Folder Hierarchy**: Preserves folder structure by including folder names in dashboard display names
- **Chart Extraction**: Extracts individual panels as charts with their visualization types
- **Tag Support**: Imports Grafana tags and maps them to OpenMetadata classifications
- **Owner Mapping**: Maps dashboard creators to OpenMetadata users via email
- **Lineage Support**: Extracts SQL queries from panels to create lineage to database tables
- **Datasource Mapping**: Tracks which datasources are used by each dashboard
- **Filtering**: Supports regex patterns to include/exclude specific dashboards and charts

## Requirements

- Grafana 8.0+ (earlier versions may work but are not officially supported)
- Service Account Token with Admin role (for full metadata access)
- Network access to Grafana API endpoints

## Configuration

### Required Parameters

- **hostPort**: URL to your Grafana instance (e.g., `https://grafana.example.com`)
- **apiKey**: Service Account Token with appropriate permissions

### Optional Parameters

- **verifySSL**: Whether to verify SSL certificates (default: `true`)
- **pageSize**: Number of items per API page for pagination (default: `100`)
- **dashboardFilterPattern**: Regex pattern to filter dashboards
- **chartFilterPattern**: Regex pattern to filter charts/panels
- **includeTags**: Whether to import Grafana tags (default: `true`)
- **dbServiceName**: Database service name prefix for lineage

## Prerequisites

- Grafana instance (self-hosted or cloud)
- Admin access to create Service Account Tokens
- Grafana version 9.0+ (Service Account Tokens were introduced in 9.0)

## Authentication Support

The connector supports both **self-hosted Grafana** and **Grafana Cloud** using Service Account Tokens:

- **Service Account Tokens** (Required for Grafana >= 9.0)
  - Format: `glsa_xxxxxxxxxxxxxxxxxxxx`
  - Not tied to specific users
  - No default expiration
  - Works with both self-hosted and cloud

Note: Legacy API Keys are no longer supported by Grafana as of January 2025.

## Setup

### 1. Create Service Account Token

1. Navigate to Configuration → Service accounts in Grafana
2. Click "Add service account"
3. Give it a name and select "Admin" role
4. Generate a new token and save it securely

### 2. Configure the Connection

```yaml
source:
  type: grafana
  serviceName: grafana_prod
  serviceConnection:
    config:
      type: Grafana
      hostPort: https://grafana.example.com
      apiKey: glsa_xxxxxxxxxxxxxxxxxxxx
      verifySSL: true
```

### Grafana Cloud vs Self-Hosted

#### Grafana Cloud:
- Use your Grafana Cloud URL (e.g., `https://yourorg.grafana.net`)
- Service Account Tokens are the only supported method
- Built-in rate limiting applies
- SSL verification should always be enabled

#### Self-Hosted Grafana:
- Use your internal Grafana URL
- Service Account Tokens required (API keys no longer supported)
- May need `verifySSL: false` for self-signed certificates
- No external rate limiting

## Metadata Mapping

### Entities Created

1. **Dashboards**
   - Name: Dashboard UID
   - Display Name: `{Folder Name}/{Dashboard Title}` (if in folder)
   - Description: Dashboard description
   - Tags: Grafana tags mapped to OpenMetadata classifications
   - Source URL: Direct link to dashboard in Grafana

2. **Charts** (from Panels)
   - Name: `{Dashboard UID}_{Panel ID}`
   - Display Name: Panel title
   - Chart Type: Mapped from Grafana panel type
   - Description: Panel description
   - Source URL: Direct link to specific panel

### Panel Type Mapping

| Grafana Panel Type | OpenMetadata Chart Type |
|-------------------|------------------------|
| graph, timeseries | Line |
| table | Table |
| stat | Text |
| gauge | Gauge |
| bargauge, bar | Bar |
| piechart | Pie |
| heatmap | Heatmap |
| histogram | Histogram |
| geomap | Map |
| nodeGraph | Graph |
| state-timeline, status-history | Timeline |
| Others | Other |

## Lineage Extraction

The connector can extract lineage from SQL queries in panels:

1. Identifies datasources used in each panel
2. Extracts SQL queries from supported datasource types:
   - MySQL
   - PostgreSQL
   - MSSQL
   - ClickHouse
3. Parses SQL to identify source tables
4. Creates lineage relationships between tables and dashboards

### Supported Query Fields

- `rawSql`: Raw SQL queries (most common)
- `query`: Generic query field
- `expr`: Prometheus expressions (not processed for lineage)

## Example Usage

### Basic Configuration

```yaml
source:
  type: grafana
  serviceName: my_grafana
  serviceConnection:
    config:
      type: Grafana
      hostPort: https://grafana.mycompany.com
      apiKey: ${GRAFANA_API_KEY}
  sourceConfig:
    config:
      type: DashboardMetadata
      dashboardFilterPattern:
        includes:
          - ".*production.*"
        excludes:
          - ".*test.*"
```

### With Lineage to Database Service

```yaml
source:
  type: grafana
  serviceName: my_grafana
  serviceConnection:
    config:
      type: Grafana
      hostPort: https://grafana.mycompany.com
      apiKey: ${GRAFANA_API_KEY}
  sourceConfig:
    config:
      type: DashboardMetadata
      dbServiceName: my_postgres_service
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that your API key is valid and has Admin role
2. **Empty Results**: Verify the service account has access to folders/dashboards
3. **Missing Lineage**: Ensure datasources are properly configured in Grafana
4. **SSL Errors**: Set `verifySSL: false` for self-signed certificates

### Debug Logging

Enable debug logging to see detailed API calls:

```bash
export AIRFLOW__LOGGING__LEVEL=DEBUG
```

## Limitations

- Row panels and text panels are skipped (no visualization data)
- Only SQL-based datasources are supported for lineage
- Prometheus, Elasticsearch queries are not parsed for lineage
- Dashboard variables and templating are not fully supported
- Real-time data and annotations are not imported