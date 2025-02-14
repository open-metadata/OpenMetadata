---
title: GCP Secret Manager Parameter Store
slug: /deployment/secrets-manager/supported-implementations/gcp-secret-manager
collate: false
---

# GCP Secret Manager

The setup steps covers the use of the managed version of the GCP Secret Manager as secrets manager but
for the non-managed follow only the steps related to the Airflow server and CLI.

## Setup

### 1. Permissions needed

These are the permissions required in the service account to enable the GCP Secret Manager in OpenMetadata. We recommend to use the role named `roles/secretmanager.secretAccessor` to grant necessary permissions. 

- resourcemanager.projects.get
- resourcemanager.projects.list
- secretmanager.versions.access

### 2. Update configuration

We have to set up the secret manager provider we want to use, that in our case is `gcp`, and the credentials for our GCP information.

The changes to be done in `openmetadata.yaml` file of the OpenMetadata server are:

```yaml
...
secretsManagerConfiguration:
    secretsManager: gcp # or env var SECRET_MANAGER.
    prefix: ${SECRET_MANAGER_PREFIX:-""} # Define the secret key ID as /<prefix>/<clusterName>/<key>
    parameters:
      projectId: <gcp project id> # or env var OM_SM_PROJECT_ID

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
gcp_project_id = <gcp project id>
...
```

As an alternative to editing the `airflow.cfg` file, we can also set the following environment variables:

```bash
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__GCP_PROJECT_ID= <gcp project id>
```

If no parameters are provided for the GCP account, it will use Application Default Credentials (ADC). 
ADC will look for credentials in:

1. Local development environment
2. Cloud Shell or other Google Cloud cloud-based development environments
3. Compute Engine or other Google Cloud services that support attaching a service account
4. Google Kubernetes Engine or GKE Enterprise
5. On-premises or another cloud provider


More info in [Set up Application Default Credentials](https://cloud.google.com/docs/authentication/provide-credentials-adc)

### 3. Migrate Secrets & restart both servers

After updating the configuration files, we are ready to migrate the secrets and restart both services.

In order to ensure that the current sensitive information is properly migrated to the Secrets Manager, you need to
run the following command:

```bash
./bootstrap/openmetadata-ops.sh migrate-secrets
```

Make sure you are running it with the same environment variables required by the server.

If everything goes as planned, all the data would be displayed using the parameters names which starts with 
`/openmetadata/...` in your GCP Secret Manager console. The following image shows what it should look 
like:

{% image src="/images/v1.7/deployment/secrets-manager/supported-implementations/gcp-secret-manager/gcp-secret-manager-console.png" alt="gcp-secret-manager-console" /%}

**Note:** If we want to change the starting path for our secrets names from `openmetadata` to a different one, we have 
to change the property `clusterName` in our `openmetadata.yaml`. Also, if you inform the `prefix` value, it will be
added before the `clusterName`, i.e., `/<prefix>/<clusterName>/<key>`

You can inform the `tags` as well as a list of strings `[key1:value1,key2:value2,...]`. These tags will be added
to the resource created in GCP.

## Airflow

If you enabled the Secret Manager and you are using your own Airflow to run the ingestions, make sure to configure
your YAML files as:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: gcp
    secretsManagerLoader: airflow
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

and follow the same environment variables to set up the Airflow configuration:

```bash
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__GCP_PROJECT_ID= <gcp project id>
```
