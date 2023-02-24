---
title: AWS Secrets Manager
slug: /deployment/secrets-manager/supported-implementations/aws-secrets-manager
---

# AWS Secrets Manager

## Setup

The setup steps covers the use of the managed version of the AWS Secrets Manager as secrets manager but for the 
non-managed follow only the steps related to the Airflow server and CLI.

### 1. Permissions needed

These are the permissions required in the IAM policy to enable the AWS Secrets Manager in OpenMetadata.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:PutSecretValue",
                "secretsmanager:CreateSecret",
                "secretsmanager:UpdateSecret"
            ],
            "Resource": "*"
        }
    ]
}
```

### 2. Update configuration

We have to set up the secret manager provider we want to use, that in our case is `aws`, and the credentials for our AWS 
account.

The changes to be done in `openmetadata.yaml` file of the OpenMetadata server are:

```yaml
...
secretsManagerConfiguration:
    secretsManager: managed-aws # or env var SECRET_MANAGER. For non-managed use 'aws'.
    parameters:
      region: <aws region> # or env var OM_SM_REGION
      accessKeyId: <aws access key id> # or env var OM_SM_ACCESS_KEY_ID
      secretAccessKey: <aws secret access key> # or env var OM_SM_ACCESS_KEY
...
```

And these are the changes required in `airflow.cfg` of our Airflow instance:

```properties
...
[openmetadata_secrets_manager]
aws_region = <aws region>
aws_access_key_id = <aws access key id>
aws_secret_access_key = <aws secret access key>
...
```

As an alternative to editing the `airflow.cfg` file, we can also set the following environment variables:

```bash
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AWS_REGION= <aws region>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AWS_ACCESS_KEY_ID= <aws access key id>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AWS_SECRET_ACCESS_KEY= <aws secret access key>
```

If no parameters are provided for the AWS account, or only `<aws region>`, it will use the default credentials. 
The default credential will look for credentials in:

1. **Environment variables** - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
2. **Shared credential file** - `~/.aws/credentials`
3. **AWS config file** - `~/.aws/config`
4. **Assume Role provider**
5. Instance metadata service on an Amazon EC2 instance that has an IAM role configured

More info in [AWS SDK for Java](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/credentials.html) and 
[Boto3 Docs](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html)

### 3. Restart both servers

After updating the configuration files, we are ready to restart both services. When the OM server starts, it will 
automatically detect that a Secrets Manager has been configured and will migrate all our sensitive data and remove it 
from our DB.

If everything goes as planned, all the data would be displayed using the secrets names which starts with 
`/openmetadata/...` in your AWS Secrets Manager console. The following image shows what it should look like:

<p/>
<Image src="/images/deployment/secrets-manager/supported-implementations/aws-secrets-manager/secrets-manager-console.webp" alt="secrets-manager-console"/>
<p/>

**Note:** If we want to change the starting path for our secrets names from `openmetadata` to a different one, we have 
to change the property `clusterName` in our `openmetadata.yaml`

## CLI

After enabling the Secret Manager, we also have to make a slight change in our workflows YAML files. In the 
`workflowConfig` we have to add the secret manager configuration:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: aws
    secretsManagerCredentials:
      awsAccessKeyId: <aws access key id>
      awsSecretAccessKey: <aws secret access key>
      awsRegion: <aws region>
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

