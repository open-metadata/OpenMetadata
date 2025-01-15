---
title: Connection Details
slug: /connectors/database/adls-datalake/connections
---

#### Connection Details for Azure

- **Azure Credentials**

  - **Client ID** : Client ID of the data storage account
  - **Client Secret** : Client Secret of the account
  - **Tenant ID** : Tenant ID under which the data storage account falls
  - **Account Name** : Account Name of the data Storage

- **Required Roles**

  Please make sure the following roles associated with the data storage account.
   - `Storage Blob Data Contributor`
   - `Storage Queue Data Contributor`

The current approach for authentication is based on `app registration`, reach out to us on [slack](https://slack.open-metadata.org/) if you find the need for another auth system

{% partial file="/v1.6/connectors/database/advanced-configuration.md" /%}