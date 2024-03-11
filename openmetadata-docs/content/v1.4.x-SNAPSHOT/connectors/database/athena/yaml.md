---
title: Run the Athena Connector Externally
slug: /connectors/database/athena/yaml
---

{% connectorDetailsHeader
name="Athena"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Tags", "dbt"]
unavailableFeatures=["Owners", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the Athena connector.

Configure and schedule Athena metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Query Usage](#query-usage)
- [Lineage](#lineage)
- [Data Profiler](#data-profiler)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)

{% partial file="/v1.3/connectors/external-ingestion-deployment.md" /%}

## Requirements

The Athena connector ingests metadata through JDBC connections.

{% note %}

According to AWS's official [documentation](https://docs.aws.amazon.com/athena/latest/ug/policy-actions.html):

*If you are using the JDBC or ODBC driver, ensure that the IAM
permissions policy includes all of the actions listed in [AWS managed policy: AWSQuicksightAthenaAccess](https://docs.aws.amazon.com/athena/latest/ug/managed-policies.html#awsquicksightathenaaccess-managed-policy).*

{% /note %}

This policy groups the following permissions:

- `athena` – Allows the principal to run queries on Athena resources.
- `glue` – Allows principals access to AWS Glue databases, tables, and partitions. This is required so that the principal can use the AWS Glue Data Catalog with Athena. Resources of each table and database needs to be added as resource for each database user wants to ingest.
- `lakeformation` – Allows principals to request temporary credentials to access data in a data lake location that is registered with Lake Formation and allows access to the LF-tags linked to databases, tables and columns.

And is defined as:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "athena:ListTableMetadata",
                "athena:ListDatabases",
                "athena:GetTableMetadata",
                "athena:ListQueryExecutions",
                "athena:StartQueryExecution",
                "athena:GetQueryExecution",
                "athena:GetQueryResults",
                "athena:BatchGetQueryExecution"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:athena:<<AWS_REGION>>:<<ACCOUNT_ID>>:workgroup/<<WORKGROUP_NAME>>",
                "arn:aws:athena:<<AWS_REGION>>:<<ACCOUNT_ID>>:datacatalog/<<DATA_CATALOG_NAME>>"
            ]
        },
        {
            "Action": [
                "glue:GetTables",
                "glue:GetTable",
                "glue:GetDatabases",
                "glue:GetPartitions"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:glue:<AWS_REGION>:<ACCOUNT_ID>:table/<<DATABASE_NAME>>/*",
                "arn:aws:glue:<AWS_REGION>:<ACCOUNT_ID>:database/<<DATABASE_NAME>>",
                "arn:aws:glue:<AWS_REGION>:<ACCOUNT_ID>:catalog"
            ]
        },
        {
            "Action": [
                "s3:ListBucket",
                "s3:GetObject",
                "s3:GetBucketLocation",
                "s3:PutObject"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:s3:::<<ATHENA_S3_BUCKET>>/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
              "lakeformation:GetResourceLFTags"
            ],
            "Resource": [
                "arn:aws:athena:<<AWS_REGION>>:<<ACCOUNT_ID>>:datacatalog/<<DATA_CATALOG_NAME>>/database/<<DATABASE_NAME>>"
                "arn:aws:athena:<<AWS_REGION>>:<<ACCOUNT_ID>>:datacatalog/<<DATA_CATALOG_NAME>>/database/<<DATABASE_NAME>>/table/<<TABLE_NAME>>"
                "arn:aws:athena:<<AWS_REGION>>:<<ACCOUNT_ID>>:datacatalog/<<DATA_CATALOG_NAME>>/database/<<DATABASE_NAME>>/table/<<TABLE_NAME>>/column/<<COLUMN_NAME>>"
            ]
        }
    ]
}
```

### LF-Tags
Athena connector ingests and creates LF-tags in OpenMetadata with LF-tag key mapped to OpenMetadata's classification and the values mapped to tag labels. To ingest LF-tags provide the appropriate permissions as to the resources as mentioned above and enable the `includeTags` toggle in the ingestion config.

{% note %}

If you have external services other than glue and facing permission issues, add the permissions to the list above.

{% /note %}


You can find further information on the Athena connector in the [docs](/connectors/database/athena).

### Python Requirements

To run the Athena ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[athena]"
```

## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/athenaConnection.json)
you can find the structure to create a connection to Athena.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for Athena:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

- **awsAccessKeyId** & **awsSecretAccessKey**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

{% /codeInfo %}

{% codeInfo srNumber=2 %}
**awsSessionToken**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.

{% /codeInfo %}

{% codeInfo srNumber=3 %}

**awsRegion**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

{% /codeInfo %}

{% codeInfo srNumber=4 %}

**endPointURL**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**profileName**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
When you specify a profile to run a command, the settings and credentials are used to run that command.
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

{% /codeInfo %}

{% codeInfo srNumber=6 %}

**assumeRoleArn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).
{% /codeInfo %}

{% codeInfo srNumber=7 %}

**assumeRoleSessionName**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

{% /codeInfo %}

{% codeInfo srNumber=8 %}

**assumeRoleSourceIdentity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

{% /codeInfo %}

{% codeInfo srNumber=9 %}

**s3StagingDir**: The S3 staging directory is an optional parameter. Enter a staging directory to override the default staging directory for AWS Athena.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

**workgroup**: The Athena workgroup is an optional parameter. If you wish to have your Athena connection related to an existing AWS workgroup add your workgroup name here.

{% /codeInfo %}

{% partial file="/v1.3/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=11 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Athena during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml
source:
  type: athena
  serviceName: local_athena
  serviceConnection:
    config:
      type: Athena
      awsConfig:
```
```yaml {% srNumber=1 %}
        awsAccessKeyId: KEY
        awsSecretAccessKey: SECRET
```
```yaml {% srNumber=2 %}
        # awsSessionToken: TOKEN
```
```yaml {% srNumber=3 %}
        awsRegion: us-east-2
```
```yaml {% srNumber=4 %}
        # endPointURL: https://athena.us-east-2.amazonaws.com/custom
```
```yaml {% srNumber=5 %}
        # profileName: profile
```
```yaml {% srNumber=6 %}
        # assumeRoleArn: "arn:partition:service:region:account:resource"
```
```yaml {% srNumber=7 %}
        # assumeRoleSessionName: session
```
```yaml {% srNumber=8 %}
        # assumeRoleSourceIdentity: identity
```
```yaml {% srNumber=9 %}
      s3StagingDir: s3 directory for datasource
```
```yaml {% srNumber=10 %}
      workgroup: workgroup name
```
```yaml {% srNumber=11 %}
      # connectionOptions:
        # key: value
```
```yaml {% srNumber=12 %}
      # connectionArguments:
        # key: value
```

{% partial file="/v1.3/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.3/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.3/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.3/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.3/connectors/yaml/query-usage.md" variables={connector: "athena"} /%}

{% partial file="/v1.3/connectors/yaml/lineage.md" variables={connector: "athena"} /%}

{% partial file="/v1.3/connectors/yaml/data-profiler.md" variables={connector: "athena"} /%}

{% partial file="/v1.3/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
