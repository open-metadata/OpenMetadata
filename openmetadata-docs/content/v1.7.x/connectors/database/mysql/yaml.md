---
title: Run the MySQL Connector Externally
description: Configure MySQL database connections in OpenMetadata using YAML. Step-by-step setup guide with examples, authentication options, and troubleshooting tips.
slug: /connectors/database/mysql/yaml
---

{% connectorDetailsHeader
name="MySQL"
stage="PROD"
platform="OpenMetadata"
availableFeatures=["Metadata", "Data Profiler", "Data Quality", "dbt", "View Lineage", "View Column-level Lineage", "Query Usage", "Sample Data", "Reverse Metadata (Collate Only)"]
unavailableFeatures=["Owners", "Tags", "Stored Procedures"]
/ %}

In this section, we provide guides and references to use the MySQL connector.

Configure and schedule MySQL metadata and profiler workflows from the OpenMetadata UI:

- [Requirements](#requirements)
- [Metadata Ingestion](#metadata-ingestion)
- [Data Profiler](#data-profiler)
- [Lineage](#lineage)
- [Data Quality](#data-quality)
- [dbt Integration](#dbt-integration)
- [Enable Security](#securing-mysql-connection-with-ssl-in-openmetadata)
{% collateContent %}
- [Reverse Metadata](/connectors/ingestion/workflows/reverse-metadata)
{% /collateContent %}
{% partial file="/v1.7/connectors/external-ingestion-deployment.md" /%}

## Requirements

### Python Requirements

{% partial file="/v1.7/connectors/python-requirements.md" /%}

To run the MySQL ingestion, you will need to install:

```bash
pip3 install "openmetadata-ingestion[mysql]"
```

### Metadata

Note that We support MySQL (version 8.0.0 or greater) and the user should have access to the `INFORMATION_SCHEMA` table.  By default a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

```SQL
-- Create user. If <hostName> is omitted, defaults to '%'
-- More details https://dev.mysql.com/doc/refman/8.0/en/create-user.html
CREATE USER '<username>'[@'<hostName>'] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
```

### Lineage & Usage 
To extract lineage & usage you need to enable the query logging in mysql and the user used in the connection needs to have select access to the `mysql.general_log`.

```sql
-- Enable Logging 
SET GLOBAL general_log='ON';
set GLOBAL log_output='table';

-- Grant SELECT on log table
GRANT SELECT ON mysql.general_log TO '<username>'@'<host>';
```

### 1. Define the YAML Config

This is a sample config for MySQL Lineage:

{% codePreview %}

{% codeInfoContainer %}

{% codeInfo srNumber=40 %}
#### Source Configuration - Source Config

You can find all the definitions and types for the  `sourceConfig` [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryLineagePipeline.json).

{% /codeInfo %}

{% codeInfo srNumber=41 %}

**queryLogDuration**: Configuration to tune how far we want to look back in query logs to process lineage data in days.

{% /codeInfo %}

{% codeInfo srNumber=42 %}

**parsingTimeoutLimit**: Configuration to set the timeout for parsing the query in seconds.
{% /codeInfo %}

{% codeInfo srNumber=43 %}

**filterCondition**: Condition to filter the query history.

{% /codeInfo %}

{% codeInfo srNumber=44 %}

**resultLimit**: Configuration to set the limit for query logs.

{% /codeInfo %}

{% codeInfo srNumber=45 %}

**queryLogFilePath**: Configuration to set the file path for query logs.

{% /codeInfo %}

{% codeInfo srNumber=46 %}

**databaseFilterPattern**: Regex to only fetch databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=47 %}

**schemaFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}

{% codeInfo srNumber=48 %}

**tableFilterPattern**: Regex to only fetch tables or databases that matches the pattern.

{% /codeInfo %}


{% codeInfo srNumber=49 %}

**overrideViewLineage**: Set the 'Override View Lineage' toggle to control whether to override the existing view lineage.

{% /codeInfo %}


{% codeInfo srNumber=51 %}

**processViewLineage**: Set the 'Process View Lineage' toggle to control whether to process view lineage.

{% /codeInfo %}


{% codeInfo srNumber=52 %}

**processQueryLineage**: Set the 'Process Query Lineage' toggle to control whether to process query lineage.

{% /codeInfo %}


{% codeInfo srNumber=53 %}

**processStoredProcedureLineage**: Set the 'Process Stored ProcedureLog Lineage' toggle to control whether to process stored procedure lineage.

{% /codeInfo %}


{% codeInfo srNumber=54 %}

**threads**: Number of Threads to use in order to parallelize lineage ingestion.

{% /codeInfo %}


{% codeInfo srNumber=55 %}

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `type: metadata-rest`.
{% /codeInfo %}


{% codeInfo srNumber=50 %}

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}


```yaml {% srNumber=40 %}
source:
  type: mysql-lineage
  serviceName: local_mysql
  sourceConfig:
    config:
      type: DatabaseLineage
```

```yaml {% srNumber=41 %}
      # Number of days to look back
      queryLogDuration: 1
```
```yaml {% srNumber=42 %}
      parsingTimeoutLimit: 300
```
```yaml {% srNumber=43 %}
      # filterCondition: query_text not ilike '--- metabase query %'
```
```yaml {% srNumber=44 %}
      resultLimit: 1000
```
```yaml {% srNumber=45 %}
      # If instead of getting the query logs from the database we want to pass a file with the queries
      # queryLogFilePath: /tmp/query_log/file_path
```
```yaml {% srNumber=46 %}
      # databaseFilterPattern:
      #   includes:
      #     - database1
      #     - database2
      #   excludes:
      #     - database3
      #     - database4
```
```yaml {% srNumber=47 %}
      # schemaFilterPattern:
      #   includes:
      #     - schema1
      #     - schema2
      #   excludes:
      #     - schema3
      #     - schema4
```
```yaml {% srNumber=48 %}
      # tableFilterPattern:
      #   includes:
      #     - table1
      #     - table2
      #   excludes:
      #     - table3
      #     - table4
```

```yaml {% srNumber=51 %}
      overrideViewLineage: false
```

```yaml {% srNumber=52 %}
      processViewLineage: true
```

```yaml {% srNumber=53 %}
      processQueryLineage: true
```

```yaml {% srNumber=54 %}
      processStoredProcedureLineage: true
```

```yaml {% srNumber=55 %}
      threads: 1
```

```yaml {% srNumber=49 %}
sink:
  type: metadata-rest
  config: {}
```

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

- You can learn more about how to configure and run the Lineage Workflow to extract Lineage data from [here](/connectors/ingestion/workflows/lineage)

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).



## Metadata Ingestion

All connectors are defined as JSON Schemas.
[Here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/mysqlConnection.json)
you can find the structure to create a connection to MySQL.

In order to create and run a Metadata Ingestion workflow, we will follow
the steps to create a YAML configuration able to connect to the source,
process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following
[JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/workflow.json)

### 1. Define the YAML Config

This is a sample config for MySQL:

{% codePreview %}

{% codeInfoContainer %}

#### Source Configuration - Service Connection

{% codeInfo srNumber=1 %}

**username**: Specify the User to connect to MySQL. It should have enough privileges to read all the metadata.

{% /codeInfo %}

{% codeInfo srNumber=2 %}

**authType**: Choose from basic auth and IAM based auth.
#### Basic Auth

**password**: Password comes under Basic Auth type.

{% /codeInfo %}

{% codeInfo srNumber=3 %}
#### IAM BASED Auth

- **awsAccessKeyId** & **awsSecretAccessKey**: When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have
  permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
  authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts: An **access key ID** (for example, `AKIAIOSFODNN7EXAMPLE`), and a **secret access key** (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html).

**awsSessionToken**: If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.


**awsRegion**: Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.

You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).


**endPointURL**: To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).


**profileName**: A named profile is a collection of settings and credentials that you can apply to a AWS CLI command.
When you specify a profile to run a command, the settings and credentials are used to run that command.
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).


**assumeRoleArn**: Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account
administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

{%note%}
When using Assume Role authentication, ensure you provide the following details:  
- **AWS Region**: Specify the AWS region for your deployment.  
- **Assume Role ARN**: Provide the ARN of the role in your AWS account that OpenMetadata will assume.  
{%/note%}

**assumeRoleSessionName**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).


**assumeRoleSourceIdentity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

{% /codeInfo %}


{% codeInfo srNumber=4 %}

**Host and Port**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.

{% /codeInfo %}

{% codeInfo srNumber=5 %}

**databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/database/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

#### Advanced Configuration

{% codeInfo srNumber=6 %}

**Connection Options (Optional)**: Enter the details for any additional connection options that can be sent to database during the connection. These details must be added as Key-Value pairs.

{% /codeInfo %}

{% codeInfo srNumber=7 %}

**Connection Arguments (Optional)**: Enter the details for any additional connection arguments such as security or protocol configs that can be sent to database during the connection. These details must be added as Key-Value pairs.

- In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key-Value pair as follows: `"authenticator" : "sso_login_url"`

{% /codeInfo %}

{% /codeInfoContainer %}

{% codeBlock fileName="filename.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: mysql
  serviceName: <service name>
  serviceConnection:
    config:
      type: Mysql
```
```yaml {% srNumber=1 %}
      username: <username>
```
```yaml {% srNumber=2 %}
      authType: 
        password: <password>
```
```yaml {% srNumber=3 %}
      authType: 
        awsConfig:
          awsAccessKeyId: access key id
          awsSecretAccessKey: access secret key
          awsRegion: aws region name
```
```yaml {% srNumber=4 %}
      hostPort: <hostPort>
```
```yaml {% srNumber=5 %}
      databaseSchema: schema
```

```yaml {% srNumber=6 %}
      # connectionOptions:
      #   key: value
```
```yaml {% srNumber=7 %}
      # connectionArguments:
      #   key: value
```

{% partial file="/v1.7/connectors/yaml/database/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

{% partial file="/v1.7/connectors/yaml/ingestion-cli.md" /%}

{% partial file="/v1.7/connectors/yaml/lineage.md" variables={connector: "mysql"} /%}

{% partial file="/v1.7/connectors/yaml/data-profiler.md" variables={connector: "mysql"} /%}

{% partial file="/v1.7/connectors/yaml/auto-classification.md" variables={connector: "mysql"} /%}

{% partial file="/v1.7/connectors/yaml/data-quality.md" /%}

## Securing MySQL Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and MySQL, navigate to the Advanced Config section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`.  Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client’s SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server’s certificate.
```yaml
      sslConfig:
            caCertificate: "/path/to/ca_certificate"
            sslCertificate: "/path/to/your/ssl_cert"
            sslKey: "/path/to/your/ssl_key"
```

## dbt Integration

{% tilesContainer %}

{% tile
  icon="mediation"
  title="dbt Integration"
  description="Learn more about how to ingest dbt models' definitions and their lineage."
  link="/connectors/ingestion/workflows/dbt" /%}

{% /tilesContainer %}
