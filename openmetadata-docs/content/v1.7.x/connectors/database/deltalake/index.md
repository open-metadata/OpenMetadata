---
title: DeltaLake Connector | OpenMetadata Data Lake Integration
<<<<<<< HEAD
<<<<<<< HEAD
description: Connect Delta Lake to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration options, and metadata extraction tips.
=======
description: Connect OpenMetadata to Delta Lake with our comprehensive database connector guide. Step-by-step setup, configuration, and metadata extraction instructions.
>>>>>>> bd5955fca2 (Docs: SEO Description Updation (#22035))
=======
description: Connect Delta Lake to OpenMetadata with our comprehensive database connector guide. Setup instructions, configuration options, and metadata extraction tips.
>>>>>>> ac8f18500f (Doc: Meta Description Updation)
slug: /connectors/database/deltalake
---

{% connectorDetailsHeader
name="Delta Lake"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "dbt"]
unavailableFeatures=["Query Usage", "Data Profiler", "Data Quality", "Lineage", "Column-level Lineage", "Owners", "Tags", "Stored Procedures", "Sample Data"]
/ %}


In this section, we provide guides and references to use the Delta Lake connector.

Configure and schedule Delta Lake metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Troubleshooting](/connectors/database/deltalake/troubleshooting)

{% partial file="/v1.7/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/deltalake/yaml"} /%}


## Requirements

Delta Lake requires to run with Python 3.9, 3.10 or 3.11. We do not yet support the Delta connector
for Python 3.11

The Delta Lake connector is able to extract the information from a **metastore** or directly from the **storage**.

If extracting directly from the storage, some extra requirements are needed depending on the storage

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

## Metadata Ingestion

{% partial
  file="/v1.7/connectors/metadata-ingestion-ui.md"
  variables={
    connector: "Deltalake",
    selectServicePath: "/images/v1.7/connectors/deltalake/select-service.png",
    addNewServicePath: "/images/v1.7/connectors/deltalake/add-new-service.png",
    serviceConnectionPath: "/images/v1.7/connectors/deltalake/service-connection.png",
}
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details For MetastoreConfig

- **Metastore Host Port**: Enter the Host & Port of Hive Metastore Service to configure the Spark Session. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.
- **Metastore File Path**: Enter the file path to local Metastore in case Spark cluster is running locally. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.
- **Metastore DB**: The JDBC connection to the underlying Hive metastore DB. Either
  of `metastoreHostPort`, `metastoreDb` or `metastoreFilePath` is required.
- **appName (Optional)**: Enter the app name of spark session.
- **Connection Arguments (Optional)**: Key-Value pairs that will be used to pass extra `config` elements to the Spark Session builder.

We are internally running with `pyspark` 3.X and `delta-lake` 2.0.0. This means that we need to consider Spark configuration options for 3.X.

**Metastore Host Port**

When connecting to an External Metastore passing the parameter `Metastore Host Port`, we will be preparing a Spark Session with the configuration

```
.config("hive.metastore.uris", "thrift://{connection.metastoreHostPort}")
```

Then, we will be using the `catalog` functions from the Spark Session to pick up the metadata exposed by the Hive Metastore.

**Metastore File Path**

If instead we use a local file path that contains the metastore information (e.g., for local testing with the default `metastore_db` directory), we will set

```
.config("spark.driver.extraJavaOptions", "-Dderby.system.home={connection.metastoreFilePath}")
```

To update the `Derby` information. More information about this in a great [SO thread](https://stackoverflow.com/questions/38377188/how-to-get-rid-of-derby-log-metastore-db-from-spark-shell).

- You can find all supported configurations [here](https://spark.apache.org/docs/latest/configuration.html)
- If you need further information regarding the Hive metastore, you can find it [here](https://spark.apache.org/docs/latest/sql-data-sources-hive-tables.html),
  and in The Internals of Spark SQL [book](https://jaceklaskowski.gitbooks.io/mastering-spark-sql/content/spark-sql-hive-metastore.html).

**Metastore Database**

You can also connect to the metastore by directly pointing to the Hive Metastore db, e.g., `jdbc:mysql://localhost:3306/demo_hive`.

Here, we will need to inform all the common database settings (url, username, password), and the driver class name for JDBC metastore.

You will need to provide the driver to the ingestion image, and pass the `classpath` which will be used in the Spark Configuration under `spark.driver.extraClassPath`.

#### Connection Details for StorageConfig - S3

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


{% partial file="/v1.7/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.7/connectors/test-connection.md" /%}

{% partial file="/v1.7/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.7/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

{% partial file="/v1.7/connectors/database/related.md" /%}
