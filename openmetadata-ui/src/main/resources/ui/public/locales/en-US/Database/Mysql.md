# MySQL

In this section, we provide guides and references to use the MySQL connector.

## Requirements
To extract metadata the user used in the connection needs to have access to the `INFORMATION_SCHEMA`. By default, a user can see only the rows in the `INFORMATION_SCHEMA` that correspond to objects for which the user has the proper access privileges.

```SQL
-- Create user. If <hostName> is ommited, defaults to '%'
-- More details https://dev.mysql.com/doc/refman/8.0/en/create-user.html
CREATE USER '<username>'[@'<hostName>'] IDENTIFIED BY '<password>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a database
GRANT SELECT ON world.* TO '<username>';

-- Grant select on a specific object
GRANT SELECT ON world.hello TO '<username>';
```

$$note
OpenMetadata supports MySQL version `8.0.0` and up. 
$$

### Lineage & Usage 
To extract lineage & usage you need to enable the query logging in mysql and the user used in the connection needs to have select access to the `mysql.general_log`.

```sql
-- Enable Logging 
SET GLOBAL general_log='ON';
set GLOBAL log_output='table';

-- Grant SELECT on log table
GRANT SELECT ON mysql.general_log TO '<username>'@'<host>';
```

### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `tables` for all objects in the database. More information on the profiler workflow setup can be found [here](https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow) and data quality tests [here](https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality).

You can find further information on the MySQL connector in the [docs](https://docs.open-metadata.org/connectors/database/mysql).

## Connection Details

$$section
### Scheme $(id="scheme")
SQLAlchemy driver scheme options. If you are unsure about this setting, you can use the default value.
$$

$$section
### Username $(id="username")
Username to connect to MySQL. This user should have access to the `INFORMATION_SCHEMA` to extract metadata. Other workflows may require different permissions -- refer to the section above for more information.
$$

$$section
### Auth Config $(id="authType")
There are 2 types of auth configs:
- Basic Auth.
- IAM based Auth.
- Azure Based Auth.

User can authenticate the Mysql Instance with auth type as `Basic Authentication` i.e. Password **or** by using `IAM based Authentication` to connect to AWS related services **or** by using `Azure Baed Authentication` to connecto to Azure releated services.
$$


## Basic Auth

$$section
### Password $(id="password")
Password to connect to MySQL.
$$

## IAM Auth Config

$$note 
If you are using IAM auth, add <br />`"ssl": {"ssl-mode": "allow"}` under Connection Arguments
$$

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

## Azure Auth Config

$$section
### Client ID $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key file.
$$

$$section
### Client Secret $(id="clientSecret")
To get the client secret, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.

$$

$$section
### Tenant ID $(id="tenantId")

To get the tenant ID, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
$$

$$section
### Storage Account Name $(id="accountName")

Account Name of your storage account
$$

$$section
### Key Vault Name $(id="vaultName")

Key Vault Name
$$

$$section
### Scopes $(id="scopes")

To let OM use the Trino Auth APIs using your Azure AD app, you'll need to add the scope
1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Trino.
4. From the `Expose an API` section, copy the `Application ID URI`
5. Make sure the URI ends with `/.default` in case it does not, you can append the same manually
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the MySQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:3306`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3306` as the value.
$$

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

$$section
### Connection Options $(id="connectionOptions")
Additional connection options to build the URL that can be sent to the service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")
Additional connection arguments such as security or protocol configs that can be sent to the service during connection.
