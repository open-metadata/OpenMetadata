---
title: Run Glue Connector using Airflow SDK
slug: /openmetadata/connectors/pipeline/glue/airflow
---

<ConnectorIntro connector="Glue" goal="Airflow"/>

<Requirements />

<MetadataIngestionServiceDev service="pipeline" connector="GluePipeline" goal="Airflow"/>

<h4>Source Configuration - Service Connection</h4>

- **awsAccessKeyId**: Enter your secure access key ID for your Glue connection. The specified key ID should be
  authorized to read all databases you want to include in the metadata ingestion workflow.
- **awsSecretAccessKey**: Enter the Secret Access Key (the passcode key pair to the key ID from above).
- **awsRegion**: Enter the location of the amazon cluster that your data and account are associated with.
- **awsSessionToken**: The AWS session token is an optional parameter. If you want, enter the details of your temporary
  session token.
- **endPointURL**: Your Glue connector will automatically determine the AWS Glue endpoint URL based on the region. You
  may override this behavior by entering a value to the endpoint URL.

<MetadataIngestionConfig service="pipeline" connector="Glue" goal="Airflow" />
