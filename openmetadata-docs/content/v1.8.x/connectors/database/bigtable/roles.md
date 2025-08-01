---
title: BigTable Roles | Configure Access for OpenMetadata Connector
description: Configure BigTable database roles and permissions in OpenMetadata connectors. Learn essential access control setup for seamless data cataloging and meta...
slug: /connectors/database/bigtable/roles
---

# Create custom role in GCP


This documentation will guide you on how to create a custom role in GCP with the necessary permissions to ingest BigTable in OpenMetadata.


## Step 1: Navigate to Roles

Search for `Roles` in your GCP console and select the first result under `IAM & Roles` section.

{% image
src="/images/v1.8/connectors/bigtable/create-role-1.png"
alt="Navigate to Roles"
caption="Navigate to Roles" /%}


## Step 2: Create Role & Add Permissions

Below the search bar you should see a `Create Role` button click on that & navigate to create role page.


{% image
src="/images/v1.8/connectors/bigtable/create-role-2.png"
alt="Create Role Button"
caption="Create Role" /%}



Once You are on the create role page, you can edit the description & title of the role and finally you can click on add permissions to grant permissions to role.

{% image
src="/images/v1.8/connectors/bigtable/create-role-3.png"
alt="Create Role"
caption="Create Role" /%}


You can search for the required permissions in the filter box and add them accordingly. To ingest metadata from BigTable you need to grant the following permissions to the user.

| #    | GCP Permission                | Required For            |
| :--- | :---------------------------- | :---------------------- |
| 1    | bigtable.instances.get        | Metadata Ingestion      |
| 2    | bigtable.instances.list       | Metadata Ingestion      |
| 3    | bigtable.tables.get           | Metadata Ingestion      |
| 4    | bigtable.tables.list          | Metadata Ingestion      |
| 5    | bigtable.tables.readRows      | Metadata Ingestion      |

{% image
src="/images/v1.8/connectors/bigtable/create-role-4.png"
alt="Add Permissions"
caption="Add Permissions" /%}

Once you have added all the required permissions, you can create the role by clicking on the create button.


## Step 3: Assign Role to Service Account

To assign the created role, you can navigate to `IAM` and click on `Grant Access` and you can search your service account in the `Add Principals` section & Assign the created role to the service account.

{% image
src="/images/v1.8/connectors/bigtable/create-role-5.png"
alt="Add Permissions"
caption="Add Permissions" /%}
