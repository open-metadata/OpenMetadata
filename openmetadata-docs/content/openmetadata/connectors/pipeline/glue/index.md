---
title: Glue
slug: /openmetadata/connectors/pipeline/glue
---

<ConnectorIntro service="pipeline" connector="Glue"/>

<Requirements />

<MetadataIngestionService connector="Glue"/>

<h4>Connection Options</h4>

- **AWS Access Key ID**: Enter your secure access key ID for your Glue connection. The specified key ID should be
  authorized to read all databases you want to include in the metadata ingestion workflow.
- **AWS Secret Access Key**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **AWS Region**: Enter the location of the amazon cluster that your data and account are associated with.
- **AWS Session Token (optional)**: The AWS session token is an optional parameter. If you want, enter the details of
  your temporary session token.
- **Endpoint URL (optional)**: Your Glue connector will automatically determine the AWS Glue endpoint URL based on the
  region. You may override this behavior by entering a value to the endpoint URL.

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Glue" />
