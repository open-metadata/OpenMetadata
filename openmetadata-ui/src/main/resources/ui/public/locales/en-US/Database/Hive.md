# Hive
In this section, we provide guides and references to use the Hive connector. You can view the full documentation for Hive [here](https://docs.open-metadata.org/connectors/database/hive).

## Requirements
To extract metadata, the user used in the connection needs to be able to perform `SELECT`, `SHOW`, and `DESCRIBE` operations in the database/schema where the metadata needs to be extracted from.

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

You can find further information on the Hive connector in the [docs](https://docs.open-metadata.org/connectors/database/hive).

## Hive Server Connection Details

### Scheme
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value. OpenMetadata supports both `Hive` and `Impala`.

### Username
Username to connect to Hive. This user should have the necessary privileges described in the section above.

### Password
Password to connect to Hive.

### Host Port

This parameter specifies the host and port of the Hive instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `myhivehost:10000`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:10000` as the value.

### Auth
The auth parameter specifies the authentication method to use when connecting to the Hive server. Possible values are `LDAP`, `NONE`, `CUSTOM`, or `KERBEROS`. If you are using Kerberos authentication, you should set auth to `KERBEROS`. If you are using custom authentication, you should set auth to `CUSTOM` and provide additional options in the `authOptions` parameter.

### Kerberos Service Name
This parameter specifies the Kerberos service name to use for authentication. This should only be specified if using Kerberos authentication. The default value is `hive`.

### Database Schema
Schema of the data source. This is optional parameter, if you would like to restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion attempts to scan all the schemas.

### Database Name
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of Hive, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

### Auth Options
Authentication options to pass to Hive connector. These options are based on SQLAlchemy.

### Connection Options
Additional connection options to build the URL that can be sent to service during the connection. The connectionOptions parameter is specific to the connection method being used. For example, if you are using SSL encryption, you might set the connectionOptions parameter to {'ssl': 'true', 'sslTrustStore': '/path/to/truststore'}.

### Connection Arguments
Additional connection arguments such as security or protocol configs that can be sent to service during connection.

## Hive Postgres Metastore Connection Details

### Username

Username to connect to Postgres. This user should have privileges to read all the metadata in Postgres.

### Auth Config
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.

User can authenticate the Postgres Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services.

### Basic Auth



### Password

Password to connect to Postgres.

### IAM Auth Config

### AWS Access Key ID

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

### AWS Secret Access Key

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

### AWS Region

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

### AWS Session Token

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).

### Endpoint URL

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

### Profile Name

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

### Assume Role ARN

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

### Assume Role Session Name

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

### Assume Role Source Identity

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

### Host and Port

This parameter specifies the host and port of the Postgres instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:5432`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:5432` as the value.

### Database

Initial Postgres database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.

### SSL Mode

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca`, `allow` etc.

$$note
if you are using `IAM auth`, select either `allow` (recommended) or other option based on your use case.
$$

### Classification Name

By default, the Postgres policy tags in OpenMetadata are classified under the name `PostgresPolicyTags`. However, you can create a custom classification name of your choice for these tags. Once you have ingested Postgres data, the custom classification name will be visible in the Classifications list on the Tags page.

### Ingest All Databases

If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.

### Connection Arguments

Additional connection arguments such as security or protocol configs that can be sent to service during connection.

### Connection Options

Additional connection options to build the URL that can be sent to service during the connection.

## Hive Mysql Metastore Connection Details

### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.

### Username $(id="username")
Username to connect to MySQL. This user should have access to the `INFORMATION_SCHEMA` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.

### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.

User can authenticate the Mysql Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services.


### Basic Auth

### Password $(id="password")
Password to connect to MySQL.

### IAM Auth Config

$$note 
If you are using IAM auth, add <br />`"ssl": {"ssl-mode": "allow"}` under Connection Arguments
$$

### AWS Access Key ID $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

### AWS Secret Access Key $(id="awsSecretAccessKey")

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).

### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).

### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).

### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).

### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).

### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).

### Host Port $(id="hostPort")

This parameter specifies the host and port of the MySQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3306`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3306` as the value.

### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of MySQL, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.

### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.

### SSL CA $(id="sslCA")
Provide the path to SSL CA file, which needs to be local in the ingestion process.

### SSL Certificate $(id="sslCert")
Provide the path to SSL client certificate file (`ssl_cert`)

### SSL Key $(id="sslKey")
Provide the path to SSL key file (`ssl_key`)

### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.

### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.
