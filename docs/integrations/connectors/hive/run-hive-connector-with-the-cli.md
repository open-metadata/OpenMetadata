---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run Hive Connector with the CLI

Configure and schedule Hive **metadata** and **profiler** workflows using your own Airflow instances.

* [Requirements](run-hive-connector-with-the-cli.md#requirements)
* [Metadata Ingestion](run-hive-connector-with-the-cli.md#metadata-ingestion)
* [Data Profiler and Quality Tests](run-hive-connector-with-the-cli.md#data-profiler-and-quality-tests)
* [DBT Integration](run-hive-connector-with-the-cli.md#dbt-integration)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

### Python requirements

To run the Hive ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[hive]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json) you can find the structure to create a connection to Hive.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).



### 1. Define the JSON Config

This is a sample config for Hive:

{% code title="hive.json" %}
```json
{
  "source": {
    "type": "hive",
    "serviceName": "local_hive",
    "serviceConnection": {
      "config": {
        "type":"Hive",
        "username":"<username>",
        "password":"<password>",
        "database":"<database>",
        "authOptions":"<auth optios>",
        "hostPort": "<hive connection host & port>"
      }
    },
    "sourceConfig": {
      "config": {
          "enableDataProfiler": true or false,
          "markDeletedTables": true or false,
          "includeTables": true or false,
          "includeViews": true or false,
          "generateSampleData": true or false,
          "sampleDataQuery": "<query to fetch table data>",
          "schemaFilterPattern": "<schema name regex list>",
          "tableFilterPattern": "<table name regex list>",
          "dbtConfigSource": "<configs for gcs, s3, local or file server to get the DBT files"
        }
      }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "workflowConfig": {
    "openMetadataServerConfig": {
      "hostPort": "<OpenMetadata host and port>",
      "authProvider": "<OpenMetadata auth provider>"
    }
  }
}

```
{% endcode %}

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/hiveConnection.json).

* **username** (Optional): Enter the username of your Snowflake user in the _Username_ field. The specified user should be authorized to read all databases you want to include in the metadata ingestion workflow.
* **password** (Optional): Enter the password for your Snowflake user in the _Password_ field.
* **hostPort**: Enter the fully qualified hostname and port number for your Hive deployment in the _Host and Port_ field.
* **authOptions** (Optional): Enter the auth options string for hive connection.
* **database**: If you want to limit metadata ingestion to a single database, enter the name of this database in the Database field. If no value is entered for this field, the connector will ingest metadata from all databases that the specified user is authorized to read.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to Snowflake during the connection. These details must be added as Key-Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to Snowflake during the connection. These details must be added as Key-Value pairs.

To specify LDAP Auth, use the following `connectionArguments`:

```
"connectionArguments": {
"auth": "LDAP"
}
```

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceMetadataPipeline.json).

* **enableDataProfiler**: **** `true` or `false`, to run the profiler (not the tests) during the metadata ingestion.
* **markDeletedTables**: To flag tables as soft-deleted if they are not present anymore in the source system.
* **includeTables**: `true` or `false`, to ingest table data. Default is true.
* **includeViews**: `true` or `false`, to ingest views definitions.
* **generateSampleData**: To ingest sample data based on `sampleDataQuery`.
* **sampleDataQuery**: Defaults to `select * from {}.{} limit 50`.
* **schemaFilterPattern** and **tableFilternPattern**: Note that the `schemaFilterPattern` and `tableFilterPattern` both support regex as `include` or `exclude`. E.g.,

```
"tableFilterPattern": {
  "includes": ["users", "type_test"]
}
```

#### Sink Configuration

To send the metadata to OpenMetadata, it needs to be specified as `"type": "metadata-rest"`.

#### Workflow Configuration

The main property here is the `openMetadataServerConfig`, where you can define the host and security provider of your OpenMetadata installation.

For a simple, local installation using our docker containers, this looks like:

```
"workflowConfig": {
  "openMetadataServerConfig": {
    "hostPort": "http://localhost:8585/api",
    "authProvider": "no-auth"
  }
}
```

#### OpenMetadata Security Providers

We support different security providers. You can find their definitions [here](https://github.com/open-metadata/OpenMetadata/tree/main/catalog-rest-service/src/main/resources/json/schema/security/client). An example of an Auth0 configuration would be the following:

```
"workflowConfig": {
    "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "auth0",
        "securityConfig": {
            "clientId": "<client ID>",
            "secretKey": "<secret key>",
            "domain": "<domain>"
        }
    }
}
```

### 2. Run with the CLI

First, we will need to save the JSON file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-json>
```

Note that from connector to connector, this recipe will always be the same. By updating the JSON configuration, you will be able to extract metadata from different sources.

## Data Profiler and Quality Tests

The Data Profiler workflow will be using the `orm-profiler` processor. While the `serviceConnection` will still be the same to reach the source system, the `sourceConfig` will be updated from previous configurations.

### 1. Define the JSON configuration

This is a sample config for a Snowflake profiler:

```json
{
    "source": {
        "type": "snowflake",
        "serviceName": "<service name>",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "hostPort": "<hostPort>",
                "username": "<username>",
                "password": "<password>",
                "database": "<database>",
                "warehouse": "<warehouse>",
                "account": "<acount>",
                "privateKey": "<privateKey>",
                "snowflakePrivatekeyPassphrase": "<passphrase>",
                "scheme": "<scheme>",
                "role": "<role>"
            }
        },
        "sourceConfig": {
            "config": {
                "type": "Profiler",
                "fqnFilterPattern": "<table FQN filtering regex>"
            }
        }
    },
    "processor": {
        "type": "orm-profiler",
        "config": {}
    },
    "sink": {
        "type": "metadata-rest",
        "config": {}
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "<OpenMetadata host and port>",
            "authProvider": "<OpenMetadata auth provider>"
        }
    }
}
```

#### Source Configuration

* You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/snowflakeConnection.json).
* The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json). If you don't need to add any `fqnFilterPattern`, the `"type": "Profiler"` is still required to be present.

Note that the `fqnFilterPattern`  supports regex as `include` or `exclude`. E.g.,

```
"fqnFilterPattern": {
  "includes": ["service.database.schema.*"]
}
```

#### Processor

To choose the `orm-profiler`. It can also be updated to define tests from the JSON itself instead of the UI:

```json
 "processor": {
    "type": "orm-profiler",
    "config": {
        "test_suite": {
            "name": "<Test Suite name>",
            "tests": [
                {
                    "table": "<Table FQN>",
                    "table_tests": [
                        {
                            "testCase": {
                                "config": {
                                    "value": 100
                                },
                                "tableTestType": "tableRowCountToEqual"
                            }
                        }
                    ],
                    "column_tests": [
                        {
                            "columnName": "<Column Name>",
                            "testCase": {
                                "config": {
                                    "minValue": 0,
                                    "maxValue": 99
                                },
                                "columnTestType": "columnValuesToBeBetween"
                            }
                        }
                    ]
                }
            ]
        }
     }
  },
```

`tests` is a list of test definitions that will be applied to `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](../../../../data-quality/data-quality-overview/tests.md).

#### Workflow Configuration

The same as the [metadata](run-hive-connector-with-the-cli.md#workflow-configuration) ingestion.

### 2. Run with the CLI

Again, we will start by saving the JSON file.

Then, we can run the workflow as:

```
metadata profile -c <path-to-json>
```

Note how instead of running `ingest`, we are using the `profile` command to select the `Profiler` workflow.

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](../../../data-lineage/dbt-integration.md).
