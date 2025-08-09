---
title: Azure Key Vault | OpenMetadata Secrets Manager Guide
description: Get started with azure key vault. Setup instructions, features, and configuration details inside. Refer to the official documentation for the latest updates.
slug: /deployment/secrets-manager/supported-implementations/azure-key-vault
collate: false
---

# Azure Key Vault

The setup steps covers the use of the managed version of the Azure Key Vault as secrets manager but
for the non-managed follow only the steps related to the Airflow server and CLI.

## Setup

### 1. Create Principal

#### Service Principal

1. Go to `Microsoft Entra ID` and create an [App Registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app).
2. Inside the App Registration, go to `Certificates & Secrets` and create a `Client secret`. Note down the `Value`, it will be our `clientSecret` configuration.
3. From the App Registration overview page, note down the `Application (client) ID` and the `Directory (tenant) ID`.

#### Managed Identity (recommnded)

1. In your Azure subscription create [Manged Identity](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview)
2. Use this created identity - for AKS users this means you need to use [Pod Identity](https://learn.microsoft.com/en-us/azure/aks/use-azure-ad-pod-identity) or [Workload Identity (recommnded)](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview?tabs=dotnet).

{% note %}

Note that the using Managed Identity require using [default Authentication Credential](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#defaultazurecredential).

{% /note %}

### 2. Add RBAC roles

It if possible to use different Principals for OpenMetadata Server and the Ingestion. In that case the server needs higher privileges - `Key Vault Secrets Officer` - to be able to create/read/update secrets in the Vault.

While the Airflow part only needs to read the secrets hence the role `Key Vault Secrets Officer`.

#### Open Metadata server

1. In your Key Vault overview page, note down the `Vault URI`.
2. Go to `Access Control (IAM)` and click on `Add Role Assignment`.
3. Give the permission `Key Vault Secrets Officer` to your Principal.

#### Airflow

1. In your Key Vault overview page, note down the `Vault URI`.
2. Go to `Access Control (IAM)` and click on `Add Role Assignment`.
3. Give the permission `Key Vault Secrets User` to your Principal.

### 3. Update configuration

We have to set up the secret manager provider we want to use, that in our case is `azure-kv`, and the credentials.

The changes to be done in `openmetadata.yaml` file of the OpenMetadata server are:

#### Default Azure Credential

```yaml
---
secretsManagerConfiguration:
  secretsManager: managed-azure-kv # or env var SECRET_MANAGER. For non-managed use 'azure-kv'.
  prefix: ${SECRET_MANAGER_PREFIX:-""} # Define the secret key ID as <prefix>-<clusterName>-<key>
  tags: ${SECRET_MANAGER_TAGS:-[]} # Add tags to the created resource. Format is `[key1:value1,key2:value2,...]`
  parameters:
    enabled: true
    vaultName: ${OM_SM_VAULT_NAME:-""}
pipelineServiceClientConfiguration:
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-airflow}
```

For Helm Values, you will need to add `PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER` as part of `extraEnvs`. This will look like below -

```yaml
---
...
extraEnvs:
- name: PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER
  value: airflow
...
```

#### Client Secret Credential

```yaml
---
secretsManagerConfiguration:
  secretsManager: managed-azure-kv # or env var SECRET_MANAGER. For non-managed use 'azure-kv'.
  prefix: ${SECRET_MANAGER_PREFIX:-""} # Define the secret key ID as <prefix>-<clusterName>-<key>
  tags: ${SECRET_MANAGER_TAGS:-[]} # Add tags to the created resource. Format is `[key1:value1,key2:value2,...]`
  parameters:
    enabled: true
    clientId: ${OM_SM_CLIENT_ID:-""}
    clientSecret: ${OM_SM_CLIENT_SECRET:-""}
    tenantId: ${OM_SM_TENANT_ID:-""}
    vaultName: ${OM_SM_VAULT_NAME:-""}
pipelineServiceClientConfiguration:
  secretsManagerLoader: ${PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER:-airflow}
```

For Helm Values, you will need to add `PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER` as part of `extraEnvs`. This will look like below -

```yaml
---
...
extraEnvs:
- name: PIPELINE_SERVICE_CLIENT_SECRETS_MANAGER_LOADER
  value: airflow
...
```

The changes to be done in `airflow.yaml` file of the Airflow are:

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

{% note %}

Also if you are using [Microsoft Entra Workload ID](https://learn.microsoft.com/en-us/azure/aks/workload-identity-overview) with [Service Account Token Volume Projection](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/#serviceaccount-token-volume-projection) then you need also to use projected service account instead one created by Airflow and OpenMetadata:

airflow.yaml:

```yaml
---
serviceAccount:
  create: false
  name: "name-of-your-service-account"
```

openmetadata.yaml:

```yaml
---
serviceAccount:
  create: false
  name: "name-of-your-service-account"
```

{% /note %}

### 3. Migrate Secrets & restart both servers

After updating the configuration files, we are ready to migrate the secrets and restart both services.

In order to ensure that the current sensitive information is properly migrated to the Secrets Manager, you need to
run the following command:

```bash
./bootstrap/openmetadata-ops.sh migrate-secrets
```

Make sure you are running it with the same environment variables required by the server.

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
