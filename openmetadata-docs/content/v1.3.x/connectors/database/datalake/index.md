---
title: Datalake
slug: /connectors/database/datalake
---

{% connectorDetailsHeader
name="Datalake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality"]
unavailableFeatures=["Query Usage", "Lineage", "Column-level Lineage", "Owners", "dbt", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Datalake connector.

Configure and schedule Datalake metadata and profiler workflows from the OpenMetadata UI:
- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](/connectors/ingestion/workflows/profiler)
- [Data Quality](/connectors/ingestion/workflows/data-quality)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/datalake/yaml"} /%}

## Requirements

{% note %}
The Datalake connector supports extracting metadata from file types `JSON`, `CSV`, `TSV` & `Parquet`.
{% /note %}

### S3 Permissions

To execute metadata extraction AWS account should have enough access to fetch required data. The <strong>Bucket Policy</strong> in AWS requires at least these permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::<my bucket>",
                "arn:aws:s3:::<my bucket>/*"
            ]
        }
    ]
}
```

### ADLS Permissions

To extract metadata from Azure ADLS (Storage Account - StorageV2), you will need an **App Registration** with the following
permissions on the Storage Account:
- Storage Blob Data Contributor
- Storage Queue Data Contributor

## Metadata Ingestion

{% partial 
  file="/v1.3/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Datalake", 
    selectServicePath: "/images/v1.3/connectors/datalake/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/datalake/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/datalake/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details for AWS

- **AWS Access Key ID** & **AWS Secret Access Key**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

- **AWS Region**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

- **AWS Session Token (optional)**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
  and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).

- **Endpoint URL (optional)**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
  entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
  default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

- **Profile Name**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
  When you specify a profile to run a command, the settings and credentials are used to run that command.
  Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

- **Assume Role Arn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
  `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

- **Assume Role Session Name**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
  is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

- **Assume Role Source Identity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
  information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

#### Connection Details for GCS

- **Bucket Name**: A bucket name in DataLake is a unique identifier used to organize and store data objects.
  It's similar to a folder name, but it's used for object storage rather than file storage.

- **Prefix**: The prefix of a data source in datalake refers to the first part of the data path that identifies the source or origin of the data. It's used to organize and categorize data within the datalake, and can help users easily locate and access the data they need.

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

#### Connection Details for Azure

- **Azure Credentials**

  - **Client ID** : Client ID of the data storage account
  - **Client Secret** : Client Secret of the account
  - **Tenant ID** : Tenant ID under which the data storage account falls
  - **Account Name** : Account Name of the data Storage

- **Required Roles**

  Please make sure the following roles associated with the data storage account.
   - `Storage Blob Data Contributor`
   - `Storage Queue Data Contributor`

The current approach for authentication is based on `app registration`, reach out to us on [slack](https://slack.open-metadata.org/) if you find the need for another auth system

{% partial file="/v1.3/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
