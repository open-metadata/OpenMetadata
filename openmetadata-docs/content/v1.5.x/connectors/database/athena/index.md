---
title: Athena
slug: /connectors/database/athena
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
    - [Service Name](#service-name)
    - [Connection Details](#connection-details)
    - [Metadata Ingestion Options](#metadata-ingestion-options)
- [Troubleshooting](#troubleshooting)
  - [Workflow Deployment Error](#workflow-deployment-error)
- [Related](#related)

{% partial file="/v1.5/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/athena/yaml"} /%}

## Ways to Authenticate:

Here are the methods to [authenticate](/connectors/database/athena/connections) user credentials with the Athena connector.

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
                "athena:ListWorkGroups",
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

## Metadata Ingestion

{% partial 
  file="/v1.5/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "Athena", 
    selectServicePath: "/images/v1.5/connectors/athena/select-service.png",
    addNewServicePath: "/images/v1.5/connectors/athena/add-new-service.png",
    serviceConnectionPath: "/images/v1.5/connectors/athena/service-connection.png",
} 
/%}

{% stepsContainer %}

{% partial file="/v1.5/connectors/test-connection.md" /%}

{% partial file="/v1.5/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.5/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.5/connectors/troubleshooting.md" /%}

{% partial file="/v1.5/connectors/database/related.md" /%}
