---
title: BigQuery
slug: /connectors/database/bigquery/roles
---

# Create custom role in GCP

This documentation will guide you on how to create a custom role in GCP with the necessary permissions to ingest BigQuery in OpenMetadata.


## Step 1: Navigate to Roles

Search for `Roles` in your GCP console and select the first result under `IAM & Roles` section.


<Image
src="/images/openmetadata/connectors/bigquery/create-role-1.png"
alt="Navigate to Roles"
caption="Navigate to Roles"
/>


## Step 2: Create Role & Add Permissions

Below the search bar you should see a `Create Role` button click on that & navigate to create role page.


<Image
src="/images/openmetadata/connectors/bigquery/create-role-2.png"
alt="Create Role Button"
caption="Create Role"
/>


Once You are on the create role page, you can edit the description & title of the role and finally you can click on add permissions to grant permissions to role.

<Image
src="/images/openmetadata/connectors/bigquery/create-role-3.png"
alt="Create Role"
caption="Create Role"
/>

You can search for the required permissions in the filter box and add them accordingly. To ingest metadata from BigQuery you need to grant the following permissions to the user.


<Table>

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

</Table>

<Image
src="/images/openmetadata/connectors/bigquery/create-role-4.png"
alt="Add Permissions"
caption="Add Permissions"
/>

Once you have added all the required permissions, you can create the role by clicking on the create button. 

<Image
src="/images/openmetadata/connectors/bigquery/create-role-5.png"
alt="Add Permissions"
caption="Add Permissions"
/>

## Step 3: Assign Role to Service Account

To assign the created role, you can navigate to `IAM` and click on `Grant Access` and you can search your service account in the `Add Principals` section & Assign the created role to the service account.


<Image
src="/images/openmetadata/connectors/bigquery/create-role-6.png"
alt="Add Permissions"
caption="Add Permissions"
/>