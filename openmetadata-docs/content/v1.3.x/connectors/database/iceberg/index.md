---
title: Iceberg
slug: /connectors/database/iceberg
---


{% connectorDetailsHeader
name="Iceberg"
stage="BETA"
platform="OpenMetadata"
availableFeatures=["Metadata", "Owners"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "dbt", "Tags", "Stored Procedures"]
/ %}


In this section, we provide guides and references to use the Iceberg connector.

Configure and schedule Iceberg metadata workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)

{% partial file="/v1.3/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/iceberg/yaml"} /%}

## Requirements

The requirements actually depend on the Catalog and the FileSystem used. In a nutshell, the used credentials must have access to reading the Catalog and the Metadata File.

### Glue Catalog

Must have `glue:GetDatabases`, and `glue:GetTables` permissions to be able to read the Catalog.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### DynamoDB Catalog

Must have `dynamodb:DescribeTable` and `dynamodb:GetItem` permissions on the Iceberg Catalog table.

Must also have the `s3:GetObject` permission for the location of the Iceberg tables.

### Hive / REST Catalog
It depends on where and how the Hive / Rest Catalog is setup and where the Iceberg files are stored.
## Metadata Ingestion

{% partial
  file="/v1.3/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "Iceberg",
    selectServicePath: "/images/v1.3/connectors/iceberg/select-service.png",
    addNewServicePath: "/images/v1.3/connectors/iceberg/add-new-service.png",
    serviceConnectionPath: "/images/v1.3/connectors/iceberg/service-connection.png",
}
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

**Glue Catalog**

- [**AWS Credentials**](#aws-credentials)

**DynamoDB Catalog**
- **Table Name**: DynamoDB Table that works as the Iceberg Catalog.
- [**AWS Credentials**](#aws-credentials)

**Hive Catalog**

- **Uri**: Uri to the Hive Metastore.

**For Example**: 'thrift://localhost:9083'

- [**File System**](#file-system)

**REST Catalog**

- **Uri**: Uri to the REST Catalog.

**For Example**: 'http://rest-catalog/ws'.

- **Credential (Optional)**: OAuth2 credential to be used on the authentication flow.
    - **Client ID**: OAuth2 Client ID.
    - **Client Secret**: OAuth2 Client Secret.

- **Token (Optional)**: Bearer Token to use for the 'Authorization' header.

- **SSL (Optional)**:
    - **CA Certificate Path**: Path to the CA Bundle.
    - **Client Certificate Path**: Path to the Client Certificate.
    - **Private Key Path**: Path to the Private Key Certificate.

- **Sigv4 (Optional)**: Needed if signing requests using AWS SigV4 protocol.
    - **Signing AWS Region**: AWS Region to use when signing a request.
    - **Signing Name**: Name to use when signing a request.

- [**File System**](#file-system)

**Common**

- **Database Name (Optional)**: Custom Database Name for your Iceberg Service. If it is not set it will be 'default'.

- **Warehouse Location (Optional)**: Custom Warehouse Location. Most Catalogs already have the Warehouse Location defined properly and this shouldn't be needed. In case of a custom implementation you can pass the location here.

**For example**: 's3://my-bucket/warehouse/'

- **Ownership Property**: Table property to look for the Owner. It defaults to 'owner'.

The Owner should be the same e-mail set on the OpenMetadata user/group.

#### **File System**

- **Local**
- [**AWS Credentials**](#aws-credentials)
- [**Azure Credentials**](#azure-credentials)

#### AWS Credentials

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

- **Profile Name (Not Supported)**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
    When you specify a profile to run a command, the settings and credentials are used to run that command.
    Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

- **Assume Role Arn (Not Supported)**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
    `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

- **Assume Role Session Name (Not Supported)**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
    is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

- **Assume Role Source Identity (Not Supported)**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
    information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).
#### Azure Credentials

- **Client ID** : Client ID of the data storage account

- **Client Secret** : Client Secret of the account

- **Tenant ID** : Tenant ID under which the data storage account falls

- **Account Name** : Account Name of the data Storage

{% /extraContent %}

{% partial file="/v1.3/connectors/test-connection.md" /%}

{% partial file="/v1.3/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.3/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.3/connectors/troubleshooting.md" /%}

{% partial file="/v1.3/connectors/database/related.md" /%}
