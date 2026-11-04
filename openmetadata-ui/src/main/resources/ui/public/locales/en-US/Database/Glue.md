# Glue

In this section, we provide guides and references to use the Glue connector.

## Requirements

The Glue connector ingests metadata through AWS <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/glue.html" target="_blank">Boto3</a> Client.

The user must have `glue:GetDatabases` and `glue:GetTables` permissions for the ingestion to run successfully.

To ingest AWS Glue Data Quality results, the user also needs `glue:ListDataQualityResults`, `glue:BatchGetDataQualityResult` and `glue:ListDataQualityRulesets`.

You can find further information on the Glue connector in the <a href="https://docs.open-metadata.org/connectors/database/glue" target="_blank">docs</a>.

## Connection Details

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
### Database Name $(id="databaseName")

In OpenMetadata, the Database Service hierarchy works as follows:

```
Database Service > Database > Schema > Table
```

In the case of Glue, we won't have a Database as such instead we use the <a href="https://docs.aws.amazon.com/glue/latest/dg/glue-specifying-resource-arns.html#data-catalog-resource-arns" target="_blank">Glue Catalog ID</a> as the database name. If you'd like to see your data in a database named something other than Catalog ID, you can specify the name in this field.
$$

$$section
### Include Data Quality $(id="includeDataQuality")

Imports <a href="https://docs.aws.amazon.com/glue/latest/dg/glue-data-quality.html" target="_blank">AWS Glue Data Quality</a> results into OpenMetadata.

- Every DQDL rule becomes a test case under the `AWSGlue` platform. A single-column rule (e.g. `IsComplete "id"`) is attached to its column; every other rule is attached to the table.
- Every evaluation run becomes a test case result, with its status, the evaluation message and the evaluated metrics.
- Each ruleset also gets a `<ruleset>_score` test case holding the Glue score, and a logical test suite that groups its test cases.
- Only results on tables the ingestion's database, schema and table filter patterns keep are imported; the others are reported as filtered.

The results appear in the table's Data Observability tab and on the Data Quality page.
$$

$$section
### Lookback Days $(id="lookbackDays")

Only results of runs that started within this number of days are imported. Runs already in OpenMetadata are skipped, so the windows of consecutive ingestions can overlap.
$$

$$section
### Target Database Service Name $(id="targetServiceName")

Name of the OpenMetadata database service that holds the evaluated tables, for example an Athena service that catalogs the same Glue tables. Leave it empty to attach the test cases to the tables ingested by this Glue service.
$$

$$section
### Target Database Name $(id="targetDatabaseName")

Database of the Target Database Service that holds the evaluated tables, for example `awsdatacatalog` for Athena. Only used together with Target Database Service Name.

Leave it empty to search every database of that service. If the same schema and table exist in more than one of its databases, those results are skipped and reported, since the right table cannot be told apart; set this field to pick it.
$$

$$section
### Ruleset Filter Pattern $(id="rulesetFilterPattern")

Regex to only include or exclude Data Quality rulesets by name. For ETL job results without a ruleset name, the pattern is matched against the evaluation context (the job's Data Quality node name) instead.
$$

$$section
### ETL Job Mappings $(id="etlJobMappings")

Results produced by the Evaluate Data Quality node of a Glue ETL job are not always linked to a Data Catalog table. Map them to an OpenMetadata table with:

- **Job Name**: the Glue job name.
- **Evaluation Context**: the name of the Data Quality node; leave empty to match every node of the job.
- **Table FQN**: the fully qualified name of the OpenMetadata table, e.g. `glue_service.123456789012.sales.orders`.
$$
