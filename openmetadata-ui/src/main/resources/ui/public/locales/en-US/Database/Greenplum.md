# Greenplum

In this section, we provide guides and references to use the Greenplum connector.

## Requirements

### Profiler & Data Quality

Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

You can find further information on the Greenplum connector in the <a href="https://docs.open-metadata.org/connectors/database/greenplum" target="_blank">docs</a>.

## Connection Details

$$section
### Connection Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.
$$


$$section
### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.

User can authenticate the Postgres Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services.
$$

## Basic Auth
$$section
### Password $(id="password")

Password to connect to Postgres.
$$

## IAM Auth Config

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
### Host and Port $(id="hostPort")

This parameter specifies the host and port of the Postgres instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:5432`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:5432` as the value.
$$

$$section
### Database $(id="database")

Initial Postgres database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.
$$

$$section
### SSL Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca`, `allow` etc.
$$
$$note
if you are using `IAM auth`, select either `allow` (recommended) or other option based on your use case.
$$


$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`sslrootcert`).
$$
$$note
Greenplum only needs CA Certificate
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$
