# AzureSQL

In this section, we provide guides and references to use the AzureSQL connector.

## Requirements

Make sure if you have whitelisted the ingestion IP on Azure SQL firewall rules. Checkout [this](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql#use-the-azure-portal-to-manage-server-level-ip-firewall-rules) document on how to whitelist your IP using the Azure portal.

AzureSQL database user must grant `SELECT` privilege to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

You can find further information on the Azure connector in the [docs](https://docs.open-metadata.org/connectors/database/azuresql).

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Username $(id="username")

Username to connect to AzureSQL. This user should have privileges to read the metadata.
$$

$$section
### Password $(id="password")

Password to connect to AzureSQL.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the AzureSQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `azure-sql-service-name.database.windows.net:1433`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:3000` as the value.
$$

$$section
### Database $(id="database")

Database of the data source. This is an optional parameter, if you would like to restrict the metadata reading to a single database. When left blank, the OpenMetadata Ingestion attempts to scan all the databases.
$$

$$section
### Driver $(id="driver")

Connecting to AzureSQL requires the ODBC driver to be installed. Specify ODBC driver name in the field.

You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16).

In case of Docker or Kubernetes deployments, this driver comes out of the box with version `ODBC Driver 18 for SQL Server`.

$$

**Authentication Mode**:

$$section
### Authentication $(id="authentication")
   - The `authentication` parameter determines the method of authentication when connecting to AzureSQL using ODBC (Open Database Connectivity).
   - If you select **"Active Directory Password"**, you'll need to provide the password associated with your Azure Active Directory account.
   - Alternatively, if you choose **"Active Directory Integrated"**, the connection will use the credentials of the currently logged-in user. This mode ensures secure and seamless connections with AzureSQL.
$$

$$section
### Encrypt $(id="encrypt")
   - The `encrypt` setting in the connection string pertains to data encryption during communication with AzureSQL.
   - When enabled, it ensures that data exchanged between your application and the database is encrypted, enhancing security.
$$

$$section

### Trust Server Certificate $(id="trustServerCertificate"):
   - The `trustServerCertificate` option also relates to security.
   - When set to true, your application will trust the server's SSL certificate without validation. Use this cautiously, as it bypasses certificate validation checks.
$$

$$section
### Connection Timeout $(id="connectionTimeout"):
   - The `connectionTimeout` parameter specifies the maximum time (in seconds) that your application will wait while attempting to establish a connection to AzureSQL.
   - If the connection cannot be established within this timeframe, an error will be raised.
$$

$$section
### Ingest All Databases $(id="ingestAllDatabases")
If ticked, the workflow will be able to ingest all database in the cluster. If not ticked, the workflow will only ingest tables from the database set above.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

## AWS S3

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
