---
title: Datalake
slug: /openmetadata/connectors/database/datalake
---

<ConnectorIntro connector="Datalake" />

<Requirements />

<MetadataIngestionService connector="Datalake"/>

<h4>Connection Options</h4>

<Collapse title="Datalake using AWS S3">

<Image src="/images/openmetadata/connectors/datalake/service-connection-using-aws-s3.png" alt="create-account"/>


**AWS Access Key ID**

Enter your secure access key ID for your DynamoDB connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.

**AWS Secret Access Key**

Enter the Secret Access Key (the passcode key pair to the key ID from above).

**AWS Region**

Specify the region in which your DynamoDB is located.

Note: This setting is required even if you have configured a local AWS profile.

**AWS Session Token**

The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.

**Endpoint URL (optional)**

The DynamoDB connector will automatically determine the DynamoDB endpoint URL based on the AWS Region. You may specify a value to override this behavior.

**Database (Optional)**

The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.

**Connection Options (Optional)**

Enter the details for any additional connection options that can be sent to DynamoDB during the connection. These details must be added as Key-Value pairs.

**Connection Arguments (Optional)**

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to DynamoDB during the connection. These details must be added as Key-Value pairs.

</Collapse>

<Collapse title="Datalake using GCS">

<Image src="/images/openmetadata/connectors/datalake/service-connection-using-gcs.png" alt="service-connection-using-gcs"/>

**BUCKET NAME**

This is the Bucket Name in GCS.

**PREFIX**

This is the Bucket Name in GCS.

**GCS Credentials**

We support two ways of authenticating to GCS:

1. Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
   1. Credentials type, e.g. `service_account`.
   2. Project ID
   3. Private Key ID
   4. Private Key
   5. Client Email
   6. Client ID
   7. Auth URI, [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
   8. Token URI, [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
   9. Authentication Provider X509 Certificate URL, [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
   10. Client X509 Certificate URL

</Collapse>

<IngestionScheduleAndDeploy />

<ConnectorOutro connector="Datalake" goal="Airflow"  />
