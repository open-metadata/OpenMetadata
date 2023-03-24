## Requirements

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