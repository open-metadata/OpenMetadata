# Airflow

In this section, we provide guides and references to use the Airflow connector.

## Requirements

We support different approaches to extracting metadata from Airflow:
1. **Airflow Connector**: which we will configure in this section and requires access to the underlying database.
2. **Airflow Lineage Backend**: which can be configured in your Airflow instance. You can read more about the Lineage Backend <a href="https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend" target="_blank">here</a>.
3. **Airflow Lineage Operator**: To send metadata directly from your Airflow DAGs. You can read more about the Lineage Operator <a href="https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-operator" target="_blank">here</a>.

From the OpenMetadata UI, you have access to the strategy number 1.

You can find further information on the Airflow connector in the <a href="https://docs.open-metadata.org/connectors/pipeline/airflow" target="_blank">docs</a>.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Pipeline Service Management URI. This should be specified as a URI string in the format `scheme://hostname:port`. E.g., `http://localhost:8080`, `http://host.docker.internal:8080`.

$$

$$section
### Number Of Status $(id="numberOfStatus")

Number of past task status to read every time the ingestion runs. By default, we will pick up and update the last 10 runs.
$$

$$section
### Metadata Database Connection $(id="connection")

Select your underlying database connection. We support the <a href="https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html" target="_blank">official</a> backends from Airflow.

Note that the **Backend Connection** is only used to extract metadata from a DAG running directly in your instance, for example to get the metadata out of <a href="https://docs.open-metadata.org/connectors/pipeline/airflow/gcp" target="_blank">GCS Composer</a>.

$$

## Airflow REST API Connection

The REST API connection calls the Airflow web server over HTTP/HTTPS and does not require direct access to Airflow's metadata database. This makes it the right choice for managed deployments (Astronomer, GCP Cloud Composer, MWAA) and for any self-hosted Airflow where direct DB access is not available or desired.

$$note
The REST API connection fetches DAG topology, task structure, schedules, and run statuses. **Lineage is not captured through this connection.** To get table-level and column-level lineage in OpenMetadata, you must separately install the <a href="https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend" target="_blank">OpenMetadata Lineage Backend</a> in Airflow (strategy 2) or use the <a href="https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-operator" target="_blank">Lineage Operator</a> in your DAGs (strategy 3). Once those emit OpenLineage events, lineage edges will appear automatically in OpenMetadata.
$$

### Host URL Format by Deployment

| Deployment | Example Host and Port URL |
|---|---|
| Self-hosted / Docker (ingestion runs on the host) | `http://localhost:8080` |
| Self-hosted / Docker (ingestion runs inside Docker) | `http://host.docker.internal:8080` |
| Google Cloud Composer | `https://ko82752sdo9f7zjf811c682mw1e5uuc9-dot-us-east1.composer.googleusercontent.com` |
| Astronomer | `https://cmn4c1zax823t00qf36gnlquw.ay.astronomer.run/v13jlquw/` |
| Amazon MWAA | `https://a1234awd1-5324-6f89-9523-1sq41234adqa.c2.airflow.eu-north-1.on.aws` |

For **Cloud Composer**, find the web server URL in GCP Console → **Composer → Environments → Open Airflow UI**. Copy the base URL (omit any trailing path).

For **Astronomer**, find your deployment URL in the Astronomer UI → **Deployments → Open Airflow**. Do **not** include a trailing slash.

### When to Use REST API vs. a Database Connection

Use the **REST API connection** when:
- You are on Astronomer (DB access is unavailable).
- You are on Cloud Composer or MWAA (DB access is unavailable or impractical).
- You are running Airflow 3.x.
- You do not have direct network access to the underlying MySQL / Postgres / SQLite metadata DB.

Use a **Database connection** (MySQL / Postgres / SQLite sections below) when:
- You self-host Airflow and have direct access to the metadata DB.
- You want to read raw task-instance data directly from the DB rather than via the API.
- You are using the Backend Connection strategy (Airflow plugin / Lineage Backend approach).

$$section
### Authentication Configuration $(id="authConfig")

Select the authentication method for the Airflow REST API. Pick one of the three options from the dropdown — the corresponding fields will appear:

- **Basic Auth**: Enter a username and password. For Airflow 3.x, a short-lived JWT is automatically exchanged at startup; for Airflow 2.x, HTTP Basic auth is used directly.
- **Access Token**: Paste a static bearer token you have generated in Airflow.
- **GCP Service Account**: Recommended for **Google Cloud Composer**. GCP OAuth2 tokens are fetched and auto-refreshed at runtime via `google-auth` — tokens never expire mid-run.
- **MWAA Configuration**: AWS credentials used to authenticate with Amazon Managed Workflows for Apache Airflow (MWAA).

$$

### Authentication Quick Reference

| Deployment | Recommended Auth |
|---|---|
| Self-hosted Airflow 2.x or 3.x | Basic Auth |
| Astronomer | Access Token (Deployment API token) |
| Google Cloud Composer | GCP Service Account |
| Any deployment with a pre-generated bearer token | Access Token |

$$section
### Username $(id="username")

Username for Basic Auth. The user must have permission to call the Airflow REST API.

For Airflow 3.x this triggers an automatic JWT exchange (`POST /auth/token`). For Airflow 2.x, HTTP Basic auth is used directly.

$$

$$section
### Password $(id="password")

Password for Basic Auth.

$$

$$section
### Token $(id="token")

Static bearer token for Access Token authentication. Paste the token value here — it will be sent as `Authorization: Bearer <token>` on every request.

Use this when you have generated a long-lived API token in your Airflow deployment.

$$

### Generating an Astronomer Deployment Token

For **Astronomer** deployments, use Access Token auth with a Deployment API token:
1. Open the Astronomer UI and navigate to **Deployments**.
2. Select your deployment and go to **API Keys** or **Tokens** (the exact label depends on your Astronomer version).
3. Click **Add API Key** / **Generate Token**, give it a descriptive name (e.g. `openmetadata-ingestion`), and copy the value.
4. Paste it in the **Token** field above.

For self-hosted Airflow, you can generate an API token via the Airflow UI under **Admin → Users** or via the Airflow CLI.


$$section

### MWAA Configuration $(id="mwaaConfig")

AWS credentials used to authenticate with Amazon Managed Workflows for Apache Airflow (MWAA).

The authentication requires the MWAA Environment Name and an AWS configuration.

#### Configuration Fields
**MWAA Environment Name**: The name of the Amazon MWAA environment to connect to.
**AWS Region**: The AWS region where the MWAA environment is deployed.
**AWS Access Key ID**: The access key used to authenticate with AWS.
**AWS Secret Access Key**: The secret key associated with the AWS access key.
**AWS Session Token (Optional)**: Required when using temporary AWS credentials.
**Assume Role ARN (Optional)**: ARN of IAM role to assume for cross-account access.
**Assume Role Session Name (Optional)**: Session name for assumed role.
**Endpoint URL (Optional)**: Custom endpoint URL for AWS-compatible services (MinIO, LocalStack).

$$

$$section
### GCP Credentials $(id="credentials")

GCP credentials used to obtain short-lived OAuth2 tokens for authenticating with Google Cloud Composer. Tokens are automatically refreshed when they expire, so ingestion runs are never interrupted by token expiry.

Supports all four GCP authentication types:

- **GCP Credentials Values**: Paste the service account JSON fields directly (project ID, client email, private key, etc.).
- **GCP Credentials Path**: Provide a file path to a service account JSON key file on the ingestion host.
- **GCP External Account (Workload Identity Federation)**: For GKE or other workload identity setups.
- **GCP ADC (Application Default Credentials)**: Uses the credentials already available in the environment (e.g. via `gcloud auth application-default login` or the GCE metadata server).

You can also optionally configure **service account impersonation** via `gcpImpersonateServiceAccount`.

$$

### Finding Your Cloud Composer Airflow URL

In GCP Console, go to **Composer → Environments**, select your environment, and click **Open Airflow UI**. Copy the base URL (e.g. `https://<hash>-dot-<region>.composer.googleusercontent.com`) — this is what you enter in the **Host and Port** field above.

### Choosing a GCP Credential Type

| Credential Type | When to Use |
|---|---|
| **GCP Credentials Values** | Ingestion runs outside GCP (on-prem, local machine). Paste the service account JSON fields directly. |
| **GCP Credentials Path** | Ingestion runs on a host where the service account JSON key file already exists at a known local path. |
| **GCP ADC (Application Default Credentials)** | Ingestion runs on a GCE VM or GKE pod with an attached service account. Uses the GCE metadata server or `gcloud auth application-default login`. |
| **GCP External Account (Workload Identity Federation)** | Ingestion runs on GKE with Workload Identity, or on a non-GCP system using federated identity (e.g. AWS → GCP). |

$$section
### API Version $(id="apiVersion")

Airflow REST API version to use:

- **auto** (default): OpenMetadata tries `v2` first (Airflow 3.x), then falls back to `v1` (Airflow 2.x).
- **v1**: Force Airflow 2.x API.
- **v2**: Force Airflow 3.x API.

$$

$$section
### Verify SSL $(id="verifySSL")

Whether to verify SSL certificates when connecting to the Airflow REST API. Set to `false` only in development environments with self-signed certificates.

$$


## MySQL Connection

If your Airflow is backed by a MySQL database, then you will need to fill in these details:

### Username & Password

Credentials with permissions to connect to the database. Read-only permissions are required.

### Host and Port

Host and port of the MySQL service. This should be specified as a string in the format `hostname:port`. E.g., `localhost:3306`, `host.docker.internal:3306`.

### Database Schema

MySQL schema that contains the Airflow tables.

### SSL CA $(id="sslCA")
Provide the path to SSL CA file, which needs to be local in the ingestion process.

### SSL Certificate $(id="sslCert")
Provide the path to SSL client certificate file (`ssl_cert`)

### SSL Key $(id="sslKey")
Provide the path to SSL key file (`ssl_key`)


## Postgres Connection

If your Airflow is backed by a Postgres database, then you will need to fill in these details:

### Username & Password

Credentials with permissions to connect to the database. Read-only permissions are required.

### Host and Port

Host and port of the Postgres service. E.g., `localhost:5432` or `host.docker.internal:5432`.

### Database

Postgres database that contains the Airflow tables.

### SSL Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca` etc.

You can ignore the rest of the properties, since we won't ingest any database not policy tags.


## MSSQL Connection

If your Airflow is backed by a MSSQL database, then you will need to fill in these details:

### Username

Credentials with permissions to connect to the database. Read-only permissions are required.

### Host and Port

Host and port of the Postgres service. E.g., `localhost:1433` or `host.docker.internal:1433`.


$$section
### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.
- Azure Based Auth.

User can authenticate the Mysql Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services **or** by using `Azure Baed Authentication` to connecto to Azure releated services.
$$

## Basic Auth

### Password $(id="password")
Password to connect to MySQL.

## IAM Auth Config

$$note 
If you are using IAM auth, add <br />`"ssl": {"ssl-mode": "allow"}` under Connection Arguments
$$

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

## Azure Auth Config

$$section
### Client ID $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key file.
$$

$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.

$$

$$section
### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
$$

$$section
### Storage Account Name $(id="accountName")

Account Name of your storage account
$$

$$section
### Key Vault Name $(id="vaultName")

Key Vault Name
$$

$$section
### Scopes $(id="scopes")

To let OM use the Trino Auth APIs using your Azure AD app, you'll need to add the scope
1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. From the `Expose an API` section, copy the `Application ID URI`
5. Make sure the URI ends with `/.default` in case it does not, you can append the same manually
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the MySQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3306`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3306` as the value.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of MySQL, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`ssl_ca`)
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication (`ssl_cert`)
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate (`ssl_key`)
$$

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.


## Postgres Connection


### Username $(id="username")

Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.


### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.
- Azure Based Auth.

User can authenticate the Postgres Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services **or** by using `Azure Baed Authentication` to connecto to Azure releated services.


## Basic Auth

### Password $(id="password")

Password to connect to Postgres.


## IAM Auth Config


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



### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers (<a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html" target="_blank">docs</a>).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials" target="_blank">here</a>.



### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html" target="_blank">Using temporary credentials with AWS resources</a>.



### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on <a href="https://docs.aws.amazon.com/general/latest/gr/rande.html" target="_blank">AWS service endpoints</a>.



### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about <a href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html" target="_blank">Named profiles for the AWS CLI</a>.



### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html" target="_blank">AssumeRole</a>.



### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session." target="_blank">Role Session Name</a>.



### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity" target="_blank">Source Identity</a>.


## Azure Auth Config


### Client ID $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key file.



### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.



### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.



### Storage Account Name $(id="accountName")

Account Name of your storage account



### Key Vault Name $(id="vaultName")

Key Vault Name



### Scopes $(id="scopes")

To let OM use the Trino Auth APIs using your Azure AD app, you'll need to add the scope
1. Log into <a href="https://ms.portal.azure.com/#allservices" target="_blank">Microsoft Azure</a>.
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. From the `Expose an API` section, copy the `Application ID URI`
5. Make sure the URI ends with `/.default` in case it does not, you can append the same manually



### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Postgres instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:5432`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:5432` as the value.



### Database $(id="database")

Initial Postgres database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.



### SSL Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca`, `allow` etc.

$$note
if you are using `IAM auth`, select either `allow` (recommended) or other option based on your use case.
$$

### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`sslrootcert`).


$$note
Postgres only needs CA Certificate
$$

$$section
### Classification Name $(id="classificationName")

By default, the Postgres policy tags in OpenMetadata are classified under the name `PostgresPolicyTags`. However, you can create a custom classification name of your choice for these tags. Once you have ingested Postgres data, the custom classification name will be visible in the Classifications list on the Tags page.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$


### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.



### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.


## SQLite Connection

### Username $(id="username")

Username to connect to SQLite. Blank for in-memory database.


### Password $(id="password")

Password to connect to SQLite. Blank for in-memory database.



### Host Port $(id="hostPort")
This parameter specifies the host and port of the SQLite instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3306`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3306` as the value.

Keep it blank for in-memory databases.


### Database $(id="database")

Database of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, the OpenMetadata Ingestion attempts to scan all the databases.


$$section
### Database Mode $(id="databaseMode")

How to run the SQLite database. :memory: by default.
$$


### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.



### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.