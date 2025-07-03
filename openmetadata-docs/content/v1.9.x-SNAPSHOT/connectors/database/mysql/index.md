---
title: MySQL Connector | OpenMetadata Database Integration Guide
description: Set up MySQL database connector for OpenMetadata to automatically discover, catalog, and manage your MySQL metadata. Step-by-step configuration guide.
slug: /connectors/database/mysql
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
- [Data Profiler](/how-to-guides/data-quality-observability/profiler/workflow)
- [Data Quality](/how-to-guides/data-quality-observability/quality)
- [dbt Integration](/connectors/ingestion/workflows/dbt)
- [Enable Security](#securing-mysql-connection-with-ssl-in-openmetadata)
- [Data Lineage](/how-to-guides/data-lineage/workflow)
- [Troubleshooting](/connectors/database/mysql/troubleshooting)
{% collateContent %}
- [Reverse Metadata](#reverse-metadata)
{% /collateContent %}

{% partial file="/v1.9/connectors/ingestion-modes-tiles.md" variables={yamlPath: "/connectors/database/mysql/yaml"} /%}

## Requirements

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

-- Grant show view to extract ddl
GRANT SHOW VIEW ON world.* to '<username>';
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

#### Log Table Management
The `mysql.general_log` table grows continuously as it stores query logs. This can consume significant storage space over time and affect the execution time of lineage and usage procedures.

- Note: We recommend cleaning up log tables only after successful execution of Usage & Lineage workflows to ensure no loss of query data during extraction. Once cleanup occurs, the query history is lost.

Here are some important considerations and best practices:

### Create Manual Schedule to rotate logs

When you rotate log tables manually, the current log table is copied to a backup log table and the entries in the current log table are removed. If the backup log table already exists, then it is deleted before the current log table is copied to the backup. You can query the backup log table if needed. The backup log table for the `mysql.general_log` table is named `mysql.general_log_backup`.
The backup log table for the `mysql.slow_log table` is named `mysql.slow_log_backup`
```sql
-- rotate general logs
CREATE PROCEDURE rotate_general_log()
BEGIN
  -- Step 1: Drop the backup table if it exists
  DROP TABLE IF EXISTS mysql.general_log_backup;

  -- Step 2: Copy current general_log table to backup
  CREATE TABLE mysql.general_log_backup AS SELECT * FROM mysql.general_log;

  -- Step 3: Truncate the general_log table (clears all records)
  TRUNCATE TABLE mysql.general_log;
END;
-- call this procedure
CALL rotate_general_log();

-- rotate slow logs
CREATE PROCEDURE rotate_slow_log()
BEGIN
  DROP TABLE IF EXISTS mysql.slow_log_backup;
  CREATE TABLE mysql.slow_log_backup AS SELECT * FROM mysql.slow_log;
  TRUNCATE TABLE mysql.slow_log;
END
-- call this procedure
CALL rotate_slow_log();
```

You can also check table size by running below query
```sql
SELECT table_name, round(data_length/1024/1024, 2) AS size_in_mb
FROM information_schema.tables
WHERE table_schema = 'mysql' AND table_name IN ('general_log', 'slow_log', 'general_log_backup', 'slow_log_backup');
```

### Create Automatic Event to clear older logs

You can also create automatic event like showed below which runs every week to clear older logs.
```sql
CREATE EVENT mysql.cleanup_general_log ON SCHEDULE EVERY 7 DAY DO DELETE FROM mysql.general_log WHERE event_time < NOW() - INTERVAL 7 DAY;
```

Note: If you are using rds then you can rotate the `mysql.general_log` table manually by calling the `mysql.rds_rotate_general_log` procedure. You can rotate the `mysql.slow_log` table by calling the `mysql.rds_rotate_slow_log` procedure.

You can also check below docs about more info on logs & its rotation methods.
- [Rotating mysql query logs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/mysql-stored-proc-logging.html)
- [RDS for MySQL database logs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_LogAccess.MySQL.LogFileSize.html#USER_LogAccess.MySQL.Generallog)
- [Aurora for MySQL database logs](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_LogAccess.MySQL.LogFileSize.html#USER_LogAccess.MySQL.Generallog)

**Best Practices**:
- Monitor log table size regularly
- Implement a log rotation schedule
- Consider automating log cleanup after DAG execution
- Keep logging enabled only when needed for lineage extraction

### Profiler & Data Quality
Executing the profiler workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](/how-to-guides/data-quality-observability/quality).

## Metadata Ingestion

{% partial 
  file="/v1.9/connectors/metadata-ingestion-ui.md" 
  variables={
    connector: "MySQL", 
    selectServicePath: "/images/v1.9/connectors/mysql/select-service.png",
    addNewServicePath: "/images/v1.9/connectors/mysql/add-new-service.png",
    serviceConnectionPath: "/images/v1.9/connectors/mysql/service-connection.png",
} 
/%}

{% stepsContainer %}
{% extraContent parentTagName="stepsContainer" %}

#### Connection Details

- **Username**: Specify the User to connect to MySQL. It should have enough privileges to read all the metadata.
- **Auth Type**: Basic Auth or IAM based auth to connect to instances / cloud rds.
  - **Basic Auth**: 
    - **Password**: Password to connect to MySQL.
  - **IAM Based Auth**: 
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

    {%note%}
    When using Assume Role authentication, ensure you provide the following details:  
    - **AWS Region**: Specify the AWS region for your deployment.  
    {%/note%}

    - **Assume Role Session Name**: An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
      is assumed by different principals or for different reasons.

    By default, we'll use the name `OpenMetadataSession`.

    Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

    - **Assume Role Source Identity**: The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
      information in AWS CloudTrail logs to determine who took actions with a role.

    Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).
- **Host and Port**: Enter the fully qualified hostname and port number for your MySQL deployment in the Host and Port field.
- **databaseName**: Optional name to give to the database in OpenMetadata. If left blank, we will use default as the database name.
- **databaseSchema**: databaseSchema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single databaseSchema. When left blank, OpenMetadata Ingestion attempts to scan all the databaseSchema.
- **caCertificate**: Provide the path to ssl ca file.
- **sslCertificate**: Provide the path to ssl client certificate file (ssl_cert).
- **sslKey**: Provide the path to ssl client certificate file (ssl_key).

{% partial file="/v1.9/connectors/database/advanced-configuration.md" /%}

{% /extraContent %}

{% partial file="/v1.9/connectors/test-connection.md" /%}

{% partial file="/v1.9/connectors/database/configure-ingestion.md" /%}

{% partial file="/v1.9/connectors/ingestion-schedule-and-deploy.md" /%}

{% /stepsContainer %}

## Securing MySQL Connection with SSL in OpenMetadata

To establish secure connections between OpenMetadata and MySQL, navigate to the `Advanced Config` section. Here, you can provide the CA certificate used for SSL validation by specifying the `caCertificate`.  Alternatively, if both client and server require mutual authentication, you'll need to use all three parameters: `ssl_key`, `ssl_cert`, and `ssl_ca`. In this case, `ssl_cert` is used for the client's SSL certificate, `ssl_key` for the private key associated with the SSL certificate, and `ssl_ca` for the CA certificate to validate the server's certificate.

{% image
  src="/images/v1.9/connectors/ssl_connection.png"
  alt="SSL Configuration"
  height="450px"
  caption="SSL Configuration" /%}

{% collateContent %}
{% partial file="/v1.9/connectors/database/mysql/reverse-metadata.md" /%}
{% /collateContent %}

{% partial file="/v1.9/connectors/database/related.md" /%}
