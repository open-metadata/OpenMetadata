---
title: Azure Key Vault
slug: /deployment/secrets-manager/supported-implementations/azure-key-vault
---

# Azure Key Vault

The setup steps covers the use of the managed version of the Azure Key Vault as secrets manager but
for the non-managed follow only the steps related to the Airflow server and CLI.

## Setup

### 1. Permissions needed

1. Go to `Microsoft Entra ID` and create an [App Registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
2. Inside the App Registration, go to `Certificates & Secrets` and create a `Client secret`. Note down the `Value`, it will be our `clientSecret` configuration.
3. From the App Registration overview page, note down the `Application (client) ID` and the `Directory (tenant) ID`.
4. In your Key Vault overview page, note down the `Vault URI`.
5. Go to `Access Control (IAM)` and click on `Add Role Assignment`.
6. Give the permission `Key Vault Secrets Officer` to your App Registration.

### 2. Update configuration

We have to set up the secret manager provider we want to use, that in our case is `azure-kv`, and the credentials for our 
App Registration.

The changes to be done in `openmetadata.yaml` file of the OpenMetadata server are:

```yaml
...
secretsManagerConfiguration:
    secretsManager: managed-azure-kv  # or env var SECRET_MANAGER. For non-managed use 'azure-kv'.
    prefix: ${SECRET_MANAGER_PREFIX:-""} # Define the secret key ID as <prefix>-<clusterName>-<key>
    tags: ${SECRET_MANAGER_TAGS:-[]} # Add tags to the created resource. Format is `[key1:value1,key2:value2,...]`
    parameters:
      clientId: ${OM_SM_CLIENT_ID:-""}
      clientSecret: ${OM_SM_CLIENT_SECRET:-""}
      tenantId: ${OM_SM_TENANT_ID:-""}
      vaultName: ${OM_SM_VAULT_NAME:-""}

pipelineServiceClientConfiguration:
  # ...
  # Secrets Manager Loader: specify to the Ingestion Framework how to load the SM credentials from its env
  # Supported: noop, airflow, env
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-"noop"}
...
```

{% note %}

Note that the **Key Vault Name** parameter is MANDATORY for the system to know where to store and retrieve the secrets.

{% /note %}

And these are the changes required in `airflow.cfg` of our Airflow instance:

```properties
...
[openmetadata_secrets_manager]
azure_key_vault_name = <Key Vault Name>
azure_tenant_id = <Tenant / Directory ID>
azure_client_id = <App Registration ID>
azure_client_secret = <App Registration Secret>
...
```

As an alternative to editing the `airflow.cfg` file, we can also set the following environment variables:

```bash
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_KEY_VAULT_NAME= <Key Vault Name>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_TENANT_ID= <Tenant / Directory ID>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_CLIENT_ID= <App Registration ID>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_CLIENT_SECRET= <App Registration Secret>
```

If only the `<Key Vault Name>`, parameter is provided, we will use Azure's [default Authentication Credential](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#defaultazurecredential).

### 3. Restart both servers

After updating the configuration files, we are ready to restart both services. When the OM server starts, it will 
automatically detect that a Secrets Manager has been configured and will migrate all our sensitive data and remove it 
from our DB.

If everything goes as planned, all the data would be displayed using the parameters names which starts with 
`openmetadata-...` in your Key Vault console.

**Note:** If we want to change the starting path for our secrets names from `openmetadata` to a different one, we have 
to change the property `clusterName` in our `openmetadata.yaml`. Also, if you inform the `prefix` value, it will be
added before the `clusterName`, i.e., `<prefix>-<clusterName>-<key>`

You can inform the `tags` as well as a list of strings `[key1:value1,key2:value2,...]`. These tags will be added
to the created secret.

## CLI

After enabling the Secret Manager, we also have to make a slight change in our workflows YAML files. In the 
`workflowConfig` we have to add the secret manager configuration:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: azure-kv
    secretsManagerLoader: env
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

Make sure to follow the steps [here](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#defaultazurecredential) to allow
the Python client to authenticate to Azure. 

{% note %}

Note that the `AZURE_KEY_VAULT_NAME` variable is **REQUIRED** to know against which
Key Vault service to point to.

{% /note %}

You can specify as well the environment variables of your App Registration if you're running the ingestion
outside of Azure: [docs](https://learn.microsoft.com/en-us/python/api/azure-identity/azure.identity.environmentcredential?view=azure-python).


## Airflow

If you enabled the Secret Manager and you are using your own Airflow to run the ingestions, make sure to configure
your YAML files as:

```yaml
workflowConfig:
  openMetadataServerConfig:
    secretsManagerProvider: azure-kv
    secretsManagerLoader: airflow
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```

and follow the same environment variables to set up the Airflow configuration:

```bash
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_KEY_VAULT_NAME= <Key Vault Name>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_TENANT_ID= <Tenant / Directory ID>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_CLIENT_ID= <App Registration ID>
AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_CLIENT_SECRET= <App Registration Secret>
```

{% note %}

Note that the `AIRFLOW__OPENMETADATA_SECRETS_MANAGER__AZURE_KEY_VAULT_NAME` variable is **REQUIRED** to know against which
Key Vault service to point to.

{% /note %}
