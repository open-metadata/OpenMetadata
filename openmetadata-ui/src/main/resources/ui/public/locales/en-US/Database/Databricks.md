# Databricks

In this section, we provide guides and references to use the Databricks connector. You can view the full documentation for Databricks <a href="https://docs.open-metadata.org/connectors/database/databricks" target="_blank">here</a>.

## Requirements

Databricks is a unified analytics platform for big data and AI. To connect to Databricks, you'll need:
- A Databricks workspace (AWS, Azure, or GCP)
- SQL Warehouse or All-Purpose Cluster with SQL endpoint
- Appropriate authentication credentials (Personal Access Token, OAuth, or Azure AD)

$$note
We support Databricks runtime version 9 and above. Ensure your cluster or SQL warehouse is running a compatible version.
$$

### Usage & Lineage

$$note
To extract Query Usage and Lineage details, you need:
- Databricks Premium or higher tier account
- Access to system.query.history table 
- Proper permissions to read SQL Warehouse query history via REST API
$$

You can find further information on the Databricks connector in the <a href="https://docs.open-metadata.org/connectors/database/databricks" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Host Port $(id="hostPort")
The hostname and port of your Databricks workspace server. This is the URL where your Databricks workspace is hosted, combined with the HTTPS port (typically 443).

**Format:** `hostname:port`
**Example:** `adb-xyz.azuredatabricks.net:443` (Azure), `dbc-xyz.cloud.databricks.com:443` (AWS)

To find this:
1. Navigate to your Databricks workspace
2. Copy the URL from your browser
3. Remove the `https://` prefix and any path
4. Add `:443` for the port

$$note
If running OpenMetadata ingestion in Docker with Databricks on localhost, use `host.docker.internal:443` instead of `localhost:443`.
$$
$$

$$section
### Authentication Type $(id="authType")
Select the authentication method to connect to your Databricks workspace. Different methods are available depending on your Databricks deployment (AWS, Azure, GCP) and security requirements.

#### Personal Access Token $(id="token")
The simplest authentication method using a Databricks-generated token.

**Token**: Personal Access Token (PAT) generated from your Databricks workspace.
- Navigate to User Settings → Developer → Access Tokens
- Click "Generate New Token"
- Set token lifetime (90 days max for most workspaces)
- Copy and securely store the token
- Example format: `dapi1234567890abcdef`

$$note
Personal Access Tokens are user-specific and inherit the user's permissions. For production, consider using Service Principal authentication.
$$

#### Databricks OAuth $(id="clientId,clientSecret")
OAuth2 Machine-to-Machine authentication using Service Principal (recommended for production).

**Client ID** $(id="clientId"): The Application ID of your Service Principal
- Created in Databricks Account Console → Service Principals
- Format: UUID (e.g., `12345678-1234-1234-1234-123456789abc`)

**Client Secret** $(id="clientSecret"): OAuth secret for the Service Principal
- Generated after creating the Service Principal
- Navigate to the Service Principal → Generate Secret
- Valid for up to 2 years
- Store securely - cannot be retrieved after creation

#### Azure AD Setup $(id="azureClientId,azureClientSecret,azureTenantId")
For Azure Databricks workspaces using Azure Active Directory authentication.

**Azure Client ID** $(id="azureClientId"): Azure AD Application (client) ID
- Found in Azure Portal → App Registrations → Your App → Overview
- Format: UUID

**Azure Client Secret** $(id="azureClientSecret"): Secret created for the Azure AD App
- Azure Portal → App Registrations → Your App → Certificates & Secrets
- Create new client secret with appropriate expiry

**Azure Tenant ID** $(id="azureTenantId"): Your Azure AD tenant identifier
- Azure Portal → Azure Active Directory → Overview
- Format: UUID
$$

$$section
### HTTP Path $(id="httpPath")
The HTTP endpoint path for your Databricks compute resource (SQL Warehouse or Cluster). This path routes queries to the appropriate compute engine.

**For SQL Warehouses:**
- Format: `/sql/1.0/warehouses/{warehouse_id}`
- Find in: SQL Warehouses → Your Warehouse → Connection Details → HTTP Path
- Example: `/sql/1.0/warehouses/abc123def456`

**For All-Purpose Clusters:**
- Format: `/sql/protocolv1/o/{workspace_id}/{cluster_id}`
- Find in: Compute → Your Cluster → Advanced Options → JDBC/ODBC → HTTP Path
- Example: `/sql/protocolv1/o/1234567890/0123-456789-abcde12`

$$note
SQL Warehouses are recommended for metadata extraction as they provide better performance and cost efficiency for SQL workloads.
$$
$$

$$section
### Catalog $(id="catalog")
Unity Catalog name to restrict metadata extraction scope. Unity Catalog is Databricks' data governance solution that organizes data assets.

**Optional field** - Leave blank to scan all accessible catalogs.

Common values:
- `main` - Default catalog in Unity Catalog-enabled workspaces
- `hive_metastore` - Legacy Hive metastore (pre-Unity Catalog)
- Custom catalog names created in your workspace

$$note
Unity Catalog requires Databricks Premium or higher. Legacy workspaces only have `hive_metastore`.
$$
$$

$$section
### Database Schema $(id="databaseSchema")
Specific schema (database) within a catalog to limit metadata extraction.

**Optional field** - Leave blank to scan all schemas in the specified catalog(s).

Format: `schema_name` (not `catalog.schema`)
Example: `default`, `bronze`, `silver`, `gold`

Use this to:
- Reduce extraction time for large workspaces
- Focus on specific business domains
- Exclude development or temporary schemas
$$

$$section
### Query History Table $(id="queryHistoryTable")
System table containing query execution history for usage and lineage extraction.

**Default:** `system.query.history`

This table stores:
- Query text and execution plans
- User and timestamp information  
- Resource usage metrics
- Data lineage relationships

$$note
Requires Databricks Premium tier and appropriate permissions on the system catalog. The user must have SELECT permission on this table.
$$
$$

$$section
### Connection Timeout $(id="connectionTimeout")
Maximum seconds to wait for Databricks cluster startup and connection establishment.

**Default:** 120 seconds
**Recommended:** 
- 120-180 for SQL Warehouses (usually pre-warmed)
- 300-600 for All-Purpose Clusters (cold start can take 5-10 minutes)

Increase this value if you see timeout errors, especially when:
- Using auto-scaling clusters that start from zero nodes
- Connecting to clusters in auto-pause mode
- Network latency is high between OpenMetadata and Databricks
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$
