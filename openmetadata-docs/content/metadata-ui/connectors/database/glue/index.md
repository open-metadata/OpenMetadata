---
title: Glue
slug: /metadata-ui/connectors/database/glue
---

<ConnectorIntro connector="Glue" hasDBT="true"/>

<Requirements />

<MetadataIngestionService connector="Glue"/>

<h4>Connection Options</h4>

- **AWS Access Key ID**: Enter your secure access key ID for your Glue connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
- **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
- **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
- **Endpoint URL (optional)**: Your Glue connector will automatically determine the AWS Glue endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.
- **Database (optional)**: The database of the data source is an optional parameter if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **Storage Service Name**: OpenMetadata associates objects for each object store entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for the object stores you are using through AWS Glue.
- **Pipeline Service Name**: OpenMetadata associates each pipeline entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for pipelines you are using through AWS Glue. When this metadata has been ingested you will find it in the OpenMetadata UI pipelines view under the name you have specified.
- **Database (Optional)**: The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases. For Glue, we use the Catalog ID as the database when mapping Glue metadata to OpenMetadata Entities.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Glue during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Glue during the connection. These details must be added as Key-Value pairs.
    - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
    - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`


<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Glue" hasDBT="true" />
