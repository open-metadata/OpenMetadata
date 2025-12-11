# Athena

In this section, we provide guides and references to use the Athena connector.

## Requirements

The Athena connector ingests metadata through JDBC connections.

$$note
According to AWS's official <a href="https://docs.aws.amazon.com/athena/latest/ug/policy-actions.html" target="_blank">documentation</a>: 

*If you are using the JDBC or ODBC driver, ensure that the IAM 
permissions policy includes all of the actions listed in <a href="https://docs.aws.amazon.com/athena/latest/ug/managed-policies.html#awsquicksightathenaaccess-managed-policy" target="_blank">AWS managed policy: AWSQuicksightAthenaAccess</a>.*
$$

This policy groups the following permissions:

- `athena` – Allows the principal to run queries on Athena resources.
- `glue` – Allows principals access to AWS Glue databases, tables, and partitions. This is required so that the principal can use the AWS Glue Data Catalog with Athena.
- `lakeformation` – Allows principals to request temporary credentials to access data in a data lake location that is registered with Lake Formation.

And is defined as:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "athena:GetTableMetadata",
                "athena:ListDatabases",
                "athena:ListTableMetadata",
                "athena:GetQueryExecution",
                "athena:StartQueryExecution",
                "athena:GetQueryResults",
                "glue:GetDatabases",
                "glue:GetTables",
                "glue:GetTable",
                "lakeformation:GetDataAccess"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```


{% note %}

If you have external services other than glue and facing permission issues, add the permissions to the list above.

{% /note %}


You can find further information on the Athena connector in the <a href="https://docs.open-metadata.org/connectors/database/athena" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

Driver to connect to Athena.

$$

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
### S3Staging Dir $(id="s3StagingDir")

Amazon Athena automatically stores query results and metadata information for each query that runs in a query result 
location that you can specify in Amazon S3.

To set up an Amazon S3 query result location for the first time, see <a href="https://docs.aws.amazon.com/athena/latest/ug/querying.html#query-results-specify-location-console" target="_blank">Specifying a query result location using the Athena console</a>.

Find more information about <a href="https://docs.aws.amazon.com/athena/latest/ug/querying.html" target="_blank">Working with query results, recent queries, and output files</a>.
$$

$$section
### Workgroup $(id="workgroup")

Workgroups are used to separate users, teams, applications or workloads.

Select here the workgroup that the ingestion workflow should use.

You can find more information about <a href="https://docs.aws.amazon.com/athena/latest/ug/user-created-workgroups.html" target="_blank">How workgroups work</a>.
$$

$$section
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of Athena, we won't have a Database as such. If you'd like to see your data in a database named something other than `default`, you can specify the name in this field.
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