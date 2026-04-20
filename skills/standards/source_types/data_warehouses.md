# Data Warehouse Connector Standards

Covers cloud-native analytical databases: BigQuery, Snowflake, Redshift, Databricks, Azure Synapse, etc.

## Base Classes

- Source: `CommonDbSourceService` + `MultiDBSource` (always multi-database)
- Connection: Varies — `BaseConnection` for standard, custom `get_connection()` for cloud auth
- Spec: `DefaultDatabaseSpec`

## Key Characteristics

- Cloud-hosted with IAM/OAuth/service account authentication
- Multi-database/multi-project architecture
- Rich query log access (query history views, audit logs)
- Custom connection URL patterns (project IDs, warehouse names, account identifiers)
- Large-scale metadata (thousands of tables, complex schemas)

## Authentication Patterns

Data warehouses typically support multiple auth methods:

| Warehouse | Primary Auth | Secondary Auth |
|-----------|-------------|----------------|
| BigQuery | Service account JSON | OAuth2, Application Default Credentials |
| Snowflake | Username/password | Key pair, OAuth, SSO |
| Redshift | Username/password | IAM role, temporary credentials |
| Databricks | Personal access token | OAuth, Azure AD |

Use `$ref` schemas for standard auth types. Custom auth (service account JSON, key pair) uses connector-specific schema properties.

## Custom Connection URL Building

Data warehouses usually need custom URL builders:

```python
# BigQuery — project ID and location in URL
def get_connection_url(connection: BigQueryConnection) -> str:
    set_google_credentials(connection)  # Set env vars for GCP
    url = f"bigquery://{connection.taxonomyProjectID or connection.project}"
    return _add_location(url, connection)

# Snowflake — account identifier format
url = f"snowflake://{user}:{password}@{account}/{database}/{schema}?warehouse={warehouse}"
```

## Lineage and Usage

All data warehouses should support lineage and usage — they have rich query history:

| Warehouse | Query Log Source |
|-----------|-----------------|
| BigQuery | `INFORMATION_SCHEMA.JOBS_BY_PROJECT` |
| Snowflake | `SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY` |
| Redshift | `STL_QUERYTEXT` + `STL_QUERY` |
| Databricks | Unity Catalog query history API |

## Multi-Project/Multi-Database

All data warehouses use `MultiDBSource`:

```python
class BigquerySource(CommonDbSourceService, MultiDBSource):
    def get_database_names_raw(self) -> Iterable[str]:
        for project_id in self.project_ids:
            yield project_id
```

## Reference Connectors

- **BigQuery**: `bigquery/` — GCP auth, multi-project, JOBS table lineage
- **Snowflake**: `snowflake/` — Account/warehouse/database hierarchy, key pair auth
- **Redshift**: `redshift/` — IAM auth, STL tables for lineage
