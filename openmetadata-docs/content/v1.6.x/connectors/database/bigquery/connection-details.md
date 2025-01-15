---
title: Connection Details
slug: /connectors/database/bigquery/connections
---

#### Connection Options

**Host and Port**: BigQuery APIs URL. By default, the API URL is `bigquery.googleapis.com` you can modify this if you have custom implementation of BigQuery.

**GCP Credentials**: 
You can authenticate with your bigquery instance using either `GCP Credentials Path` where you can specify the file path of the service account key or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check out [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.

**GCP Credentials Values**: Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:

- **Credentials type**: Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
- **Project ID**: A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. You can also pass multiple project id to ingest metadata from different BigQuery projects into one service.
- **Private Key ID**: This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
- **Private Key**: This is the private key associated with the service account that is used to authenticate and authorize access to BigQuery. To fetch this key, look for the value associated with the `private_key` key in the service account file.
- **Client Email**: This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
- **Client ID**: This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key  file.
- **Auth URI**: This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file. The default value to Auth URI is https://accounts.google.com/o/oauth2/auth.
- **Token URI**: The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization. To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file. Default Value to Token URI is https://oauth2.googleapis.com/token.
- **Authentication Provider X509 Certificate URL**: This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file. The Default value for Auth Provider X509Cert URL is https://www.googleapis.com/oauth2/v1/certs
- **Client X509Cert URL**: This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key  file.

**GCP Credentials Path**: Passing a local file path that contains the credentials.

**Taxonomy Project ID (Optional)**: Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the id of project in which the taxonomy was created.

**Taxonomy Location (Optional)**: Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the location/region in which the taxonomy was created.

**Usage Location (Optional)**:
Location used to query `INFORMATION_SCHEMA.JOBS_BY_PROJECT` to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or your specific region such as `us-east1`. Australia and Asia multi-regions are not yet supported.

{% note %}
If you want to use [ADC authentication](https://cloud.google.com/docs/authentication#adc) for BigQuery you can just leave
the GCP credentials empty. This is why they are not marked as required.
{% /note %}


{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}