---
description: Learn how to install the Lineage Backend in AWS MWAA
---

# Lineage Backend in MWAA

Amazon Managed Workflows for Apache Airflow ([MWAA](https://docs.aws.amazon.com/mwaa/latest/userguide/what-is-mwaa.html)) is a managed orchestration service on top of Apache Airflow hosted in AWS. This allows users to develop Airflow DAGs and orchestrate pipelines without the management burden.

In this guide, we'll learn how to configure the Airflow Lineage Backend in MWAA.

{% hint style="info" %}
This is a WIP that has been tested in Airflow 2.0.2 using [https://github.com/aws/aws-mwaa-local-runner](https://github.com/aws/aws-mwaa-local-runner).
{% endhint %}

## Requirements

#### **OpenMetadata (version 0.10.1 or later)**

To deploy OpenMetadata, follow the procedure [Try OpenMetadata in Docker](../../../overview/run-openmetadata.md) or follow the [OpenMetadata & Prefect](../../../overview/run-openmetadata-with-prefect.md) guide.

## 1. requirements.txt

In the `requirements.txt` file you upload to the S3 bucket, add the following line:

```
openmetadata-ingestion[airflow-container]
```

## 2. Airflow configuration options

Add the following entries as custom configuration options:

* `lineage.airflow_service_name`: What to name the Pipeline Service. E.g., `MWAA`.
* `lineage.auth_provider_type`: `no-auth` or any other supported Auth Provider, such as `google`.
* `lineage.backend`: `airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend`
* `lineage.openmetadata_api_endpoint`: OpenMetadata server URL, e.g., `http://localhost:8585/api`.

## 3. Add security configurations

### Google

* `lineage.secret_key`: Add the whole JSON with the credentials for the `service_account`. Note that if there are any `%`, in the values, you'll need to double them and write them as `%%`. This is because Airflow tries to parse the string after any `%`

### Auth0

* `lineage.client_id`
* `lineage.secret_key`
* `lineage.domain`

### Okta

* `lineage.client_id`
* `lineage.org_url`
* `lineage.private_key`
* `lineage.email`
* `lineage.scopes` as a list `[scope, scope2]`

### Azure

* `lineage.client_secret`
* `lineage.authority`
* `lineage.client_id`
* `lineage.scopes` as a list `[scope, scope2]`

### Custom OIDC

* `lineage.client_id`
* `lineage.secret_key`
* `lineage.token_endpoint`

### JWT

* `lineage.jwt_token`
