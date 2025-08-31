# QuickSight

In this section, we provide guides and references to use the QuickSight connector.

## Requirements
AWS QuickSight Permissions
To execute metadata extraction and usage workflow successfully the IAM User should have enough access to fetch required data. Following table describes the minimum required permissions

| # | AWS QuickSight Permission |
| :---------- | :---------- |
| 1 | DescribeDashboard |
| 2 | ListAnalyses |
| 3 | ListDataSources |
| 4 | ListDashboards |
| 5 | DescribeAnalysis |
| 6 | DescribeDataSet |
| 7 | ListDataSets |
| 8 | DescribeDataSource |

Here is how to add Permissions to an IAM user.

1. Navigate to the IAM console in the AWS Management Console.

2. Choose the IAM user or group to which you want to attach the policy, and click on the "Permissions" tab.

3. Click on the "Add permissions" button and select "Attach existing policies directly".

4. Search for the policy by name or by filtering the available policies, and select the one you want to attach.

5. Review the policy and click on "Add permissions" to complete the process.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "quicksight:DescribeDashboard",
                "quicksight:ListAnalyses",
                "quicksight:ListDataSources",
                "quicksight:ListDashboards",
                "quicksight:DescribeAnalysis",
                "quicksight:DescribeDataSet",
                "quicksight:ListDataSets",
                "quicksight:DescribeDataSource"
            ],
            "Resource": "*"
        }
    ]
}
```


You can find further information on the QuickSight connector in the <a href="https://docs.open-metadata.org/connectors/dashboard/quicksight" target="_blank">docs</a>.

## Connection Details

$$section
### AWS Config $(id="awsConfig")

AWS credentials configs.
$$

$$section
### AWS Access Key ID $(id="awsAccessKeyId")

When you interact with AWS, you specify your AWS security credentials to verify who you are and whether you have 
permission to access the resources that you are requesting. AWS uses the security credentials to authenticate and
authorize your requests (<a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds.html" target="_blank">docs</a>).

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

Note that the AWS Region is the only required parameter when configuring a connection. When connecting to the
services programmatically, there are different ways in which we can extract and use the rest of AWS configurations.
You can find further information about configuring your credentials <a href="https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials" target="_blank">here</a>.
$$

$$section
### AWS Session Token $(id="awsSessionToken")

If you are using temporary credentials to access your services, you will need to inform the AWS Access Key ID
and AWS Secrets Access Key. Also, these will include an AWS Session Token.

You can find more information on <a href="https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html" target="_blank">Using temporary credentials with AWS resources</a>.
$$

$$section
### Endpoint URL $(id="endPointURL")

To connect programmatically to an AWS service, you use an endpoint. An *endpoint* is the URL of the 
entry point for an AWS web service. The AWS SDKs and the AWS Command Line Interface (AWS CLI) automatically use the 
default endpoint for each service in an AWS Region. But you can specify an alternate endpoint for your API requests.

Find more information on <a href="https://docs.aws.amazon.com/general/latest/gr/rande.html" target="_blank">AWS service endpoints</a>.
$$

$$section
### Profile Name $(id="profileName")

A named profile is a collection of settings and credentials that you can apply to an AWS CLI command. 
When you specify a profile to run a command, the settings and credentials are used to run that command. 
Multiple named profiles can be stored in the config and credentials files.

You can inform this field if you'd like to use a profile other than `default`.

Find here more information about <a href="https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html" target="_blank">Named profiles for the AWS CLI</a>.
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")

Typically, you use `AssumeRole` within your account or for cross-account access. In this field you'll set the
`ARN` (Amazon Resource Name) of the policy of the other account.  

A user who wants to access a role in a different account must also have permissions that are delegated from the account administrator. 

The administrator must attach a policy that allows the user to call `AssumeRole` for the `ARN` of the role in the other account.

This is a required field if you'd like to `AssumeRole`.

Find more information on <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html" target="_blank">AssumeRole</a>.
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")

An identifier for the assumed role session. Use the role session name to uniquely identify a session when the same role
is assumed by different principals or for different reasons.

By default, we'll use the name `OpenMetadataSession`.

Find more information about the <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=An%20identifier%20for%20the%20assumed%20role%20session." target="_blank">Role Session Name</a>.
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")

The source identity specified by the principal that is calling the `AssumeRole` operation. You can use source identity
information in AWS CloudTrail logs to determine who took actions with a role.

Find more information about <a href="https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#:~:text=Required%3A%20No-,SourceIdentity,-The%20source%20identity" target="_blank">Source Identity</a>.
$$

$$section
### AWS Account ID $(id="awsAccountId")

QuickSight account ID is required to manage QuickSight users, data sources, and reports.

To fetch QuickSight account ID:

1. Log in to QuickSight console and click on your username in the top right corner.

2. Select "Manage QuickSight" from the dropdown menu and click on the "Account settings" tab.

3. The QuickSight account ID will be displayed under "Account ID" on the right-hand side of the page.

4. You can also use AWS CLI command "aws quicksight describe-account" to fetch your QuickSight account ID.

$$

$$section
### Identity Type $(id="identityType")

The authentication method that the user uses to sign in.
There are 3 types of Identity Types:

**IAM** (Identity and Access Management) provides secure access to AWS resources by creating and managing users, groups, and permissions.

**QuickSight** identity is used to manage QuickSight users, data sources, and reports within a QuickSight account.

**Anonymous** identity allows unauthenticated access to public datasets and dashboards without requiring users to log in to QuickSight.
$$

$$section
### Namespace $(id="namespace")

The Amazon QuickSight namespace that contains the dashboard IDs in this request ( To be provided when identityType is `ANONYMOUS` )
$$
