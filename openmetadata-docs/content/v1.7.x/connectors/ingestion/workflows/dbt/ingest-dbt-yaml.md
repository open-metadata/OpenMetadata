---
title: Run dbt Workflow Externally | OpenMetadata Guide
slug: /connectors/ingestion/workflows/dbt/run-dbt-workflow-externally
---

# Run Externally
Learn how to configure the dbt workflow externally to ingest dbt data from your data sources.

Once the metadata ingestion runs correctly and we are able to explore the service Entities, we can add the dbt information.

This will populate the dbt tab from the Table Entity Page.

{% image
  src="/images/v1.7/features/ingestion/workflows/dbt/dbt-features/dbt-query.webp"
  alt="dbt"
  caption="dbt"
 /%}


We can create a workflow that will obtain the dbt information from the dbt files and feed it to OpenMetadata. The dbt Ingestion will be in charge of obtaining this data.

## 1. Define the YAML Config

Select the yaml config from one of the below sources:
- [AWS S3 Buckets](#1.-aws-s3-buckets)
- [Google Cloud Storage Buckets](#2.-google-cloud-storage-buckets)
- [Azure Storage Buckets](#3.-azure-storage-buckets)
- [Local Storage](#4.-local-storage)
- [File Server](#5.-file-server)
- [dbt Cloud](#6.-dbt-cloud)


The dbt files should be present on the source mentioned and should have the necessary permissions to be able to access the files.
Enter the name of your database service from OpenMetadata in the `serviceName` key in the yaml

### 1. AWS S3 Buckets
In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from an S3 bucket.

{% codePreview %}

{% codeInfoContainer %}

#### Source Config - Type

{% codeInfo srNumber=10 %}
- **dbtConfigType**: s3
{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/common/aws-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/dbt-prefix-def.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="dbt_s3_config.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
```
```yaml {% srNumber=10 %}
      dbtConfigSource:
        dbtConfigType: s3
```
```yaml {% srNumber=1 %}
      dbtSecurityConfig:
```

{% partial file="/v1.7/connectors/yaml/common/aws-config.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/dbt-prefix.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 2. Google Cloud Storage Buckets
In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from a GCS bucket.

{% codePreview %}

{% codeInfoContainer %}

#### Source Config - Type

{% codeInfo srNumber=20 %}
- **dbtConfigType**: gcs
{% /codeInfo %}

{% codeInfo srNumber=21 %}

**credentials**: 
You can authenticate with your GCS instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**gcpConfig:**

**1.** Passing the raw credential values provided by GCS. This requires us to provide the following information, all provided by GCS:

  - **type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
  - **projectId**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file.
  - **privateKeyId**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
  - **privateKey**: This is the private key associated with the service account that is used to authenticate and authorize access to GCS. To fetch this key, look for the value associated with the `private_key` key in the service account file.
  - **clientEmail**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
  - **clientId**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
  - **authUri**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
  - **tokenUri**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
  - **authProviderX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
  - **clientX509CertUrl**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**2.**  Passing a local file path that contains the credentials:
  - **gcpCredentialsPath**

- If you prefer to pass the credentials file, you can do so as follows:
```yaml
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
      dbtConfigSource:
        dbtConfigType: gcs
        dbtSecurityConfig:
          gcpConfig: <path to file>
```

- If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for gcs you can just leave
the GCP credentials empty. This is why they are not marked as required.

```yaml
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
      dbtConfigSource:
        dbtConfigType: gcs
        dbtSecurityConfig:
          gcpConfig: {}
```

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dbt/dbt-prefix-def.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="dbt_gcs_config.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
```
```yaml {% srNumber=20 %}
      dbtConfigSource:
        dbtConfigType: gcs
```
```yaml {% srNumber=21 %}
        dbtSecurityConfig:
          gcpConfig:
            type: My Type
            projectId: project ID
            privateKeyId: us-east-2
            privateKey: |
              -----BEGIN PRIVATE KEY-----
              Super secret key
              -----END PRIVATE KEY-----
            clientEmail: client@mail.com
            clientId: 1234
            authUri: https://accounts.google.com/o/oauth2/auth (default)
            tokenUri: https://oauth2.googleapis.com/token (default)
            authProviderX509CertUrl: https://www.googleapis.com/oauth2/v1/certs (default)
            clientX509CertUrl: https://cert.url (URI)
```

{% partial file="/v1.7/connectors/yaml/dbt/dbt-prefix.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 3. Azure Storage Buckets
In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from a Azure Storage bucket.

{% codePreview %}

{% codeInfoContainer %}

#### Source Config - Type

{% codeInfo srNumber=30 %}
- **dbtConfigType**: azure
{% /codeInfo %}

{% codeInfo srNumber=31 %}
- **Client ID**: This is the unique identifier for your application registered in Azure AD. It’s used in conjunction with the Client Secret to authenticate your application.
{% /codeInfo %}

{% codeInfo srNumber=32 %}
- **Client Secret**: A key that your application uses, along with the Client ID, to access Azure resources.

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for this connection.
4. Under `Manage`, select `Certificates & secrets`.
5. Under `Client secrets`, select `New client secret`.
6. In the `Add a client secret` pop-up window, provide a description for your application secret. Choose when the application should expire, and select `Add`.
7. From the `Client secrets` section, copy the string in the `Value` column of the newly created application secret.


{% /codeInfo %}

{% codeInfo srNumber=33 %}
- **Tenant ID**: The unique identifier of the Azure AD instance under which your account and application are registered.

To get the tenant ID, follow these steps:

1. Log into [Microsoft Azure](https://ms.portal.azure.com/#allservices).
2. Search for `App registrations` and select the `App registrations link`.
3. Select the `Azure AD` app you're using for Power BI.
4. From the `Overview` section, copy the `Directory (tenant) ID`.
{% /codeInfo %}

{% codeInfo srNumber=34 %}
- **Account Name**: The name of your ADLS account.

Here are the step-by-step instructions for finding the account name for an Azure Data Lake Storage account:

1. Sign in to the Azure portal and navigate to the `Storage accounts` page.
2. Find the Data Lake Storage account you want to access and click on its name.
3. In the account overview page, locate the `Account name` field. This is the unique identifier for the Data Lake Storage account.
4. You can use this account name to access and manage the resources associated with the account, such as creating and managing containers and directories.

{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dbt/dbt-prefix-def.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="dbt_azure_config.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
```
```yaml {% srNumber=30 %}
      dbtConfigSource:
        dbtConfigType: azure
```
```yaml {% srNumber=31 %}
        dbtSecurityConfig:
          clientId: clientId
```
```yaml {% srNumber=32 %}
          clientSecret: clientSecret
```
```yaml {% srNumber=33 %}
          tenantId: tenantId
```
```yaml {% srNumber=34 %}
          accountName: accountName
```

{% partial file="/v1.7/connectors/yaml/dbt/dbt-prefix.md" /%}

{% partial file="/v1.7/connectors/yaml/dbt/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}


### 4. Local Storage
In this configuration, we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from the same host that is running the ingestion process.

{% codePreview %}

{% codeInfoContainer %}

#### Source Config - Type

{% codeInfo srNumber=40 %}
- **dbtConfigType**: local
{% /codeInfo %}

{% codeInfo srNumber=41 %}
- **dbtCatalogFilePath**: catalog.json file path to extract dbt models with their column schemas.
{% /codeInfo %}

{% codeInfo srNumber=42 %}
- **dbtManifestFilePath** (`Required`): manifest.json file path to extract dbt models with their column schemas.
{% /codeInfo %}

{% codeInfo srNumber=43 %}
- **dbtRunResultsFilePath**: run_results.json file path to extract dbt models tests and test results metadata. Tests from dbt will only be ingested if this file is present.
{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dbt/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="dbt_local_config.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
```
```yaml {% srNumber=40 %}
      dbtConfigSource:
        dbtConfigType: local
```
```yaml {% srNumber=41 %}
        dbtCatalogFilePath: path/to/catalog.json
```
```yaml {% srNumber=42 %}
        dbtManifestFilePath: path/to/manifest.json
```
```yaml {% srNumber=43 %}
        dbtRunResultsFilePath: path/to/run_results.json
```

{% partial file="/v1.7/connectors/yaml/dbt/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 5. File Server
In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from an HTTP or File Server.

{% codePreview %}

{% codeInfoContainer %}

#### Source Config - Type

{% codeInfo srNumber=50 %}
- **dbtConfigType**: http
{% /codeInfo %}

{% codeInfo srNumber=51 %}
- **dbtCatalogHttpPath**: catalog.json http path to extract dbt models with their column schemas.
{% /codeInfo %}

{% codeInfo srNumber=52 %}
- **dbtManifestHttpPath** (`Required`): manifest.json http path to extract dbt models with their column schemas.
{% /codeInfo %}

{% codeInfo srNumber=53 %}
- **dbtRunResultsHttpPath**: run_results.json http path to extract dbt models tests and test results metadata. Tests from dbt will only be ingested if this file is present.
{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dbt/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="dbt_file_server_config.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
```
```yaml {% srNumber=50 %}
      dbtConfigSource:
        dbtConfigType: http
```
```yaml {% srNumber=51 %}
        dbtCatalogHttpPath: http://path-to-catalog.json
```
```yaml {% srNumber=52 %}
        dbtManifestHttpPath: http://path-to-manifest.json
```
```yaml {% srNumber=53 %}
        dbtRunResultsHttpPath: http://path-to-run_results.json
```

{% partial file="/v1.7/connectors/yaml/dbt/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}

### 6. dbt Cloud
In this configuration we will be fetching the dbt `manifest.json`, `catalog.json` and `run_results.json` files from dbt cloud APIs.

The `Account Viewer` permission is the minimum requirement for the dbt cloud token.

{% note %}

The dbt Cloud workflow leverages the [dbt Cloud v2](https://docs.getdbt.com/dbt-cloud/api-v2#/) APIs to retrieve dbt run artifacts (manifest.json, catalog.json, and run_results.json) and ingest the dbt metadata.

It uses the [/runs](https://docs.getdbt.com/dbt-cloud/api-v2#/operations/List%20Runs) API to obtain the most recent successful dbt run, filtering by account_id, project_id and job_id if specified. The artifacts from this run are then collected using the [/artifacts](https://docs.getdbt.com/dbt-cloud/api-v2#/operations/List%20Run%20Artifacts) API.

Refer to the code [here](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/src/metadata/ingestion/source/database/dbt/dbt_config.py#L142)

{% /note %}

{% codePreview %}

{% codeInfoContainer %}

#### Source Config - Type

{% codeInfo srNumber=60 %}
- **dbtConfigType**: cloud
{% /codeInfo %}

{% codeInfo srNumber=61 %}
- **dbtCloudAuthToken**: Please follow the instructions in [dbt Cloud's API](https://docs.getdbt.com/docs/dbt-cloud-apis/service-tokens) documentation to create a dbt Cloud authentication token.
The `Account Viewer` permission is the minimum requirement for the dbt cloud token.
{% /codeInfo %}

{% codeInfo srNumber=62 %}
- **dbtCloudAccountId** (`Required`): To obtain your dbt Cloud account ID, sign in to dbt Cloud in your browser. Take note of the number directly following the accounts path component of the URL -- this is your account ID.

For example, if the URL is `https://cloud.getdbt.com/#/accounts/1234/projects/6789/dashboard/`, the account ID is `1234`.
{% /codeInfo %}

{% codeInfo srNumber=63 %}
- **dbtCloudJobId**: In case of multiple jobs in a dbt cloud account, specify the job's ID from which you want to extract the dbt run artifacts.
If left empty, the dbt artifacts will be fetched from the most recent run on dbt cloud.

After creating a dbt job, take note of the url which will be similar to `https://cloud.getdbt.com/#/accounts/1234/projects/6789/jobs/553344/`. The job ID is `553344`.

The value entered should be a `numeric` value.
{% /codeInfo %}

{% codeInfo srNumber=64 %}
- **dbtCloudProjectId**: In case of multiple projects in a dbt cloud account, specify the project's ID from which you want to extract the dbt run artifacts.
If left empty, the dbt artifacts will be fetched from the most recent run on dbt cloud.

To find your project ID, sign in to your dbt cloud account and choose a specific project. Take note of the url which will be similar to `https://cloud.getdbt.com/#/accounts/1234/settings/projects/6789/`, the project ID is `6789`.

The value entered should be a `numeric` value.
{% /codeInfo %}

{% codeInfo srNumber=65 %}
- **dbtCloudUrl**: URL to connect to your dbt cloud instance. E.g., `https://cloud.getdbt.com` or `https://emea.dbt.com/`.
{% /codeInfo %}

{% partial file="/v1.7/connectors/yaml/dbt/source-config-def.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink-def.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config-def.md" /%}

{% /codeInfoContainer %}

{% codeBlock fileName="dbt_file_server_config.yaml" %}

```yaml {% isCodeBlock=true %}
source:
  type: dbt
  serviceName: service_name
  sourceConfig:
    config:
      type: DBT
```
```yaml {% srNumber=60 %}
      dbtConfigSource:
        dbtConfigType: cloud
```
```yaml {% srNumber=61 %}
        dbtCloudAuthToken: AUTH_TOKEN
```
```yaml {% srNumber=62 %}
        dbtCloudAccountId: ACCOUNT_ID
```
```yaml {% srNumber=63 %}
        dbtCloudJobId: JOB_ID
```
```yaml {% srNumber=64 %}
        dbtCloudProjectId: PROJECT_ID
```
```yaml {% srNumber=65 %}
        dbtCloudUrl: https://cloud.getdbt.com
```

{% partial file="/v1.7/connectors/yaml/dbt/source-config.md" /%}

{% partial file="/v1.7/connectors/yaml/ingestion-sink.md" /%}

{% partial file="/v1.7/connectors/yaml/workflow-config.md" /%}

{% /codeBlock %}

{% /codePreview %}


## 2. Run the dbt ingestion

After saving the YAML config, we will run the command for dbt ingestion

```bash
metadata ingest -c <path-to-yaml>
```
