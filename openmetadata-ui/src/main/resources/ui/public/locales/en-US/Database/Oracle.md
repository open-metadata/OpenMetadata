# Oracle

In this section, we provide guides and references to use the Oracle connector.

## Requirements

$$note
To retrieve metadata from an Oracle database, the `python-oracledb` library is used, which provides support for versions `12c`, `18c`, `19c`, and `21c`.
$$

To ingest metadata from oracle user must have the following permissions:
- `CREATE SESSION` privilege for the user.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER 
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;

-- GRANT SELECT CATALOG ROLE PRIVILEGE TO FETCH METADATA TO ROLE / USER
GRANT SELECT_CATALOG_ROLE TO new_role;
```

- `GRANT SELECT` on the relevant tables which are to be ingested into OpenMetadata to the user
```sql
GRANT SELECT ON table_name TO {user | role};
```

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `all_objects` and `all_tables` for all objects in the database. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

### Usage & Lineage
For the usage and lineage workflow, the user will need `SELECT` privilege. You can find more information on the usage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage" target="_blank">here</a> and the lineage workflow <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/lineage" target="_blank">here</a>.

You can find further information on the Oracle connector in the <a href="https://docs.open-metadata.org/connectors/database/oracle" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

**oracle+cx_oracle**: Sqlalchemy scheme to connect to Oracle.
$$

$$section
### Username $(id="username")

Username to connect to Oracle. This user should have privileges to read all the metadata in Oracle.
$$

$$section
### Password $(id="password")

Password to connect to Oracle.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the Oracle instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:1521`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:1521` as the value.
$$

$$section
### Oracle Connection Type $(id="oracleConnectionType")

Connect with oracle by either passing service name or database schema name.

- **Database Schema**: Using a database schema name when connecting to an Oracle database allows the user to access only the objects within that schema, rather than the entire database.
- **Oracle Service Name**: Oracle Service Name is a unique identifier for a database instance or group of instances that perform a particular function.
- **Oracle TNS Connection**: You can directly use the TNS connection string, e.g., `(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME)))`.
$$

$$section
### Oracle Service Name $(id="oracleServiceName")

The Oracle Service Name is the TNS alias that you give when you remotely connect to your database and this Service name is recorded in `tnsnames`.
$$

$$section
### Database Schema $(id="databaseSchema")

The name of the Database Schema available in Oracle that you want to connect with.
$$

$$section
### Oracle TNS Connection $(id="oracleTNSConnection")

TNS connection string you would set in `tnsnames.ora`, e.g., `(DESCRIPTION=(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=myhost)(PORT=1530)))(CONNECT_DATA=(SID=MYSERVICENAME)))`.

Note that if this is informed, we will ignore the `hostPort` property, so you should make sure that the `HOST` entry is present here.
$$

$$section
### Instant Client Directory $(id="instantClientDirectory")

This directory will be used to set the `LD_LIBRARY_PATH` env variable. It is required if you need to enable thick connection mode. By default, we bring Instant Client 19 and point to `/instantclient`.
$$

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of Oracle, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

**Note:** It is recommended to use the database name same as the SID, This ensures accurate results and proper identification of tables during profiling, data quality checks and dbt workflow.

$$

$$section
### Connection Options $(id="connectionOptions")

Enter the details for any additional connection options that can be sent to Oracle during the connection. These details must be added as Key-Value pairs.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Oracle during the connection. These details must be added as Key-Value pairs.
$$

## Sample Storage AWS S3 Config

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests (<a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html" target="_blank">docs</a>).

Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html" target="_blank">here</a>
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers (<a href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html" target="_blank">docs</a>).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials" target="_blank">here</a>.
$$

$$section
### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html" target="_blank">Using temporary credentials with AWS resources</a>.
$$

$$section
### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on <a href="https://docs.aws.amazon.com/general/latest/gr/rande.html" target="_blank">AWS service endpoints</a>.
$$

$$section
### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about <a href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html" target="_blank">Named profiles for the AWS CLI</a>.
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html" target="_blank">AssumeRole</a>.
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session." target="_blank">Role Session Name</a>.
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity" target="_blank">Source Identity</a>.
$$

$$section
### Bucket Name $(id="bucketName")

A bucket name in Data Lake is a unique identifier used to organize and store data objects.

It's similar to a folder name, but it's used for object storage rather than file storage.
$$

$$section
### Prefix $(id="prefix")

The prefix of a data source refers to the first part of the data path that identifies the source or origin of the data.

It's used to organize and categorize data within the container, and can help users easily locate and access the data they need.
$$

$$section
### Default Database Filter Pattern $(id="databaseFilterPattern")

Regex to only include/exclude databases that matches the pattern.
$$

$$section
### Default Schema Filter Pattern $(id="schemaFilterPattern")

Regex to only include/exclude schemas that matches the pattern.
$$

$$section
### Default Table Filter Pattern $(id="tableFilterPattern")

Regex to only include/exclude tables that matches the pattern.
$$


$$section
### Default Stored Procedure Filter Pattern $(id="storedProcedureFilterPattern")
Regex to only include/exclude stored procedures that matches the pattern.
$$