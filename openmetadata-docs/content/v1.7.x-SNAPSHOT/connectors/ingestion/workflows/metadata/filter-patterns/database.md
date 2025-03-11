---
title: Database Filter Patterns
slug: /connectors/ingestion/workflows/metadata/filter-patterns/database
---

# Database Filter Patterns


## Configuring Filters

One can configure the metadata ingestion filter for database source using four configuration fields which are `Database Filter Pattern`,
`Schema Filter Pattern`, `Table Filter Pattern` & `Use FQN For Filtering`. In this document  we will learn about each field in detail
along with many examples.

{% note %}

In OpenMetadata v1.5.x, when both include and exclude filters are applied, the system first processes the include filter, followed by the exclude filter.

{% /note %}

### Configuring Filters via UI

Filters can be configured in UI while adding an ingestion pipeline through `Add Metadata Ingestion` page.

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/database-filter-patterns.webp"
  alt="Database Filter Pattern Fields"
  caption="Database Filter Pattern Fields"
 /%}



### Configuring Filters via CLI

Filters can be configured in CLI in connection configuration within `source.sourceConfig.config` field as described below.

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: false
    databaseFilterPattern:
      includes:
        - database1
        - database2
      excludes:
        - database3
        - database4
    schemaFilterPattern:
      includes:
        - schema1
        - schema2
      excludes:
        - schema3
        - schema4
    tableFilterPattern:
      includes:
        - table1
        - table2
      excludes:
        - table3
        - table4
```



### Use FQN For Filtering

This flag set when you want to apply the filter on fully qualified name (e.g service_name.db_name.schema_name.table_name) 
instead of applying the filter to raw name of entity (e.g table_name). This Flag is useful in scenario when you have schema 
with same name in different databases or table with same name in different schemas and you want to filter out one of them. This will be explained  further in detail in this document.


### Database Filter Pattern

Database filter patterns to control whether or not to include database as part of metadata ingestion.
  - **Include**: Explicitly include databases by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.
  - **Exclude**: Explicitly exclude databases by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.

#### Example 1

```yaml
Snowflake_Prod # Snowflake Service Name 
│   
└─── SNOWFLAKE # DB Name 
│   
└─── SNOWFLAKE_SAMPLE_DATA # DB Name 
│   
└─── TEST_SNOWFLAKEDB # DB Name 
│   
└─── DUMMY_DB # DB Name 
│   
└─── ECOMMERCE # DB Name 
```

Let's say we want to ingest metadata from a snowflake instance which contains multiple databases as described above. 
In this example we want to ingest all databases which contains `SNOWFLAKE` in name, then the filter  pattern 
applied would be `.*SNOWFLAKE.*` in the include field. This will result in ingestion of database `SNOWFLAKE`, `SNOWFLAKE_SAMPLE_DATA` 
and `TEST_SNOWFLAKEDB`.

### Configuring Filters via UI for Example 1

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/database-filter-example-1.webp"
  alt="Database Filter Pattern Example 1"
  caption="Database Filter Pattern Example 1"
 /%}



### Configuring Filters via CLI for Example 1

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: false
    databaseFilterPattern:
      includes:
        - .*SNOWFLAKE.*

```


#### Example 2

In this example we want to ingest all databases which starts with `SNOWFLAKE` in name, then the filter  pattern 
applied would be `^SNOWFLAKE.*` in the include field. This will result in ingestion of database `SNOWFLAKE` & `SNOWFLAKE_SAMPLE_DATA`.

### Configuring Filters via UI for Example 2

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/database-filter-example-2.webp"
  alt="Database Filter Pattern Example 2"
  caption="Database Filter Pattern Example 2"
 /%}


### Configuring Filters via CLI for Example 2

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: false
    databaseFilterPattern:
      includes:
        - ^SNOWFLAKE.*

```


#### Example 3

In this example we want to ingest all databases for which the name starts with `SNOWFLAKE` OR ends with `DB` , then the filter  pattern 
applied would be `^SNOWFLAKE` & `DB$` in the include field. This will result in ingestion of database `SNOWFLAKE`, `SNOWFLAKE_SAMPLE_DATA`, `TEST_SNOWFLAKEDB` & `DUMMY_DB`.

### Configuring Filters via UI for Example 3

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/database-filter-example-3.webp"
  alt="Database Filter Pattern Example 3"
  caption="Database Filter Pattern Example 3"
 /%}


### Configuring Filters via CLI for Example 3

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: false
    databaseFilterPattern:
      includes:
        - ^SNOWFLAKE.*
        - .*DB$

```


#### Example 4

In this example we want to ingest only the `SNOWFLAKE` database then the filter  pattern applied would be `^SNOWFLAKE$`.

### Configuring Filters via UI for Example 4

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/database-filter-example-4.webp"
  alt="Database Filter Pattern Example 4"
  caption="Database Filter Pattern Example 4"
 /%}



### Configuring Filters via CLI for Example 4

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: false
    databaseFilterPattern:
      includes:
        - ^SNOWFLAKE$
```


### Schema Filter Pattern

Schema filter patterns are used to control whether or not to include schemas as part of metadata ingestion.
  - **Include**: Explicitly include schemas by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.
  - **Exclude**: Explicitly exclude schemas by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.
  
#### Example 1

```yaml
Snowflake_Prod # Snowflake Service Name 
│   
└─── SNOWFLAKE # DB Name 
│   │
│   └─── PUBLIC # Schema Name 
│   │
│   └─── TPCH_SF1 # Schema Name 
│   │
│   └─── INFORMATION_SCHEMA # Schema Name 
│
└─── SNOWFLAKE_SAMPLE_DATA # DB Name 
│   │
│   └─── PUBLIC # Schema Name 
│   │
│   └─── INFORMATION_SCHEMA # Schema Name 
│   │
│   └─── TPCH_SF1 # Schema Name 
│   │
│   └─── TPCH_SF10 # Schema Name 
│   │
│   └─── TPCH_SF100 # Schema Name 
```

In this example we want to ingest all schema within any database with name `PUBLIC`, then the schema filter  pattern 
applied would be `^PUBLIC$` in the include field. This will result in ingestion of schemas `SNOWFLAKE.PUBLIC` & `SNOWFLAKE_SAMPLE_DATA.PUBLIC` 


### Configuring Filters via UI for Example 1

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/schema-filter-example-1.webp"
  alt="Schema Filter Pattern Example 1"
  caption="Schema Filter Pattern Example 1"
 /%}

### Configuring Filters via CLI for Example 1

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: false
    schemaFilterPattern:
      includes:
        - ^PUBLIC$
```



#### Example 2


In this example we want to ingest all schema within any database except schema with name `PUBLIC` available in `SNOWFLAKE_SAMPLE_DATA`. 
Notice that we have two schemas available with name `PUBLIC` one is available in database `SNOWFLAKE_SAMPLE_DATA.PUBLIC` and other is `SNOWFLAKE.PUBLIC`. As per the constraint of this example all the schemas including `SNOWFLAKE.PUBLIC` but we need to skip `SNOWFLAKE_SAMPLE_DATA.PUBLIC`. to do that we will need to set `useFqnForFiltering` flag to true by doing this the filter pattern will be applied to fully qualified name instead of raw table name. A fully qualified name(FQN) of schema is combination of service name, database name & schema name joined with `.`. In this example fully qualified name of the `SNOWFLAKE_SAMPLE_DATA.PUBLIC` schema will be `Snowflake_Prod.SNOWFLAKE_SAMPLE_DATA.PUBLIC`, so we will need to apply a exclude filter pattern `^Snowflake_Prod\.SNOWFLAKE_SAMPLE_DATA\.PUBLIC$` and set `useFqnForFiltering` to true.



### Configuring Filters via UI for Example 2

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/schema-filter-example-2.webp"
  alt="Schema Filter Pattern Example 2"
  caption="Schema Filter Pattern Example 2"
 /%}



### Configuring Filters via CLI for Example 2

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: true
    schemaFilterPattern:
      excludes:
        - ^Snowflake_Prod\.SNOWFLAKE_SAMPLE_DATA\.PUBLIC$
```


#### Example 3

In this example we want to ingest `SNOWFLAKE.PUBLIC` & all the schemas in `SNOWFLAKE_SAMPLE_DATA` that starts with `TPCH_` i.e `SNOWFLAKE_SAMPLE_DATA.TPCH_1`, `SNOWFLAKE_SAMPLE_DATA.TPCH_10` & `SNOWFLAKE_SAMPLE_DATA.TPCH_100`. To achieve this an include schema filter will be applied with pattern `^Snowflake_Prod\.SNOWFLAKE\.PUBLIC$` & `^Snowflake_Prod\.SNOWFLAKE_SAMPLE_DATA\.TPCH_.*`, we need to set `useFqnForFiltering` as true as we want to apply filter on FQN.


### Configuring Filters via UI for Example 3

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/schema-filter-example-3.webp"
  alt="Schema Filter Pattern Example 3"
  caption="Schema Filter Pattern Example 3"
 /%}




### Configuring Filters via CLI for Example 3

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: true
    schemaFilterPattern:
      includes:
        - ^Snowflake_Prod\.SNOWFLAKE\.PUBLIC$
        - ^Snowflake_Prod\.SNOWFLAKE_SAMPLE_DATA\.TPCH_.*
```



### Table Filter Pattern

Table filter patterns are used to control whether or not to include tables as part of metadata ingestion.
  - **Include**: Explicitly include tables by adding a list of comma-separated regular expressions to the Include field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded.
  - **Exclude**: Explicitly exclude tables by adding a list of comma-separated regular expressions to the Exclude field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included.


#### Example 1

```yaml
Snowflake_Prod # Snowflake Service Name 
│
└─── SNOWFLAKE_SAMPLE_DATA # DB Name 
│   │
│   └─── PUBLIC # Schema Name 
│   │   │
│   │   └─── CUSTOMER # Table Name 
│   │   │
│   │   └─── CUSTOMER_ADDRESS # Table Name 
│   │   │
│   │   └─── CUSTOMER_DEMOGRAPHICS # Table Name 
│   │   │
│   │   └─── CALL_CENTER # Table Name 
│   │
│   └─── INFORMATION # Schema Name
│       │
│       └─── ORDERS # Table Name 
│       │
│       └─── REGION # Table Name 
│       │
│       └─── CUSTOMER # Table Name 
│
└─── SNOWFLAKE # DB Name 
    │
    └─── PUBLIC # Schema Name 
        │
        └─── CUSTOMER # Table Name 
```

#### Example 1

In this example we want to ingest table with name `CUSTOMER` within any schema and database. In this case we need to apply include table filter pattern `^CUSTOMER$`. This will result in ingestion of tables `Snowflake_Prod.SNOWFLAKE_SAMPLE_DATA.PUBLIC.CUSTOMER`, `Snowflake_Prod.SNOWFLAKE_SAMPLE_DATA.INFORMATION.CUSTOMER` & `Snowflake_Prod.SNOWFLAKE.PUBLIC.CUSTOMER`

### Configuring Filters via UI for Example 1

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/table-filter-example-1.webp"
  alt="Table Filter Pattern Example 1"
  caption="Table Filter Pattern Example 1"
 /%}



### Configuring Filters via CLI for Example 1

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: true
    tableFilterPattern:
      includes:
        - ^CUSTOMER$
```


#### Example 2

In this example we want to ingest table with name `CUSTOMER` within `PUBLIC` schema of any database. In this case we need to apply include table filter pattern `.*\.PUBLIC\.CUSTOMER$` this will also require to set the `useFqnForFiltering` flag as true as we want to apply filter on FQN. This will result in ingestion of tables `Snowflake_Prod.SNOWFLAKE_SAMPLE_DATA.PUBLIC.CUSTOMER` & `Snowflake_Prod.SNOWFLAKE.PUBLIC.CUSTOMER`

### Configuring Filters via UI for Example 2

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/table-filter-example-2.webp"
  alt="Table Filter Pattern Example 2"
  caption="Table Filter Pattern Example 2"
 /%}



### Configuring Filters via CLI for Example 2

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: true
    tableFilterPattern:
      includes:
        - .*\.PUBLIC\.CUSTOMER$
```


#### Example 3

In this example, we aim to ingest a table named `_delta_log/file.json` within the `session` schema of any database. To achieve this, we need to configure the following filter patterns:
- Include Table Filter Pattern: `.*_delta_log/file\.json$`
- Schema Filter Pattern: `session`

{% note %}

The backslash `\` is used as an escape character for the dot (.) in the pattern

{% /note %}

### Configuring Filters via UI for Example 3

{% image
  src="/images/v1.7/features/ingestion/workflows/metadata/filter-patterns/table-filter-example-3.webp"
  alt="Table Filter Pattern Example 3"
  caption="Table Filter Pattern Example 3"
 /%}



### Configuring Filters via CLI for Example 3

```yaml
sourceConfig:
  config:
    ...
    useFqnForFiltering: true
    tableFilterPattern:
      includes:
        - session
            tableFilterPattern:
      includes:
        - "*_delta_log/file\.json$"
```
