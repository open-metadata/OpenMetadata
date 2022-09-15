---
title: Managing Credentials
slug: /openmetadata/connectors/credentials
---

# Manging Credentials in the CLI

When running Workflow with the CLI or your favourite scheduler, it's safer to not have the services' credentials
at plain sight. For the CLI, the ingestion package can load sensitive information from environment variables.

For example, if you are using the [Glue](/openmetadata/connectors/database/glue) connector you could specify the
AWS configurations as follows in the case of a JSON config file

```json
[...]
"awsConfig": {
    "awsAccessKeyId": "${AWS_ACCESS_KEY_ID}",
    "awsSecretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
    "awsRegion": "${AWS_REGION}",
    "awsSessionToken": "${AWS_SESSION_TOKEN}"
},
[...]
```

Or

```yaml
[...]
awsConfig:
  awsAccessKeyId: '${AWS_ACCESS_KEY_ID}'
  awsSecretAccessKey: '${AWS_SECRET_ACCESS_KEY}'
  awsRegion: '${AWS_REGION}'
  awsSessionToken: '${AWS_SESSION_TOKEN}'
[...]
```

for a YAML configuration.

# AWS Credentials

The AWS Credentials are based on the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-service/src/main/resources/json/schema/security/credentials/awsCredentials.json).
Note that the only required field is the `awsRegion`. This configuration is rather flexible to allow installations under AWS
that directly use instance roles for permissions to authenticate to whatever service we are pointing to without having to
write the credentials down.

## AWS Vault

If using [aws-vault](https://github.com/99designs/aws-vault), it gets a bit more involved to run the CLI ingestion as the credentials are not globally available in the terminal.
In that case, you could use the following command after setting up the ingestion configuration file:

```bash
aws-vault exec <role> -- $SHELL -c 'metadata ingest -c <path to connector>'
```

# GCS Credentials

The GCS Credentials are based on the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-service/src/main/resources/json/schema/security/credentials/gcsCredentials.json).
These are the fields that you can export when preparing a Service Account.

Once the account is created, you can see the fields in the exported JSON file from:

```
IAM & Admin > Service Accounts > Keys
```

You can validate the whole Google service account setup [here](deployment/security/google).
