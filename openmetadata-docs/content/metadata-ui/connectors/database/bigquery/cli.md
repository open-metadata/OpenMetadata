---
title: Run BigQuery Connector using the CLI
slug: /metadata-ui/connectors/database/bigquery/cli
---

<ConnectorIntro connector="BigQuery" goal="CLI" hasUsage="true" hasProfiler="true" hasDBT="true" />

<Requirements />

<MetadataIngestionServiceDev service="database" connector="BigQuery" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **hostPort**: This is the BigQuery APIs URL.
- **username**: (Optional) Specify the User to connect to BigQuery. It should have enough privileges to read all the metadata.
- **projectID**: (Optional) The BigQuery Project ID is required only if the credentials path is being used instead of values.
- **credentials**: We support two ways of authenticating to BigQuery inside **gcsConfig**
    1. Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
        - **type**, e.g., `service_account`
        - **projectId**
        - **privateKey**
        - **privateKeyId**
        - **clientEmail**
        - **clientId**
        - **authUri**, https://accounts.google.com/o/oauth2/auth by defaul
        - **tokenUri**, https://oauth2.googleapis.com/token by default
        - **authProviderX509CertUrl**, https://www.googleapis.com/oauth2/v1/certs by default
        - **clientX509CertUrl**
    2. Passing a local file path that contains the credentials:
        - **gcsCredentialsPath**

If you prefer to pass the credentials file, you can do so as follows:
```yaml
credentials:
  gcsConfig:
    gcsCredentialsPath: <path to file>
```

- **Enable Policy Tag Import (Optional)**: Mark as 'True' to enable importing policy tags from BigQuery to OpenMetadata.
- **Tag Category Name (Optional)**: If the Tag import is enabled, the name of the Tag Category will be created at OpenMetadata.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to BigQuery during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to BigQuery during the connection. These details must be added as Key-Value pairs.
    - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
    - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<MetadataIngestionConfig service="database" connector="BigQuery" goal="CLI" hasUsage="true" hasProfiler="true" hasDBT="true"/>
