# Dremio

In this section, we provide guides and references to use the Dremio connector.

## Requirements

Dremio connector supports both:
- **Dremio Cloud (SaaS)**: Fully managed cloud platform
- **Dremio Software**: Self-hosted on-premises or in your own cloud infrastructure

$$note
The connector reads Dremio through its REST API, on the same URL as the Dremio UI: no other port is needed. Ensure your authentication credentials have appropriate permissions to access metadata.
$$

### Usage and Lineage

When extracting lineage and usage information from Dremio, we query the job history from the system tables:
- **Dremio Cloud**: `sys.project.history.jobs` table
- **Dremio Software**: `sys.jobs_recent` table

$$note
Access to query history is optional. If the user doesn't have permission to access job history, metadata extraction will still work, but usage and lineage information will not be available.
$$

You can find further information on the Dremio connector in the <a href="https://docs.open-metadata.org/connectors/database/dremio" target="_blank">docs</a>.

## Connection Details

$$section
### Authentication Type $(id="authType")

Choose between two authentication methods based on your Dremio deployment:
- **Dremio Cloud**: For SaaS deployments using Personal Access Token (PAT)
- **Dremio Software**: For self-hosted deployments using username and password

$$

## Dremio Cloud Authentication

$$section
### Cloud Region $(id="region")

Dremio Cloud region where your organization is hosted:
- **US**: United States region (api.dremio.cloud)
- **EU**: European region (api.eu.dremio.cloud)

Select the region that matches your Dremio Cloud organization's location.
$$

$$section
### Personal Access Token (PAT) $(id="personalAccessToken")

Personal Access Token for authenticating with Dremio Cloud.

**How to generate a PAT:**
1. Log into your Dremio Cloud account
2. Navigate to **Settings** → **Personal Access Tokens**
3. Click **Add Token**
4. Provide a description (e.g., "OpenMetadata Integration")
5. Set an expiration period
6. Click **Create**
7. Copy the generated token (you won't be able to see it again)

$$note
Store your Personal Access Token securely. Treat it like a password and never share it publicly.
$$

$$

$$section
### Project ID $(id="projectId")

Dremio Cloud Project ID (required).

**How to find your Project ID:**
1. Log into your Dremio Cloud account
2. Look at the URL in your browser: `https://app.dremio.cloud/projects/{PROJECT_ID}/...`
3. The Project ID is the alphanumeric string after `/projects/`
4. Alternatively, go to **Project Settings** to view your Project ID

Example: If your URL is `https://app.dremio.cloud/projects/abc123-def456/datasets`, your Project ID is `abc123-def456`
$$

## Dremio Software Authentication

$$section
### Host and Port $(id="hostPort")

URL to your self-hosted Dremio Software instance, including protocol and port.

**Format:** `protocol://hostname:port`

**Examples:**
- `http://localhost:9047` (local development)
- `https://dremio.example.com:9047` (production with SSL)
- `http://dremio-server.internal:9047` (internal network)

$$note
The default port for Dremio Software is **9047**. If you're running OpenMetadata ingestion in Docker and Dremio is on localhost, use `http://host.docker.internal:9047`
$$

$$

$$section
### Username $(id="username")

Username for authenticating with Dremio Software.

This user should have appropriate permissions to:
- Read catalog metadata (sources, spaces, folders)
- Query dataset information
- Access system tables (for usage and lineage, optional)

$$

$$section
### Password $(id="password")

Password for the Dremio Software user account.
$$

$$section
### Verify SSL $(id="verifySSL")

How the certificate of Dremio Software is checked when the Host and Port is an `https` URL:
- **no-ssl** (default): checked against the certificate authorities trusted by the system.
- **ignore**: not checked, for a self-signed certificate.
- **validate**: checked against the CA certificate given in SSL Config.
$$

$$section
### SSL Config $(id="sslConfig")

The CA certificate that signed the certificate of Dremio Software, used when Verify SSL is **validate**. Client certificates are not used.
$$

## Optional Configuration

$$section
### Namespace $(id="database")

Optional: Restrict metadata ingestion to a specific namespace (source or space).

**Examples:**
- `Sales` (ingest only the "Sales" space)
- `DataLake` (ingest only the "DataLake" source)
- Leave blank to ingest all namespaces

In Dremio:
- **Sources** are external data sources (S3, HDFS, databases)
- **Spaces** are virtual datasets and views created in Dremio

$$

$$section
### Namespace Filter Pattern $(id="databaseFilterPattern")

Regex pattern to only include/exclude namespaces (sources/spaces) that match the pattern.

**Examples:**
- Include only production sources: `^prod_.*`
- Exclude test spaces: `^(?!test_).*`
- Include specific namespaces: `^(Sales|Marketing|Finance)$`

In Dremio, namespaces are mapped as databases in OpenMetadata.
$$

$$section
### Folder Filter Pattern $(id="schemaFilterPattern")

Regex pattern to only include/exclude folders that match the pattern.

**Examples:**
- Include only "reports" folders: `.*reports.*`
- Exclude temporary folders: `^(?!tmp_).*`
- Include specific paths: `^(analytics|dashboards)$`

In Dremio, folders within namespaces are mapped as schemas in OpenMetadata.
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Regex pattern to only include/exclude tables/views that match the pattern.

**Examples:**
- Include only tables starting with "fact_": `^fact_.*`
- Exclude temporary tables: `^(?!temp_).*`
- Include specific tables: `^(customers|orders|products)$`

$$

## Dremio Architecture

Understanding Dremio's hierarchy helps with metadata extraction:

```
Namespace (Source/Space)  →  Database in OpenMetadata
    └── Folder            →  Schema in OpenMetadata (`default` for datasets outside any folder)
        └── Dataset       →  Table in OpenMetadata
            └── Columns   →  Columns in OpenMetadata
```

**Dremio Cloud Example:**
- Namespace: `Sales` (Space)
  - Folder: `Reports`
    - Dataset: `customer_summary` (Virtual Dataset/View)
  - Folder: `Raw`
    - Dataset: `customers` (Promoted Dataset/Table)

**Dremio Software Example:**
- Namespace: `S3_DataLake` (Source)
  - Folder: `analytics`
    - Dataset: `events` (Physical Dataset)

## Common Issues

$$note
**Authentication Failed:**
- **Dremio Cloud**: Verify your Personal Access Token is valid and not expired. Check that the Project ID matches your URL.
- **Dremio Software**: Ensure username and password are correct. Verify the host:port is accessible from the OpenMetadata server.

**No Metadata Found:**
- Check that your user has permissions to read catalog metadata
- Verify that filter patterns are not excluding all your data
- Ensure namespaces (sources/spaces) exist in your Dremio instance

**Usage/Lineage Not Working:**
- Grant access to the job history: `sys.project.history.jobs` on Dremio Cloud, `sys.jobs_recent` on Dremio Software
- This is optional; metadata extraction will work without it
$$

## Permissions Required

### Dremio Cloud
- **Catalog Access**: Ability to view sources and spaces
- **Dataset Read**: Permission to view datasets and their metadata
- **Query History** (optional): Access to `sys.project.history.jobs` for usage/lineage

### Dremio Software
- **Catalog Access**: Ability to view sources and spaces
- **Dataset Read**: Permission to view datasets and their metadata
- **System Tables** (optional): Access to `sys.jobs_recent` for usage/lineage

You can find more information about Dremio permissions in the <a href="https://docs.dremio.com/cloud/security/rbac/" target="_blank">Dremio RBAC documentation</a>.
