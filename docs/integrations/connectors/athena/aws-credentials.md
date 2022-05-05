---
description: Learn how to configure the AWS Credentials for the connector
---

# AWS Credentials

Some connectors such as Athena or Glue, require AWS Credentials to be used in the JSON Configuration to properly authenticate to the service.

You can find the definition of the support credentials [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/security/credentials/awsCredentials.json).

## Credentials

#### AWS Access Key ID

Enter your secure access key ID for your Glue connection. The specified key ID should be authorized to read all databases you want to include in the metadata ingestion workflow.

#### AWS Secret Access Key

Enter the Secret Access Key (the passcode key pair to the key ID from above).

#### AWS Region

Specify the region in which your Glue catalog is located.

Note: This setting is required even if you have configured a local AWS profile.

#### AWS Session Token &#x20;

The AWS session token is an optional parameter. If you want, enter the details of your temporary session token.

#### Endpoint URL (optional)

The Glue connector will automatically determine the AWS Glue endpoint URL based on the AWS Region. You may specify a value to override this behavior.&#x20;

## Using Environment Variables

When working with AWS, the most likely scenario is that the credentials are generated via a CLI command and stored in the terminal session. If you're using a tool that sets them up as environment variables, then the JSON configuration can look like this:

```json
{
    "source": {
        "type": "athena",
        "serviceName": "local_athena",
        "serviceConnection": {
            "config": {
                "type": "Athena",
                "database": "database_name",
                "awsConfig": {
                    "awsAccessKeyId": "${AWS_ACCESS_KEY_ID}",
                    "awsSecretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
                    "awsRegion": "${AWS_REGION}",
                    "awsSessionToken": "${AWS_SESSION_TOKEN}"
                },
                "s3StagingDir": "s3 directory for datasource",
                "workgroup": "workgroup name"
            }
        },
        "sourceConfig": {
            "config": {
                "enableDataProfiler": false
            }
        }
    },
    "sink": {
        "type": "metadata-rest",
        "config": {}
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "no-auth"
        }
    }
}
```

A similar approach would be used for the profiler workflow.

{% hint style="info" %}
Make sure that the environment variables names used in the configuration match the ones provided by the tool you are using.
{% endhint %}

## AWS Vault

If using [aws-vault](https://github.com/99designs/aws-vault), it gets a bit more involved as the credentials are not globally available in the terminal.

In that case, you could use the following command after setting up the JSON configuration:

```
aws-vault exec <role> -- $SHELL -c 'metadata --debug ingest -c athena.json'
```

