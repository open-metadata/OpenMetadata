---
title: Ingest Owner from DBT
slug: /openmetadata/ingestion/workflows/metadata/dbt/ingest-dbt-owner
---

# Ingest Owner from DBT

Ingest the model/table owner information from DBT `catalog.json` file into openmetadata tables.

The owner from `catalog.json` file can be a user or a team in OpenMetadata.

## Requirements

### 1. Owner information in catalog.json file
Openmetadata fetches the owner information from the `catalog.json` file. Below is a sample `catalog.json` file node containing owner information under `node_name->metadata->owner`.

```json
"model.jaffle_shop.customers": {
      "metadata": {
        "type": "BASE TABLE",
        "schema": "dbt_jaffle",
        "name": "customers",
        "database": "dev",
        "comment": null,
        "owner": "openmetadata"
      },
}
```

### 2. Adding the User or Team to OpenMetadata
The user or team which will be set as the entity owner should be first created in OpenMetadata.

While linking the owner from `catalog.json` file to the entity, OpenMetadata first searches for the user if it is present. If the user is not present it searches for the team 

#### Following steps shows adding a User to OpenMetadata:
1. Click on the `Users` section from homepage
<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/click-users-page.png" alt="click-users-page" caption="Click Users page"/>

2. Click on the `Add User` button
<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/click-add-user.png" alt="click-add-user" caption="Click Add User"/>

3. Enter the details as shown for the user

<Note>

If the owner's name in `catalog.json` file is `openmetadata`, you need to enter `openmetadata@youremail.com` in the email id section of add user form as shown below.

</Note>

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/add-user-dbt.png" alt="add-user-dbt" caption="Add User"/>

#### Following steps shows adding a Team to OpenMetadata:
1. Click on the `Teams` section from homepage
<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/click-teams-page.png" alt="click-teams-page" caption="Click Teams page"/>

2. Click on the `Add Team` button
<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/click-add-team.png" alt="click-add-team" caption="Click Add Team"/>

3. Enter the details as shown for the team

<Note>

If the owner's name in `catalog.json` file is `openmetadata`, you need to enter `openmetadata` in the name section of add team form as shown below.

</Note>

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/add-team-dbt.png" alt="add-team-dbt" caption="Add Team"/>

## Linking the Owner to the table

After runing the ingestion workflow with DBT you can see the created user or team getting linked to the table as it's owner as it was specified in the `catalog.json` file.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/linked-user.png" alt="linked-user" caption="Linked User"/>

<Note>

If a table already has a owner linked to it, owner from the DBT will not update the current owner.

</Note>