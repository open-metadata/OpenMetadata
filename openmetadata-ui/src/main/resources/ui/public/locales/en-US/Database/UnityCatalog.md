# Unity Catalog

In this section, we provide guides and references to use the Unity Catalog connector. You can view the full documentation for Unity Catalog <a href="https://docs.open-metadata.org/connectors/database/unity-catalog" target="_blank">here</a>.

## Requirements

To learn more about the Unity Catalog Connection Details (`hostPort`,`token`, `http_path`) information visit these <a href="https://docs.open-metadata.org/connectors/database/unity-catalog/troubleshooting" target="_blank">docs</a>.

$$note
We support Databricks runtime version 9 and above.
$$

### Core Metadata Extraction

To extract basic metadata (catalogs, schemas, tables, views) from Databricks, the user or service principal needs the following Unity Catalog privileges:

```sql
-- Grant USE CATALOG on catalog
GRANT USE CATALOG ON CATALOG <catalog_name> TO '<user_or_service_principal>';

-- Grant USE SCHEMA on schemas
GRANT USE SCHEMA ON SCHEMA <schema_name> TO '<user_or_service_principal>';

-- Grant SELECT on tables and views
GRANT SELECT ON TABLE <table_name> TO '<user_or_service_principal>';
```

### View Definitions (Optional)

To extract view definitions from `INFORMATION_SCHEMA.VIEWS`, ensure the user has SELECT privileges:

```sql
-- Grant SELECT on INFORMATION_SCHEMA.VIEWS
GRANT SELECT ON VIEW information_schema.views TO '<user_or_service_principal>';
```

### Unity Catalog Tags (Optional)

To extract tags at different levels (catalog, schema, table, column), the user needs SELECT privileges on Unity Catalog information schema tag tables:

```sql
-- For catalog-level tags
GRANT SELECT ON TABLE system.information_schema.catalog_tags TO '<user_or_service_principal>';

-- For schema-level tags
GRANT SELECT ON TABLE system.information_schema.schema_tags TO '<user_or_service_principal>';

-- For table-level tags
GRANT SELECT ON TABLE system.information_schema.table_tags TO '<user_or_service_principal>';

-- For column-level tags
GRANT SELECT ON TABLE system.information_schema.column_tags TO '<user_or_service_principal>';
```

$$note
Tag extraction is only supported for Databricks version 13.3 and higher.
$$

### Lineage Extraction (Optional)

To extract table and column-level lineage from Unity Catalog system tables, the user needs access to the `system.access` schema:

```sql
-- For table lineage
GRANT SELECT ON TABLE system.access.table_lineage TO '<user_or_service_principal>';

-- For column lineage
GRANT SELECT ON TABLE system.access.column_lineage TO '<user_or_service_principal>';
```

$$note
Access to `system.access` tables is restricted by default. These grants must be executed by an **account administrator** in the Databricks account console. Regular workspace admins cannot grant access to system tables.
$$

### Usage & Lineage

Query usage and SQL text for native lineage edges are read from `system.query.history`.
To include SQL on lineage edges, grant the ingestion principal access:

```sql
GRANT USE CATALOG ON CATALOG system TO `<user_or_service_principal>`;
GRANT USE SCHEMA ON SCHEMA system.query TO `<user_or_service_principal>`;
GRANT SELECT ON TABLE system.query.history TO `<user_or_service_principal>`;
```

The SQL Query section displays the latest available statement for each source–target
table pair within the lineage lookback window. Column mappings still include all
native mappings from that window; a single displayed statement may not explain every mapping.

Databricks populates the lineage `statement_id` used to retrieve SQL only for queries
run on SQL warehouses. Query history can arrive later than lineage, and SQL text can
be empty or `<REDACTED>` depending on the principal's access and encryption settings.
See the [Databricks query history reference](https://docs.databricks.com/aws/en/admin/system-tables/query-history)
for statement-text access requirements. Native lineage is still ingested when SQL
is unavailable. If query history cannot be read, SQL enrichment is skipped for the
rest of that ingestion run and a warning is logged.

### Profiler & Data Quality

Executing the profiler workflow or data quality tests requires the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Unity Catalog connector in the <a href="https://docs.open-metadata.org/connectors/database/unity-catalog" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Host Port $(id="hostPort")
This parameter specifies the host and port of the Databricks instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `adb-xyz.azuredatabricks.net:443`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3000` as the value.
$$

$$section
### Authentication Type $(id="authType")
Select the authentication method to connect to your Databricks workspace.

- **Personal Access Token**: Generated Personal Access Token for Databricks workspace authentication.

- **Databricks OAuth**: OAuth2 Machine-to-Machine authentication using a Service Principal.

- **Azure AD Setup**: Specifically for Azure Databricks workspaces that use Azure Active Directory for identity management. Uses Azure Service Principal authentication through Azure AD.
$$

$$section
### Token $(id="token")
Personal Access Token (PAT) for authenticating with Databricks workspace.
(e.g., `dapi1234567890abcdef`)
$$

$$section
### Client ID $(id="clientId")
The Application ID of your Databricks Service Principal for OAuth2 authentication.
(e.g., `12345678-1234-1234-1234-123456789abc`)
$$

$$section
### Client Secret $(id="clientSecret")
OAuth secret for the Databricks Service Principal.
$$

$$section
### Azure Client ID $(id="azureClientId")
Azure Active Directory Application (client) ID for Azure Databricks authentication.
(e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
$$

$$section
### Azure Client Secret $(id="azureClientSecret")
Secret key for the Azure AD Application.
$$

$$section
### Azure Tenant ID $(id="azureTenantId")
Your Azure Active Directory tenant identifier.
(e.g., `98765432-dcba-4321-abcd-1234567890ab`)
$$


$$section
### HTTP Path $(id="httpPath")
Databricks compute resources URL. E.g., `/sql/1.0/warehouses/xyz123`.
$$

$$section
### Catalog $(id="catalog")
Catalog of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single catalog. When left blank, OpenMetadata Ingestion attempts to scan all the catalogs. E.g., `hive_metastore`
$$

$$section
### Database Schema $(id="databaseSchema")
Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.
$$

$$section
### Connection Timeout $(id="connectionTimeout")
The maximum amount of time (in seconds) to wait for a successful connection to the data source. If the connection attempt takes longer than this timeout period, an error will be returned.

If your connection fails because your cluster has not had enough time to start, you can try updating this parameter with a bigger number.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
