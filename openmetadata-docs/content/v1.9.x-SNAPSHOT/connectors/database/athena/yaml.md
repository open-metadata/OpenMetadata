---
title: Run the Athena Connector Externally
description: Configure OpenMetadata's Athena database connector with YAML - step-by-step setup guide, connection parameters, and configuration examples for seamless integration.
slug: /connectors/database/athena/yaml
---

{% connectorDetailsHeader
name="Athena"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Query Usage", "Lineage", "Column-level Lineage", "Data Profiler", "Data Quality", "Tags", "dbt", "Sample Data", "Reverse Metadata (Collate Only)"]
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
{% collateContent %}
- [Reverse Metadata](/connectors/ingestion/workflows/reverse-metadata)
{% /collateContent %}

{% partial file="/v1.9/connectors/external-ingestion-deployment.md" /%}

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
        },
        {
            "Action": [
                "lambda:InvokeFunction"
            ],
            "Effect": "Allow",
            "Resource": [
                "arn:aws:lambda:<<AWS_REGION>>:<<ACCOUNT_ID>>:function:<<CONNECTOR_NAME>>"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey"
            ],
            "Resource": [
                "arn:aws:kms:<<AWS_REGION>>:<<ACCOUNT_ID>>:key/<<KMS_KEY_ID>>"
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

{% partial file="/v1.9/connectors/python-requirements.md" /%}

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

{% partial file="/v1.9/connectors/yaml/common/aws-config-def.md" /%}

{% codeInfo srNumber=9 %}

**s3StagingDir**: The S3 staging directory is an optional parameter. Enter a staging directory to override the default staging directory for AWS Athena.

{% /codeInfo %}

{% codeInfo srNumber=10 %}

**workgroup**: The Athena workgroup is an optional parameter. If you wish to have your Athena connection related to an existing AWS workgroup add your workgroup name here.

{% /codeInfo %}

{% partial file="/v1.9/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=11 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=12 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: athena
  serviceName: local_athena
  serviceConnection:
    config:
      type: Athena
      awsConfig:
```

{% partial file="/v1.9/connectors/yaml/common/aws-config.md" /%}

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

{% partial file="/v1.9/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.9/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.9/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.9/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.9/connectors/yaml/query-usage.md" variables={connector: "athena"} /%}

{% partial file="/v1.9/connectors/yaml/lineage.md" variables={connector: "athena"} /%}

{% partial file="/v1.9/connectors/yaml/data-profiler.md" variables={connector: "athena"} /%}

{% partial file="/v1.9/connectors/yaml/auto-classification.md" variables={connector: "athena"} /%}

{% partial file="/v1.9/connectors/yaml/data-quality.md" /%}

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
