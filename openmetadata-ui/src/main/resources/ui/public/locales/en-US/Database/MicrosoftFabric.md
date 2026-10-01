# Microsoft Fabric

In this section, we provide guides and references to use the Microsoft Fabric connector. This connector supports Microsoft Fabric Warehouse and Lakehouse databases.

## Requirements

### Service Principal (Application) Setup

OpenMetadata uses Service Principal authentication to connect to Microsoft Fabric. Follow these steps to set up authentication:

1. **Register an Azure AD Application:**
   - Log into <a href="https://portal.azure.com" target="_blank">Azure Portal</a>
   - Navigate to `Azure Active Directory` > `App registrations` > `New registration`
   - Provide a name for your application and click `Register`
   - Copy the `Application (client) ID` and `Directory (tenant) ID` for later use

2. **Create a credential for the application**, either a client secret or a certificate:
   - **Client secret:** in your registered app, go to `Certificates & secrets` > `Client secrets` > `New client secret`, choose an expiration period, click `Add`, and copy the secret **value** (not the secret ID). The value is shown only once.
   - **Certificate:** go to `Certificates & secrets` > `Certificates` > `Upload certificate` and upload the public certificate (`.cer`, `.crt` or `.pem`). Keep its private key, it is entered in the connection and never uploaded to Microsoft Entra ID. A certificate avoids long-lived shared secrets: only a signed assertion leaves the ingestion runner.

3. **Grant Permissions to Fabric Workspace:**
   - Navigate to your Fabric workspace in <a href="https://app.fabric.microsoft.com" target="_blank">Microsoft Fabric</a>
   - Go to `Workspace settings` > `Manage access`
   - Click `Add people or groups`
   - Search for your registered application name
   - Assign the appropriate role:
     - **Admin** - Full access including metadata extraction
     - **Member** - Read and write access
     - **Contributor** - Read access (minimum for metadata extraction)
     - **Viewer** - Read-only access

4. **Allow service principals in Fabric:**
   - A Fabric administrator must enable `Service principals can call Fabric public APIs` in `Tenant settings` > `Developer settings`, for the entire organization or a security group that contains the application.
   - No API permission or admin consent is needed on the application. The connector requests an access token for the SQL endpoint (`https://database.windows.net/.default`) and refreshes it before it expires.

### Database Permissions

The Service Principal needs at least **read** permissions on:
- Warehouse tables and views (for metadata extraction)
- Lakehouse tables (for metadata extraction)
- System views in the database (for schema information)

### Profiler & Data Quality

To run profiler workflows or data quality tests, the Service Principal needs `SELECT` permission on:
- All tables/views where profiling will be executed
- System views for metadata collection

More information:
- <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">Profiler Workflow Setup</a>
- <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">Data Quality Tests</a>

You can find further information on the Microsoft Fabric connector in the <a href="https://docs.open-metadata.org/connectors/database/microsoft-fabric" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme for Microsoft Fabric. Use `mssql+pyodbc` for Warehouse connections.
$$

$$section
### Host Port $(id="hostPort")
The SQL endpoint connection string for your Microsoft Fabric Warehouse or Lakehouse.

Format: `<warehouse-name>.datawarehouse.fabric.microsoft.com` or `<lakehouse-name>.dfs.fabric.microsoft.com`

You can find this in:
1. Open your Warehouse/Lakehouse in <a href="https://app.fabric.microsoft.com" target="_blank">Microsoft Fabric</a>
2. Click on the `SQL connection string` or `SQL endpoint` option
3. Copy the hostname (without the port)

Example: `mywarehouse.datawarehouse.fabric.microsoft.com`
$$

$$section
### Database $(id="database")
The database name in your Microsoft Fabric Warehouse or Lakehouse.

For Warehouses: This is typically the warehouse name
For Lakehouses: This is the lakehouse name
$$

$$section
### Driver $(id="driver")
ODBC driver to use for connection. Default is `ODBC Driver 18 for SQL Server`.

Ensure the driver is installed on the machine running the ingestion:
- **Linux:** `apt-get install msodbcsql18` or `yum install msodbcsql18`
- **Windows:** Download from <a href="https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server" target="_blank">Microsoft</a>
- **macOS:** `brew install microsoft/mssql-release/msodbcsql18`
$$

$$section
### Client ID $(id="clientId")
Azure Active Directory Application (Client) ID.

To get this:
1. Log into <a href="https://portal.azure.com" target="_blank">Azure Portal</a>
2. Go to `Azure Active Directory` > `App registrations`
3. Select your registered application
4. Copy the `Application (client) ID`
$$

$$section
### Tenant ID $(id="tenantId")
Azure Active Directory Tenant ID.

To get this:
1. Log into <a href="https://portal.azure.com" target="_blank">Azure Portal</a>
2. Go to `Azure Active Directory` > `App registrations`
3. Select your registered application
4. Copy the `Directory (tenant) ID` from the Overview page
$$

$$section
### Authentication Type $(id="authType")
Credential the service principal uses to obtain Microsoft Entra ID access tokens for the Fabric SQL endpoint.

- **Client Secret**: a client secret of the application.
- **Certificate**: an X.509 certificate registered on the application, with its private key.
$$

$$section
### Client Secret $(id="clientSecret")
Client secret of the application.

To get this:
1. In your registered app, go to `Certificates & secrets` > `Client secrets`
2. Click `New client secret`
3. Copy the **Value** (not the Secret ID)
4. **Important:** This value is shown only once, save it immediately
$$

$$section
### Certificate $(id="certificate")
PEM-encoded X.509 certificate uploaded to the application's `Certificates & secrets` > `Certificates` page. The PEM may also contain the issuing certificate chain after the certificate.

The certificate must be within its validity period. Test connection reports an expired or not yet valid certificate, a certificate that does not match the private key, and a certificate that is not registered on the application.

To create a self-signed certificate and its private key:
```
openssl req -x509 -newkey rsa:2048 -sha256 -days 365 -keyout private-key.pem -out certificate.pem -subj "/CN=fabric-ingestion"
```

To extract the certificate from a `.pfx` or `.p12` file:
```
openssl pkcs12 -in certificate.pfx -clcerts -nokeys -out certificate.pem
```
$$

$$section
### Private Key $(id="privateKey")
PEM-encoded private key of the certificate, as PKCS#8 (`BEGIN PRIVATE KEY` or `BEGIN ENCRYPTED PRIVATE KEY`) or PKCS#1 (`BEGIN RSA PRIVATE KEY`). A single PEM file that holds both the private key and the certificate can be supplied in both fields.

To extract the private key from a `.pfx` or `.p12` file, protected by a new passphrase that goes into `Private Key Passphrase`:
```
openssl pkcs12 -in certificate.pfx -nocerts -out private-key.pem
```
$$

$$section
### Private Key Passphrase $(id="privateKeyPassphrase")
Passphrase of an encrypted private key. Leave it empty when the private key is not encrypted.
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.

Common options:
```
{
  "Encrypt": "yes",
  "TrustServerCertificate": "no"
}
```
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.

Example:
```
{
  "ssl": {"ssl-mode": "require"}
}
```
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")
If enabled, OpenMetadata will ingest metadata from all databases in the Fabric workspace. If disabled, only the database specified in the `Database` field will be ingested.
$$

$$section
### Database Filter Pattern $(id="databaseFilterPattern")
Regex to only include/exclude databases that match the pattern.

Examples:
- Include only specific databases: `^(sales|marketing)$`
- Exclude system databases: `^(?!system_).*`
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")
Regex to only include/exclude schemas that match the pattern.

Examples:
- Include only dbo schema: `^dbo$`
- Exclude staging schemas: `^(?!staging_).*`
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")
Regex to only include/exclude tables that match the pattern.

Examples:
- Include only fact tables: `^fact_.*`
- Exclude temporary tables: `^(?!tmp_).*`
$$

$$section
### Sample Data Storage Config $(id="sampleDataStorageConfig")
Storage configuration for sample data. Sample data can be stored in a database or in S3.
$$
