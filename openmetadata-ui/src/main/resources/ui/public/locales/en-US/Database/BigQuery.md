# BigQuery

In this section, we provide guides and references to use the BigQuery connector.

# Requirements

<InlineCallout color="violet-70" icon="description" bold="OpenMetadata 0.12 or later" href="/deployment">
To deploy OpenMetadata, check the <a href="/deployment">Deployment</a> guides.
</InlineCallout>

To run the Ingestion via the UI you'll need to use the OpenMetadata Ingestion Container, which comes shipped with
custom Airflow plugins to handle the workflow deployment.

### Data Catalog API Permissions

- Go to <a href="https://console.cloud.google.com/apis/library/datacatalog.googleapis.com">https://console.cloud.google.com/apis/library/datacatalog.googleapis.com</a>
- Select the `GCP Project ID` that you want to enable the `Data Catalog API` on.
- Click on `Enable API` which will enable the data catalog api on the respective project.

### GCP Permissions

To execute metadata extraction and usage workflow successfully the user or the service account should have enough access to fetch required data. Following table describes the minimum required permissions

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | bigquery.datasets.get         | Metadata Ingestion      |
| 2    | bigquery.tables.get           | Metadata Ingestion      |
| 3    | bigquery.tables.getData       | Metadata Ingestion      |
| 4    | bigquery.tables.list          | Metadata Ingestion      |
| 5    | resourcemanager.projects.get  | Metadata Ingestion      |
| 6    | bigquery.jobs.create          | Metadata Ingestion      |
| 7    | bigquery.jobs.listAll         | Metadata Ingestion      |
| 8    | datacatalog.taxonomies.get    | Fetch Policy Tags       |
| 9    | datacatalog.taxonomies.list   | Fetch Policy Tags       |
| 10   | bigquery.readsessions.create  | Bigquery Usage & Lineage Workflow |
| 11   | bigquery.readsessions.getData | Bigquery Usage & Lineage Workflow |

You can checkout [this](https://docs.open-metadata.org/connectors/database/bigquery/roles) documentation on how you can create a custom role in GCP and assign the above permissions to the role & service account!

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options.
$$

$$section
### Host Port $(id="hostPort")

BigQuery APIs URL. By default the API URL is `bigquery.googleapis.com` you can modify this if you have custom implementation of 
$$

$$section
### Credentials $(id="credentials")

GCS Credentials
<!-- credentials to be updated -->
$$

$$section
### Gcs Config $(id="gcsConfig")

Pass the path of file containing the GCP service account keys. You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.
$$

$$section
### Project Id $(id="projectId")

A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the "project_id" key in the service account key file.
$$

$$section
### Project Id $(id="projectId")

A project ID is a unique string used to differentiate your project from all others in Google Cloud. To fetch this key, look for the value associated with the "project_id" key in the service account key file.
$$

$$section
### Private Key Id $(id="privateKeyId")

This is a unique identifier for the private key associated with the service account. To fetch this key, look for the value associated with the "private_key_id" key in the service account file.
$$

$$section
### Private Key $(id="privateKey")

This is the private key associated with the service account that is used to authenticate and authorize access to BigQuery. To fetch this key, look for the value associated with the "private_key" key in the service account file.
$$

$$section
### Client Email $(id="clientEmail")

This is the email address associated with the service account. To fetch this key, look for the value associated with the "client_email" key in the service account key file.
$$

$$section
### Client Id $(id="clientId")

This is a unique identifier for the service account. To fetch this key, look for the value associated with the "client_id" key in the service account key  file.
$$

$$section
### Auth Uri $(id="authUri")

This is the URI for the authorization server. To fetch this key, look for the value associated with the "auth_uri" key in the service account key file.
$$

$$section
### Token Uri $(id="tokenUri")

The Google Cloud Token URI is a specific endpoint used to obtain an OAuth 2.0 access token from the Google Cloud IAM service. This token allows you to authenticate and access various Google Cloud resources and APIs that require authorization.

To fetch this key, look for the value associated with the "token_uri" key in the service account credentials file.
$$

$$section
### Auth Provider X509Cert Url $(id="authProviderX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the authorization server. To fetch this key, look for the value associated with the "auth_provider_x509_cert_url" key in the service account key file.
$$

$$section
### Client X509Cert Url $(id="clientX509CertUrl")

This is the URL of the certificate that verifies the authenticity of the service account. To fetch this key, look for the value associated with the "client_x509_cert_url" key in the service account key  file.
$$

$$section
### Gcs Config $(id="gcsConfig")

Pass the path of file containing the GCP service account keys. You can checkout [this](https://cloud.google.com/iam/docs/keys-create-delete#iam-service-account-keys-create-console) documentation on how to create the service account keys and download it.
$$

$$section
### Partition Query Duration $(id="partitionQueryDuration")

Duration for partitioning BigQuery tables.
<!-- partitionQueryDuration to be updated -->
$$

$$section
### Partition Query $(id="partitionQuery")

Partitioning query for BigQuery tables.
<!-- partitionQuery to be updated -->
$$

$$section
### Partition Field $(id="partitionField")

Column name on which the BigQuery table will be partitioned.
<!-- partitionField to be updated -->
$$

$$section
### Taxonomy Project ID $(id="taxonomyProjectID")

Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the id of project in which the taxonomy was created.
$$

$$section
### Taxonomy Location $(id="taxonomyLocation")

Bigquery uses taxonomies to create hierarchical groups of policy tags. To apply access controls to BigQuery columns, tag the columns with policy tags. Learn more about how yo can create policy tags and set up column-level access control [here](https://cloud.google.com/bigquery/docs/column-level-security)

If you have attached policy tags to the columns of table available in Bigquery, then OpenMetadata will fetch those tags and attach it to the respective columns.

In this field you need to specify the location/region in which the taxonomy was created.
$$

$$section
### Usage Location $(id="usageLocation")

Location used to query INFORMATION_SCHEMA.JOBS_BY_PROJECT to fetch usage data. You can pass multi-regions, such as `us` or `eu`, or you specific region. Australia and Asia multi-regions are not yet in GA.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
<!-- connectionOptions to be updated -->
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
<!-- connectionArguments to be updated -->
$$
