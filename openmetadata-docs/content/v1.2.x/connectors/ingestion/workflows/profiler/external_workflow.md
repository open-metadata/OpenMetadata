---
title: External Profiler Workflow
slug: /connectors/ingestion/workflows/profiler/external-workflow
---

# External Profiler Workflow.

Consider an use case when you have a large database source with multiple databases and multiple schemas which are maintained by different teams within your organization. You have created multiple database services within OpenMetadata depending on your use case by applying various database and schema filters on this sample large database source. Now instead of running a profiler pipeline for each service you want to run profiler for the entire database irrespective of the OpenMetadata service which a table or database or database schema would belong to. This document will guide you on how to achieve it.


The support for running profiler against a database source and not a specific database service is only achievable when you run it externally.

{% partial file="/v1.2/connectors/external-ingestion-deployment.md" /%}


## 1. Define the YAML Config


You will need to prepare a yaml file for data profiler depending on the database source. You can get details of how to define a yaml file for data profiler for each connector [here](https://docs.open-metadata.org/v1.2.x/connectors/database).

For example, consider if the data source was snowflake then the yaml file would have looked like as follows.


```snowflake_external_profiler.yaml
source:
  type: snowflake
  serviceConnection:
    config:
      type: Snowflake
      username: my_username
      password: my_password
      account: snow-account-name
      warehouse: COMPUTE_WH
  sourceConfig:
    config:
      type: Profiler
      generateSampleData: true
      # schemaFilterPattern:
      #   includes:
      #   # - .*mydatabase.*
      #   - .*default.*
      # tableFilterPattern:
      #   includes:
      #   # - ^cloudfront_logs11$
      #   - ^map_table$
      #   # - .*om_glue_test.*
processor:
  type: "orm-profiler"
  config: {}
    # tableConfig:
    # - fullyQualifiedName: local_snowflake.mydatabase.mydschema.mytable
    #   sampleDataCount: 50
    # schemaConfig:
    # - fullyQualifiedName: demo_snowflake.new_database.new_dschema
    #   sampleDataCount: 50
    #   profileSample: 1
    #   profileSampleType: ROWS
    #   sampleDataStorageConfig:
    #     bucketName: awsdatalake-testing
    #     prefix: data/sales/demo1
    #     overwriteData: false
    #     storageConfig:
    #       awsRegion: us-east-2
    # databaseConfig:
    # - fullyQualifiedName: snowflake_prod.prod_db
    #   sampleDataCount: 50
    #   profileSample: 1
    #   profileSampleType: ROWS
    #   sampleDataStorageConfig:
    #     bucketName: awsdatalake-testing
    #     prefix: data/sales/demo1
    #     overwriteData: false
    #     storageConfig:
    #       awsRegion: us-east-2
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: DEBUG
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "your-jwt-token"

```


**Notice that we do not pass the service name in this yaml file, compared to a normal profiler external workflow.**



## 2. Run with the CLI
After saving the YAML config, we will run the command the same way we did for the metadata ingestion:

```
metadata profile -c <path-to-yaml>
```

Note now instead of running ingest, we are using the profile command to select the Profiler workflow.

