# BigQuery

In this section, we provide guides and references to use the BigQuery connector.

## Requirements

We need to enable the Data Catalog API and use an account with a specific set of minnimum permissions:

### Data Catalog API Permissions

- Go to <a href="https://console.cloud.google.com/apis/library/datacatalog.googleapis.com" target="_blank">Google Cloud Data Catalog API</a> page,
- Select the `GCP Project ID` that you want to enable the `Data Catalog API` on,
- Click on `Enable API`, which will enable the Data Catalog API on the selected project.

### GCP Permissions

To execute the metadata extraction and Usage workflow successfully, the user or the service account should have enough permissions to fetch required data:

- `bigquery.datasets.get`
- `bigquery.tables.get`
- `bigquery.tables.getData`
- `bigquery.tables.list`
- `resourcemanager.projects.get`
- `bigquery.jobs.create`
- `bigquery.jobs.listAll`

Optional permissions, required to fetch policy tags
- `datacatalog.taxonomies.get` 
- `datacatalog.taxonomies.list` 

Optional permissions, required for Usage & Lineage workflow
- `bigquery.readsessions.create`
- `bigquery.readsessions.getData`


You can visit <a href="https://docs.open-metadata.org/connectors/database/bigquery/roles" target="_blank">this</a> documentation on how you can create a custom role in GCP and assign the above permissions to the role & service account!

You can find further information on the BigQuery connector in the <a href="https://docs.open-metadata.org/connectors/database/bigquery" target="_blank">docs</a>.


### Profiler & Data Quality
Executing the profiler Workflow or data quality tests, will require the user to have `SELECT` permission on the tables/schemas where the profiler/tests will be executed. The user should also be allowed to view information in `table_storage` for all objects in the database. More information on the profiler workflow setup can be found <a href="https://docs.open-metadata.org/how-to-guides/data-quality-observability/profiler/workflow" target="_blank">here</a> and data quality tests <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/data-quality" target="_blank">here</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Host Port $(id="hostPort")

BigQuery APIs URL. By default, the API URL is `bigquery.googleapis.com`. You can modify this if you have custom implementation of BigQuery.
$$

$$section
### GCP Credentials Configuration $(id="gcpConfig")

You can authenticate with your BigQuery instance using either `GCP Credentials Path` where you can specify the file path of the service account key, or you can pass the values directly by choosing the `GCP Credentials Values` from the service account key file.

You can check <a href="https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console" target="_blank">this</a> documentation on how to create the service account keys and download it.

If you want to use <a href="https://cloud.google.com/docs/authentication#adc" target="_blank">ADC authentication</a> for BigQuery you can just leave the GCP credentials empty.

$$

$$section
### Credentials Type $(id="type")

Credentials Type is the type of the account, for a service account the value of this field is `service_account`. To fetch this key, look for the value associated with the `type` key in the service account key file.
$$

$$section
### Billing Project ID $(id="billingProjectId")

A billing project ID is a unique string used to identify and authorize your project for billing in Google Cloud.
$$

$$section
### Project ID $(id="projectId")

A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the `project_id` key in the service account key file. 
You can select a single project ID or multiple project IDs from the dropdown menu to specify which projects you want to connect to.
$$

$$section
### Private Key ID $(id="privateKeyId")

This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the `private_key_id` key in the service account file.
$$

$$section
### Private Key $(id="privateKey")

This is the private key associated with the service account that is used to authenticate and authorize access to GCP. To fetch this key, look for the value associated with the `private_key` key in the service account file.

Make sure you are passing the key in a correct format. If your private key looks like this:

```
-----BEGIN ENCRYPTED PRIVATE KEY-----
MII..
MBQ...
CgU..
8Lt..
...
h+4=
-----END ENCRYPTED PRIVATE KEY-----
```

You will have to replace new lines with `\n` and the final private key that you need to pass should look like this:

```
-----BEGIN ENCRYPTED PRIVATE KEY-----\nMII..\nMBQ...\nCgU..\n8Lt..\n...\nh+4=\n-----END ENCRYPTED PRIVATE KEY-----\n
```
$$

$$section
### Client Email $(id="clientEmail")

This is the email address associated with the service account. To fetch this key, look for the value associated with the `client_email` key in the service account key file.
$$

$$section
### Client ID $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the `client_id` key in the service account key file.
$$

$$section
### Auth URI $(id="authUri")

This is the URI for the authorization server. To fetch this key, look for the value associated with the `auth_uri` key in the service account key file.
$$

$$section
### Token URI $(id="tokenUri")

The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization.

To fetch this key, look for the value associated with the `token_uri` key in the service account credentials file.
$$

$$section
### Auth Provider X509Cert URL $(id="authProviderX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the `auth_provider_x509_cert_url` key in the service account key file.
$$

$$section
### Client X509Cert URL $(id="clientX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the `client_x509_cert_url` key in the service account key file.
$$

$$section
### Taxonomy Project ID $(id="taxonomyProjectID")

BigQuery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how you can create policy tags and set up column-level access control <a href="https://cloud.google.com/bigquery/docs/column-level-security" target="_blank">here</a>

If you have attached policy tags to the columns of table available in BigQuery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the id of project in which the taxonomy was created.
$$

$$section
### Taxonomy Location $(id="taxonomyLocation")

BigQuery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how you can create policy tags and set up column-level access control <a href="https://cloud.google.com/bigquery/docs/column-level-security" target="_blank">here</a>

If you have attached policy tags to the columns of table available in BigQuery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the location/region in which the taxonomy was created.
$$

$$section
### Usage Location $(id="usageLocation")

Location used to query `INFORMATION_SCHEMA.JOBS_BY_PROJECT` to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or your specific region such as `us-east1`.

Australia and Asia multi-regions are not yet supported.
$$

$$section
### Cost Per TiB $(id="costPerTB")

The cost (in USD) per tebibyte (TiB) of data processed during BigQuery usage analysis. This value is used to estimate query costs when analyzing usage metrics from `INFORMATION_SCHEMA.JOBS_BY_PROJECT`.

This setting does **not** affect actual billing—it is only used for internal reporting and visualization of estimated costs.

The default value, if not set, may assume the standard on-demand BigQuery pricing (e.g., $5.00 per TiB), but you should adjust it according to your organization's negotiated rates or flat-rate pricing model.

$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Target Service Account Email $(id="impersonateServiceAccount")

The impersonated service account email.
$$

$$section
### Lifetime $(id="lifetime")

Number of seconds the delegated credential should be valid.
$$

$$section
### Audience $(id="audience")

Google Security Token Service audience which contains the resource name for the workload identity pool and the provider identifier in that pool.
$$

$$section
### Subject Token Type $(id="subjectTokenType")

Google Security Token Service subject token type based on the OAuth 2.0 token exchange spec.
$$

$$section
### Token URL $(id="tokenURL")

Google Security Token Service token exchange endpoint.
$$

$$section
### Credential Source $(id="credentialSource")

This object defines the mechanism used to retrieve the external credential from the local environment so that it can be exchanged for a GCP access token via the STS endpoint.
$$