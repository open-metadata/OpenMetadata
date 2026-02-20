# AWS Kinesis Firehose

In this section, we provide guides and references to use the AWS Kinesis Firehose connector.

## Requirements

To extract metadata from AWS Kinesis Firehose, you need to configure AWS credentials with appropriate permissions:
- **AWS Credentials**: Valid AWS credentials (Access Key ID and Secret Access Key) or IAM role with permissions to access Kinesis Firehose
- **Permissions Required**:
  - `firehose:DescribeDeliveryStream` - To describe delivery stream details
  - `firehose:ListDeliveryStreams` - To list all delivery streams

## Connection Details

$$section
### AWS Access Key ID $(id="awsAccessKeyId")
AWS Access Key ID is a unique identifier for your AWS account. It is used in combination with the Secret Access Key to authenticate API requests to AWS services. This is an optional field if you are using IAM roles or AWS profiles for authentication.
$$

$$section
### AWS Secret Access Key $(id="awsSecretAccessKey")
AWS Secret Access Key is a secret key that is used in combination with the Access Key ID to cryptographically sign API requests to AWS services. Keep this value secure and never share it. This is an optional field if you are using IAM roles or AWS profiles for authentication.
$$

$$section
### AWS Region $(id="awsRegion")
AWS Region where your Kinesis Firehose delivery streams are deployed. This is a required field. Examples include:
- `us-east-1` (US East - N. Virginia)
- `us-west-2` (US West - Oregon)
- `eu-west-1` (Europe - Ireland)
- `ap-southeast-1` (Asia Pacific - Singapore)

You can find the full list of AWS regions in the [AWS documentation](https://docs.aws.amazon.com/general/latest/gr/rande.html).
$$

$$section
### AWS Session Token $(id="awsSessionToken")
AWS Session Token is a temporary credential that is required when using temporary security credentials (such as those from AWS STS). This is typically used in scenarios involving:
- Federated user access
- Cross-account access
- Temporary credentials from AWS STS AssumeRole operations

This field is optional and only needed when using temporary credentials.
$$

$$section
### Endpoint URL $(id="endPointURL")
Custom endpoint URL for AWS services. This is useful when:
- Connecting to AWS services through a VPC endpoint
- Using AWS compatible services (like MinIO for S3-compatible storage)
- Connecting to AWS GovCloud or other specialized AWS regions

Leave this field empty to use the default AWS endpoints. Example format: `https://firehose.us-east-1.amazonaws.com`
$$

$$section
### Profile Name $(id="profileName")
The name of an AWS profile configured in your AWS credentials file (`~/.aws/credentials`). When specified, the connector will use the credentials associated with this profile. This is useful when you have multiple AWS accounts or different permission sets configured locally.

Example profile names:
- `default`
- `production`
- `development`
$$

$$section
### Assume Role ARN $(id="assumeRoleArn")
The Amazon Resource Name (ARN) of an IAM role to assume for accessing Kinesis Firehose resources. This is useful for cross-account access scenarios where the Kinesis Firehose delivery streams exist in a different AWS account.

Format: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`

Example: `arn:aws:iam::123456789012:role/KinesisFirehoseReadOnlyRole`

When using Assume Role, ensure that:
1. The role has a trust relationship with the account making the request
2. The role has necessary permissions to access Kinesis Firehose
$$

$$section
### Assume Role Session Name $(id="assumeRoleSessionName")
A unique identifier for the assumed role session. This helps to distinguish between different sessions when the same role is assumed by different users or services. AWS uses this value in CloudTrail logs to help with auditing.

Default value: `OpenMetadataSession`

You can customize this to include information like:
- Username or service name
- Environment (dev, staging, prod)
- Timestamp or unique identifier
$$

$$section
### Assume Role Source Identity $(id="assumeRoleSourceIdentity")
The source identity to associate with the assumed role session. This is an optional field that provides additional context about who or what is assuming the role. The source identity information appears in AWS CloudTrail logs and can be useful for auditing and compliance purposes.

Example: `openmetadata-ingestion-service`
$$

$$section
### Messaging Service Name $(id="messagingServiceName")
The Name of the ingested Kafka Messaging Service associated with this Firehose Pipeline Service upstream source.

Example: `local_kafka`
$$

$$section
### Pipeline Filter Pattern $(id="pipelineFilterPattern")
A regular expression pattern to filter which Kinesis Firehose delivery streams to include or exclude during metadata extraction. This helps you control which pipelines are ingested into OpenMetadata.

**Include Filter Examples:**
- `.*prod.*` - Include only delivery streams with "prod" in the name
- `^analytics-.*` - Include only delivery streams starting with "analytics-"
- `.*-data-stream$` - Include only delivery streams ending with "-data-stream"

**Exclude Filter Examples:**
- `.*test.*` - Exclude delivery streams with "test" in the name
- `^temp-.*` - Exclude delivery streams starting with "temp-"

Leave empty to include all delivery streams.
$$