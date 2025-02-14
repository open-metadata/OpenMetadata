---
title: AWS Secrets Manager
slug: /deployment/secrets-manager/supported-implementations/aws-secrets-manager
collate: false
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
    prefix: ${SECRET_MANAGER_PREFIX:-""} # Define the secret key ID as /<prefix>/<clusterName>/<key>
    tags: ${SECRET_MANAGER_TAGS:-[]} # Add tags to the created resource, e.g., in AWS. Format is `[key1:value1,key2:value2,...]`
    parameters:
      region: <aws region> # or env var OM_SM_REGION
      accessKeyId: <aws access key id> # or env var OM_SM_ACCESS_KEY_ID
      secretAccessKey: <aws secret access key> # or env var OM_SM_ACCESS_KEY

pipelineServiceClientConfiguration:
  # ...
  # Secrets Manager Loader: specify to the Ingestion Framework how to load the SM credentials from its env
  # Supported: noop, airflow, env
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-"noop"}
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

### 3. Migrate Secrets & restart both servers

After updating the configuration files, we are ready to migrate the secrets and restart both services.

In order to ensure that the current sensitive information is properly migrated to the Secrets Manager, you need to
run the following command:

```bash
./bootstrap/openmetadata-ops.sh migrate-secrets
```

Make sure you are running it with the same environment variables required by the server.

If everything goes as planned, all the data would be displayed using the secrets names which starts with 
`/openmetadata/...` in your AWS Secrets Manager console. The following image shows what it should look like:

{% image src="/images/v1.7/deployment/secrets-manager/supported-implementations/aws-secrets-manager/secrets-manager-console.png" alt="secrets-manager-console" /%}

**Note:** If we want to change the starting path for our secrets names from `openmetadata` to a different one, we have 
to change the property `clusterName` in our `openmetadata.yaml`. Also, if you inform the `prefix` value, it will be
added before the `clusterName`, i.e., `/<prefix>/<clusterName>/<key>`.

You can inform the `tags` as well as a list of strings `[key1:value1,key2:value2,...]`. These tags will be added
to the resource created in AWS.

## CLI

After enabling the Secret Manager, we also have to make a slight change in our workflows YAML files. In the 
`workflowConfig` we have to add the secret manager configuration:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: aws
    secretsManagerLoader: env
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

Then, in the environment running the CLI make sure to have an environment variable `AWS_DEFAULT_REGION` with the rest
of the required configurations from [AWS](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html#using-environment-variables).

## Airflow

If you enabled the Secret Manager and you are using your own Airflow to run the ingestions, make sure to configure
your YAML files as:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: aws
    secretsManagerLoader: airflow
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

and follow the same environment variables to set up the Airflow configuration:

```bash
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AWS_REGION= <aws region>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AWS_ACCESS_KEY_ID= <aws access key id>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AWS_SECRET_ACCESS_KEY= <aws secret access key>
```
