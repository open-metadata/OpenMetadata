# Databricks

In this section, we provide guides and references to use the Databricks connector. You can view the full documentation for Databricks <a href="https://docs.open-metadata.org/connectors/database/databricks" target="_blank">here</a>.

## Requirements

To learn more about the Databricks Connection Details (`hostPort`,`token`, `http_path`) information visit these <a href="https://docs.open-metadata.org/connectors/database/databricks/troubleshooting" target="_blank">docs</a>.

$$note
We support Databricks runtime version 9 and above.
$$

### Core Metadata Extraction

To extract basic metadata (catalogs, schemas, tables, views) from Databricks, the user or service principal needs the following Unity Catalog privileges:

```sql
-- Grant USE CATALOG on catalog
GRANT USE CATALOG ON CATALOG <catalog_name> TO `<user_or_service_principal>`;

-- Grant USE SCHEMA on schemas
GRANT USE SCHEMA ON SCHEMA <schema_name> TO `<user_or_service_principal>`;

-- Grant SELECT on tables and views
GRANT SELECT ON TABLE <table_name> TO `<user_or_service_principal>`;
```

### View Definitions (Optional)

To extract view definitions from `INFORMATION_SCHEMA.VIEWS`, ensure the user has SELECT privileges:

```sql
-- Grant SELECT on INFORMATION_SCHEMA.VIEWS
GRANT SELECT ON VIEW information_schema.views TO `<user_or_service_principal>`;
```

### Unity Catalog Tags (Optional)

To extract tags at different levels (catalog, schema, table, column), the user needs SELECT privileges on Unity Catalog information schema tag tables:

```sql
-- For catalog-level tags
GRANT SELECT ON TABLE system.information_schema.catalog_tags TO `<user_or_service_principal>`;

-- For schema-level tags
GRANT SELECT ON TABLE system.information_schema.schema_tags TO `<user_or_service_principal>`;

-- For table-level tags
GRANT SELECT ON TABLE system.information_schema.table_tags TO `<user_or_service_principal>`;

-- For column-level tags
GRANT SELECT ON TABLE system.information_schema.column_tags TO `<user_or_service_principal>`;
```

$$note
Tag extraction is only supported for Databricks version 13.3 and higher.
$$

### Lineage Extraction (Optional)

To extract table and column-level lineage from Unity Catalog system tables, the user needs access to the `system.access` schema:

```sql
-- For table lineage
GRANT SELECT ON TABLE system.access.table_lineage TO `<user_or_service_principal>`;

-- For column lineage
GRANT SELECT ON TABLE system.access.column_lineage TO `<user_or_service_principal>`;
```

$$note
Access to `system.access` tables is restricted by default. These grants must be executed by an **account administrator** in the Databricks account console. Regular workspace admins cannot grant access to system tables.
$$

### Usage & Lineage from Query History

$$note
To get Query Usage and Lineage details from query history, you need a **Databricks Premium account**, since we will be extracting this information from your SQL Warehouse's history API.
$$

The user or service principal needs appropriate permissions to access the SQL History API:

- **SQL Warehouse Access**: The user must have **CAN USE** or higher permission level on the SQL Warehouse (assigned via Databricks UI, API, or Terraform - not via SQL GRANT commands)
- **Query History Access**: Permission to view query history via the `/api/2.0/sql/history/queries` endpoint
- **API Authentication**: Valid authentication token (Personal Access Token) or OAuth credentials with API access enabled

$$note
SQL warehouse permissions are managed through the Databricks UI (SQL Warehouses → Permissions), REST API, or infrastructure-as-code tools. They cannot be granted using SQL GRANT statements.
$$


### Profiler & Data Quality

Executing the profiler workflow or data quality tests requires the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Databricks connector in the <a href="https://docs.open-metadata.org/connectors/database/databricks" target="_blank">docs</a>.

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

$$section
### Query History Table $(id="queryHistoryTable")
Table name to fetch the query history.
$$

## Sample Storage AWS S3 Config

$$section
### AWS Access Key ID $(id="awsAccessKeyId")
When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests (<a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html" target="_blank">docs</a>).
Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
You must use both the access key ID and secret access key together to authenticate your requests.
You can find further information on how to manage your access keys <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" target="_blank">here</a>
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")
Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### AWS Region $(id="awsRegion")
Each AWS Region is a separate geographic area in which AWS clusters data centers (<a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html" target="_blank">docs</a>).
As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.
Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials" target="_blank">here</a>.
$$

$$section
### AWS Session Token $(id="awsSessionToken")
If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.
You can find more information on <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html" target="_blank">Using temporary credentials with AWS resources</a>.
$$

$$section
### Endpoint URL $(id="endPointURL")
To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.
Find more information on <a href="https://docs.aws.amazon.com/general/latest/gr/rande.html" target="_blank">AWS service endpoints</a>.
$$

$$section
### Profile Name $(id="profileName")
A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.
You can inform this field if you'd like to use a profile other than `default`.
Find here more information about <a href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html" target="_blank">Named profiles for the AWS CLI</a>.
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")
Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.
A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.
This is a required field if you'd like to `AssumeRole`.
Find more information on <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html" target="_blank">AssumeRole</a>.
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")
An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.
By default, we'll use the name `OpenMetadataSession`.
Find more information about the <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session." target="_blank">Role Session Name</a>.
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")
The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.
Find more information about <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity" target="_blank">Source Identity</a>.
$$

$$section
### Bucket Name $(id="bucketName")
A bucket name in Data Lake is a unique identifier used to organize and store data objects.
It's similar to a folder name, but it's used for object storage rather than file storage.
$$

$$section
### Prefix $(id="prefix")
The prefix of a data source refers to the first part of the data path that identifies the source or origin of the data.
It's used to organize and categorize data within the container, and can help users easily locate and access the data they need.
$$

$$section
### Default Database Filter Pattern $(id="databaseFilterPattern")
Regex to only include/exclude databases that matches the pattern.
$$

$$section
### Default Schema Filter Pattern $(id="schemaFilterPattern")
Regex to only include/exclude schemas that matches the pattern.
$$

$$section
### Default Table Filter Pattern $(id="tableFilterPattern")
Regex to only include/exclude tables that matches the pattern.
$$
