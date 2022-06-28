---
title: DynamoDB
slug: /metadata-ui/connectors/database/dynamodb
---

<ConnectorIntro connector="DynamoDB" hasDBT="true"/>

<Requirements />

<MetadataIngestionService connector="DynamoDB"/>

<h4>Connection Options</h4>

- **AWS Access Key ID**: Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.
- **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
- **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.
- **Endpoint URL (optional)**: Your DynamoDB connector will automatically determine the AWS DynamoDB endpoint URL based on the region. You may override this behavior by entering a value to the endpoint URL.
name here.
- **Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to DynamoDB during the connection. These details must be added as Key-Value pairs.
- **Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to DynamoDB during the connection. These details must be added as Key-Value pairs.
    - In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`
    - In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "externalbrowser"`


<IngestionScheduleAndDeploy />

<ConnectorOutro connector="DynamoDB" hasDBT="true" />
