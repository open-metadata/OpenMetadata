---
title: Ingest Owner from DBT
slug: /openmetadata/ingestion/workflows/metadata/dbt/ingest-dbt-owner
---

# Ingest Owner from DBT

Ingest the model/table owner information from DBT `catalog.json` file into openmetadata tables.

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

### 2. Adding the user to OpenMetadata
The user which will be set as the entity owner should be created in OpenMetadata.

Following steps shows adding a user to OpenMetadata:
1. Click on the `Users` section from homepage
<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/click-users-page.png" alt="click-users-page" caption="Click Users page"/>

2. Click on the `Add Users` button
<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/click-add-user.png" alt="click-add-user" caption="Click Add Users"/>

3. Enter the details as shown for the user

<Note>

If the owner's name in `catalog.json` file is `openmetadata`, you need to enter `openmetadata@youremail.com` in the email id section of add users form as shown below.

</Note>

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/add-user-dbt.png" alt="add-user-dbt" caption="Add User"/>


## Linking the Owner to the table

After ruuning the ingestion workflow with DBT you can see the created user getting linked to the table as it's owner as it was specified in the `catalog.json` file.

<Image src="/images/openmetadata/ingestion/workflows/metadata/ingest_dbt_owner/linked-user.png" alt="linked-user" caption="Linked User"/>

<Note>

If a table already has a owner linked to it, owner from the DBT will not update the current owner.

</Note>