---
title: Bulk Export Data Assets via CSV in `brandName`
description: Learn to bulk export database services, databases, schemas, and tables in OpenMetadataas CSV files using the UI or API.
slug: /how-to-guides/data-discovery/export
---

# Export Data Asset

Exporting a Data Asset is simple. Below are the steps to bulk export various data assets, such as Database Services, Databases, Schemas, and Tables.

## How to Bulk Export a Database Service

1. Navigate to the Database Service you want to export by going to **Settings > Services > Database**.
2. For this example, we are exporting in the `Snowflake` service.
3. Click on the **⋮** icon and select **Export** to download the Database Service CSV file.

{% image
src="/images/v1.8/how-to-guides/discovery/export1.png"
alt="Export Database Service CSV File"
caption="Export Database Service CSV File"
/%}

{% note %}
You can also export the Database Service using the API with the following endpoint:

`/api/v1/services/databaseServices/name/{name}/export`
Make sure to replace `{name}` with the Fully Qualified Name (FQN) of the Database Service.
{% /note %}

## How to Bulk Export a Database

1. In this example, we are exporting in the `DEMO` database under **Snowflake**.
2. Click on the **⋮** icon and select **Export** to download the Database CSV file.

{% image
src="/images/v1.8/how-to-guides/discovery/export2.png"
alt="Export Database CSV File"
caption="Export Database CSV File"
/%}

{% note %}
You can also export the Database using the API with the following endpoint:

`/api/v1/databases/name/{name}/export`
Make sure to replace `{name}` with the Fully Qualified Name (FQN) of the Database.
{% /note %}

## How to Bulk Export a Database Schema

1. In this example, we are exporting in the `JAFFLE_SHOP` schema under **Snowflake > DEMO**.
2. Click on the **⋮** icon and select **Export** to download the Database Schema CSV file.

{% image
src="/images/v1.8/how-to-guides/discovery/export3.png"
alt="Export Database Schema CSV File"
caption="Export Database Schema CSV File"
/%}

{% note %}
You can also export the Database Schema using the API with the following endpoint:

`/api/v1/databaseSchemas/name/{name}/export`
Make sure to replace `{name}` with the Fully Qualified Name (FQN) of the Database Schema.
{% /note %}


## How to Bulk Export a Tables

1. In this example, we are exporting in the `CUSTOMERS` table under **Snowflake > DEMO > JAFFLE_SHOP**.
2. Click on the **⋮** icon and select **Export** to download the Table CSV file.

{% image
src="/images/v1.8/how-to-guides/discovery/export4.png"
alt="Export Table CSV File"
caption="Export Table CSV File"
/%}

{% note %}
You can also export the Tables using the API with the following endpoint:

`/api/v1/tables/name/{name}/export`
Make sure to replace `{name}` with the Fully Qualified Name (FQN) of the Table.
{% /note %}


{%inlineCallout
  color="violet-70"
  bold="Data Asset Import"
  icon="MdArrowBack"
  href="/how-to-guides/data-discovery/import"%}
  Quickly import a data assets as a CSV file.
{%/inlineCallout%}
