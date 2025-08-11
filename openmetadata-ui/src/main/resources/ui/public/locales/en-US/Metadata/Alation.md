# Alation

In this section, we provide guides and references to use the Alation connector.

## Requirements

Follow the official documentation to generate a API Access Token from [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-an-api-access-token)

## Connection Details

$$section
### Host Port $(id="hostPort")

Host and port of the Alation service.
$$

$$section
### Authentication Type $(id="authType")

Following authentication types are supported:

1. Basic Authentication: We'll use the user credentials to generate the access token required to authenticate Alation APIs.
- username: Username of the user.
- password: Password of the user.

2. Access Token Authentication: The access token created using the steps mentioned [here](https://developer.alation.com/dev/docs/authentication-into-alation-apis#create-via-ui) can directly be entered. We'll use that directly to authenticate the Alation APIs
- accessToken: Generated access token
$$

## Alation backend database Connection details
Alation APIs do not provide us with some of the metadata. This metadata we extract directly from the alation's backend database by query the tables directly.
Note that this is a optional config and if it is not provided primary metadata will still be ingested.
Below is the metadata fetched from alation database:
`1. User and Group Relationships`

Choose either postgres or mysql connection depending on the db:
## Postgres Connection 

You can use Postgres Connection when you have SSO enabled and your Superset is backed by Postgres database.

### Connection Scheme

SQLAlchemy driver scheme options.


### Username

Username to connect to Postgres. 


$$note

Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.

$$

$$section
### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.

User can authenticate the Postgres Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services.
$$

## Basic Auth

### Password

Password to connect to Postgres.


## IAM Auth Config

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and authorize your requests ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html)).

Access keys consist of two parts:
1. An access key ID (for example, `AKIAIOSFODNN7EXAMPLE`),
2. And a secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).

You must use both the access key ID and secret access key together to authenticate your requests.

You can find further information on how to manage your access keys [here](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")

Secret access key (for example, `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`).
$$

$$section
### AWS Region $(id="awsRegion")

Each AWS Region is a separate geographic area in which AWS clusters data centers ([docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)).

As AWS can have instances in multiple regions, we need to know the region the service you want reach belongs to.

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the services programmatically, there are different ways in which we can extract and use the rest of AWS configurations. You can find further information about configuring your credentials [here](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials).
$$

$$section
### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on [Using temporary credentials with AWS resources](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html).
$$

$$section
### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on [AWS service endpoints](https://docs.aws.amazon.com/general/latest/gr/rande.html).
$$

$$section
### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. When you specify a profile to run a command, the settings and credentials are used to run that command. Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about [Named profiles for the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the `ARN` (Amazon Resource Name) of the policy of the other account.

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on [AssumeRole](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html).
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the [Role Session Name](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session.).
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about [Source Identity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity).
$$

### Host and Port

Host and port of the Postgres service.

Example: `localhost:5432`

$$section
### Database $(id="database")

Initial Postgres database to connect to. If you want to ingest all databases, set `ingestAllDatabases` to true.
$$

### SSL Mode

SSL Mode to connect to postgres database.

$$section
### Classification Name $(id="classificationName")

By default, the Postgres policy tags in OpenMetadata are classified under the name `PostgresPolicyTags`. However, you can create a custom classification name of your choice for these tags. Once you have ingested Postgres data, the custom classification name will be visible in the Classifications list on the Tags page.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")

If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### SSL Mode $(id="sslMode")

SSL Mode to connect to postgres database. E.g, `prefer`, `verify-ca`, `allow` etc.
$$
$$note
if you are using `IAM auth`, select either `allow` (recommended) or other option based on your use case.
$$


### SSL CA 
The CA certificate used for SSL validation (`sslrootcert`).

$$note
Postgres only needs CA Certificate
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$
--------

## Mysql Connection 

You can use Mysql Connection when you have SSO enabled and your Superset is backed by Mysql database.

### Scheme
SQLAlchemy driver scheme options.

### Username
Username to connect to Mysql.

$$note

Make sure the user has select privileges on `dashboards`, `tables` & `slices` tables of superset schema.

$$

### Password
Password to connect to Mysql.

### Host Port
Host and port of the Mysql service. This should be specified as a string in the format `hostname:port`.

**Example**: `localhost:3306`, `host.docker.internal:3306`

$$section
### Database Name $(id="databaseName")
In OpenMetadata, the Database Service hierarchy works as follows:
```
Database Service > Database > Schema > Table
```
In the case of MySQL, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
$$

$$section
### Database Schema $(id="databaseSchema")
This is an optional parameter. When set, the value will be used to restrict the metadata reading to a single database (corresponding to the value passed in this field). When left blank, OpenMetadata will scan all the databases.
$$

$$section
### SSL CA $(id="caCertificate")
The CA certificate used for SSL validation (`ssl_ca`)
$$

$$section
### SSL Certificate $(id="sslCertificate")
The SSL certificate used for client authentication (`ssl_cert`)
$$

$$section
### SSL Key $(id="sslKey")
The private key associated with the SSL certificate (`ssl_key`)
$$

### Connection Options
Additional connection options to build the URL that can be sent to the service during the connection.

### Connection Arguments
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.


$$section
### Project Name $(id="projectName")

Project name to create the refreshToken. Can be anything.
$$


$$section
### Pagination Limit $(id="paginationLimit")

Pagination limit used for Alation APIs pagination
$$

$$section
### Include Undeployed Datasources $(id="includeUndeployedDatasources")

Specifies if undeployed datasources should be included while ingesting. By default is set to `false`.
$$

$$section
### Include Hidden Datasources $(id="includeHiddenDatasources")

Specifies if hidden datasources should be included while ingesting. By default is set to `false`.
$$

$$section
### Ingest Datasources $(id="ingestDatasources")

Specifies if databases, schemas and tables should be included while ingesting. By default is set to `true`.
$$

$$section
### Ingest Users And Groups $(id="ingestUsersAndGroups")

Specifies if users and groups should be included while ingesting. By default is set to `true`.
$$

$$section
### Ingest Domains $(id="ingestDomains")

Specifies if domains and subdomains should be included while ingesting. By default is set to `true`.
$$

$$section
### Ingest KnowledgeArticles $(id="ingestKnowledgeArticles")

Specifies if knowledge articles should be included while ingesting. By default is set to `true`.
$$

$$section
### Ingest Dashboards $(id="ingestDashboards")

Specifies if BI sources and dashboards should be included while ingesting. By default is set to `true`.
$$

$$section
### Alation Tag Classification Name $(id="alationTagClassificationName")

Specifies if hidden datasources should be included while ingesting. By default is set to `false`.
$$

$$section
### Ingest Datasources $(id="ingestDatasources")

Specifies if hidden datasources should be included while ingesting. By default is set to `false`.
$$

$$section
### Ingest Datasources $(id="ingestDatasources")

Specifies if hidden datasources should be included while ingesting. By default is set to `false`.
$$


$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.

The following arguments are intended to be used in conjunction and are specifically for Alation DataSource APIs:
- skip: This parameter determines the count of records to bypass at the start of the dataset. When set to 0, as in this case, it means that no records will be bypassed. If set to 10, it will bypass the first 10 records.

- limit: This argument specifies the maximum number of records to return. Here, it's set to 10, meaning only the first 10 records will be returned.

To perform incremental ingestion, these arguments should be used together. For instance, if there are a total of 30 datasources in Alation, the ingestion can be configured to execute three times, with each execution ingesting 10 datasources. 
- 1st execution: {"skip": 0, "limit": 10}
- 2nd execution: {"skip": 10, "limit": 10}
- 3rd execution: {"skip": 20, "limit": 10}

$$
