---
title: BigQuery
slug: /openmetadata/connectors/database/bigquery
---

<ConnectorIntro connector="BigQuery" hasUsage="true" hasProfiler="true" hasDBT="true" />

<Requirements />

<h4>GCP Permissions</h4>

<p> To execute metadata extraction and usage workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions </p>

| # | GCP Permission | GCP Role | Required For |
| :---------- | :---------- | :---------- | :---------- |
| 1 | bigquery.datasets.get | BigQuery Data Viewer | Metadata Ingestion |
| 2 | bigquery.tables.get | BigQuery Data Viewer | Metadata Ingestion |
| 3 | bigquery.tables.getData | BigQuery Data Viewer | Metadata Ingestion |
| 4 | bigquery.tables.list | BigQuery Data Viewer | Metadata Ingestion |
| 5 | resourcemanager.projects.get | BigQuery Data Viewer | Metadata Ingestion |
| 6 | bigquery.jobs.create | BigQuery Job User | Metadata Ingestion |
| 7 | bigquery.jobs.listAll | BigQuery Job User | Metadata Ingestion |
| 8 | datacatalog.taxonomies.get | BigQuery Policy Admin | Fetch Policy Tags |
| 9 | datacatalog.taxonomies.list | BigQuery Policy Admin | Fetch Policy Tags |
| 10 | bigquery.readsessions.create | BigQuery Admin | Bigquery Usage Workflow |
| 11 | bigquery.readsessions.getData | BigQuery Admin | Bigquery Usage Workflow |

<MetadataIngestionService connector="BigQuery"/>

<h4>Connection Options</h4>

- **Host and Port**: This is the BigQuery APIs URL.
- **Username (Optional)**: Specify the User to connect to BigQuery. It should have enough privileges to read all the metadata.
- **Project ID (Optional)**: The BigQuery Project ID is required only if the credentials path is being used instead of values.
- **GCS Credentials**: We support two ways of authenticating to BigQuery:
    1. Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
       - Credentials type, e.g., `service_account`
       - Project ID
       - Private Key ID
       - Private Key
       - Client Email
       - Client ID
       - Auth URI, https://accounts.google.com/o/oauth2/auth by defaul
       - Token URI, https://oauth2.googleapis.com/token by default
       - Authentication Provider X509 Certificate URL, https://www.googleapis.com/oauth2/v1/certs by default
       - Client X509 Certificate U
    2. Passing a local file path that contains the credentials:
       - GCS Credentials Path
- **Enable Policy Tag Import (Optional)**: Mark as 'True' to enable importing policy tags from BigQuery to OpenMetadata.
- **Tag Category Name (Optional)**: If the Tag import is enabled, the name of the Tag Category will be created at OpenMetadata.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to BigQuery during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to BigQuery during the connection. These details must be added as Key-Value pairs. 
  - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
  - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="BigQuery" hasUsage="true" hasProfiler="true" hasDBT="true" />
