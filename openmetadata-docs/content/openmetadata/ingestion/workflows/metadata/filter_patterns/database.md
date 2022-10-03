---
title: Database Filter Patterns
slug: /openmetadata/ingestion/workflows/metadata/filter-patterns/database
---

# Database Filter Patterns


## Configuring Filters via UI

One can configure the metadata ingestion filter from UI while adding the ingestion pipline. 
There are four configuration fields available in "Add Metadata Ingestion" page, in this documentation 
we will learn about each field in detail.

<Image
  src="/images/openmetadata/ingestion/workflows/metadata/filter-patterns/database-filter-patterns.png"
  alt="Database Filter Pattern Fields"
  caption="Database Filter Pattern Fields"
/>

### Use FQN For Filtering

This flag set when you want to apply the filter on fully qualified name (e.g service_name.db_name.schema_name.table_name) 
instead of applying the filter to raw name of entity (e.g table_name). This Flag is useful in scenario when you have schema 
with same name in different databases or table with same name in different schemas and you want to filter out one of them. This will be exaplined further in detail in this document.


### Database Filter Pattern

Database filter patterns to control whether or not to include database as part of metadata ingestion.
  - **Include**: Explicitly include databases by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.
  - **Exclude**: Explicitly exclude databases by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.

<Image
  src="/images/openmetadata/ingestion/workflows/metadata/filter-patterns/database-filter-pattern.png"
  alt="Database Filter Pattern"
  caption="Database Filter Pattern"
/>

#### Example 1

```yaml
Snowflake_Prod # Snowflake Service Name 
│   
└─── SNOWFLAKE # DB NAME 
│   
└─── SNOWFLAKE_SAMPLE_DATA # DB NAME 
│   
└─── TEST_SNOWFLAKEDB # DB NAME 
│   
└─── DUMMY_DB # DB NAME 
```

Let's say we want to ingest metadata from a snowflake instance which contains the databases as described above. 
In this example we want to ingest all databases which contains `SNOWFLAKE` in name, then the fillter pattern 
appied would be `SNOWFLAKE` in the include field. This will result in ingestion of database `SNOWFLAKE`, `SNOWFLAKE_SAMPLE_DATA` 
and `TEST_SNOWFLAKEDB`.

<Image
  src="/images/openmetadata/ingestion/workflows/metadata/filter-patterns/database-filter-example-1.png"
  alt="Database Filter Pattern Example 1"
  caption="Database Filter Pattern Example 1"
/>


#### Example 2