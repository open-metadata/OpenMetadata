# SSIS

In this section, we provide guides and references to use the SSIS connector.

## Requirements

1. **SSIS Connector**: which we will configure in this section and requires access to the underlying database.


## Connection Details


$$section
### Metadata Database Connection $(id="connection")

SSIS uses MSSQL as its database.

$$

## Mssql Connection

In this section, we provide guides and references to use the MSSQL connection.

## Requirements

The user must have `SELECT` privileges to fetch the metadata of tables and views.

```sql
-- Create a new user
-- More details https://learn.microsoft.com/en-us/sql/t-sql/statements/create-user-transact-sql?view=sql-server-ver16
CREATE USER Mary WITH PASSWORD = '********';
-- Grant SELECT on table
GRANT SELECT TO Mary;
```

### Remote Connection

#### 1. SQL Server running

Make sure the SQL server that you are trying to connect is in running state.

#### 2. Allow remote connection on MSSMS (Microsoft SQL Server Management Studio)

This step allow the sql server to accept remote connection request.

![remote-connection](/doc-images/Database/Mssql/remote-connection.png)

#### 3. Configure Windows Firewall 

If you are using SQL server on Windows, you must configure the firewall on the computer running SQL Server to allow access.

1. On the Start menu, select `Run`, type `WF.msc`, and then select `OK`.
2. In the `Windows Firewall with Advanced Security`, in the left pane, right-click` Inbound Rules`, and then select `New Rule` in the action pane.
3. In the `Rule Type` dialog box, select `Port`, and then select `Next`.
4. In the `Protocol and Ports` dialog box, select `TCP`. Select Specific local ports, and then type the port number of the instance of the Database Engine, such as 1433 for the default instance. Select `Next`.
5. In the `Action` dialog box, select `Allow` the connection, and then select Next.
6. In the `Profile` dialog box, select any profiles that describe the computer connection environment when you want to connect to the Database Engine, and then select `Next`.
7. In the `Name` dialog box, type a name and description for this rule, and then select `Finish`.

For details step please refer this [link](https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-a-windows-firewall-for-database-engine-access?view=sql-server-ver15).

You can find further information on the MSSQL connector in the [docs](https://docs.open-metadata.org/connectors/database/mssql).

## Connection Details

$$section
### Scheme $(id="scheme")
There are three schemes based on the user's requirement to fetch data from MSSQL:
- **mssql+pytds**: High-performance open-source library for connecting to Microsoft SQL Server.
- **mssql+pyodbc**: Cross-platform Python library that uses ODBC to connect to Microsoft SQL Server.
- **mssql+pymssql**: Python library that uses FreeTDS to connect to Microsoft SQL Server, with support for bulk data transfer and query timeouts.

If you are connecting via windows authentication from a linux docker deployment please use `mssql+pymssql`. 

$$

$$section
### Username $(id="username")

Username to connect to MSSQL. This user should have privileges to read all the metadata in MSSQL.
$$

$$section
### Password $(id="password")

Password to connect to MSSQL.
$$

$$section
### Host Port $(id="hostPort")

This parameter specifies the host and port of the MSSQL instance. This should be specified as a string in the format `hostname:port`. For example, you might set the hostPort parameter to `localhost:1433`.

If you are running the OpenMetadata ingestion in a docker and your services are hosted on the `localhost`, then use `host.docker.internal:1433` as the value.
$$

$$section
### Database $(id="database")

Initial Mssql database to connect to.
$$

$$section
### Driver $(id="driver")

Connecting to MSSQL via **pyodbc** scheme requires the ODBC driver to be installed. Specify ODBC driver name in the field.

You can download the ODBC driver from [here](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server?view=sql-server-ver16).

In case of Docker or Kubernetes deployments, this driver comes out of the box with version `ODBC Driver 18 for SQL Server`.
$$

$$section
### Project Location $(id="packageConnection")

You have two options to provide your SSIS projects for ingestion:

1. **Local Path**:<span style="font-size: 1.1em; color: #b22222; font-style: italic; font-weight: bold;">If you are using the Local Path option, you must run the ingestion workflow through the CLI instead of the UI.</span>
2. **S3 Bucket**: Upload your SSIS projects to an S3 bucket and provide the bucket name along with the necessary S3 credentials.

You can choose either of these methods based on your setup and requirements.
$$


## S3Connection

In this section, we provide guides and references to use the S3 connector.

## Requirements

We need the following permissions in AWS:

### S3 Permissions

For all the buckets that we want to ingest, we need to provide the following:
- `s3:ListBucket`
- `s3:GetObject`

Note that the `Resources` should be all the buckets that you'd like to scan. A possible policy could be:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:ListBucket",
            ],
            "Resource": [
                "arn:aws:s3:::*"
            ]
        }
    ]
}
```


## Connection Details

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
### Bucket Name $(id="bucketNames")

Provide the name of the bucket that contains your project folders
$$
