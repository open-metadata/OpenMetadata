---
title: Athena
slug: /metadata-ui/connectors/database/athena
---

<ConnectorIntro connector="Athena" hasProfiler="true" hasDBT="true"/>

<Requirements />

<MetadataIngestionService connector="Athena"/>

<h4>Connection Options</h4>

- **AWS Access Key ID**: Enter your secure access key ID for your Athena connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
- **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
- **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
- **Endpoint URL (optional)**: Your Athena connector will automatically determine the AWS Athena endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.
- **Database (optional)**: The database of the data source is an optional parameter if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
- **S3 Staging Directory (optional)**: The S3 staging directory is an optional parameter. Enter a staging dirrectory to override the default staging directory for AWS Athena.
- **Athena Workgroup (optional)**: The Athena workgroup is an optional parameter. If you wish to have your Athena connection related to an existing AWS workgroup add your workgroup name here.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.
    - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
    - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`


<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Athena" hasProfiler="true" hasDBT="true" />
