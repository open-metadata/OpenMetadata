---
title: Run Glue Connector using the CLI
slug: /openmetadata/connectors/database/glue/cli
---

<ConnectorIntro connector="Glue" goal="CLI" hasDBT="true"/>

<Requirements />

<MetadataIngestionServiceDev service="database" connector="Glue" goal="CLI"/>

<h4>Source Configuration - Service Connection</h4>

- **awsAccessKeyId**: Enter your secure access key ID for your Glue connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
- **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **awsRegion**: Enter the location of the amazon cluster that your data and account are associated with.
- **awsSessionToken**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
- **endPointURL**: Your Glue connector will automatically determine the AWS Glue endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.
- **storageServiceName**: OpenMetadata associates objects for each object store entity with a unique namespace. To ensure your data is well-organized and findable, choose a unique name by which you would like to identify the metadata for the object stores you are using through AWS Glue.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Glue during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Glue during the connection. These details must be added as Key-Value pairs.
    - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
    - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`

<MetadataIngestionConfig service="database" connector="Glue" goal="CLI" hasDBT="true"/>
