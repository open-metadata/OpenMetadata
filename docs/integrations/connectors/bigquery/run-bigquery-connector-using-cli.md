---
description: Use the 'metadata' CLI to run a one-time ingestion
---

# Run BigQuery Connector using CLI

Configure and schedule BigQuery **metadata**, **usage**, and **profiler** workflows using the `metadata` CLI.

* [Requirements](run-bigquery-connector-using-cli.md#requirements)
* [Metadata Ingestion](run-bigquery-connector-using-cli.md#metadata-ingestion)
* [Query Usage and Lineage Ingestion](run-bigquery-connector-using-cli.md#query-usage-and-lineage-ingestion)
* [Data Profiler and Quality Tests](run-bigquery-connector-using-cli.md#data-profiler-and-quality-tests)
* [DBT Integration](run-bigquery-connector-using-cli.md#dbt-integration)

## Requirements

Follow this [guide](https://docs.open-metadata.org/overview/run-openmetadata#procedure) to learn how to install the `metadata` CLI.

In order to execute the workflows, you will need a running OpenMetadata server.

### Python requirements

To run the BigQuery ingestion, you will need to install:

```
pip3 install 'openmetadata-ingestion[bigquery]'
```

## Metadata Ingestion

All connectors are now defined as JSON Schemas. [Here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json) you can find the structure to create a connection to BigQuery.

In order to create and run a Metadata Ingestion workflow, we will follow the steps to create a JSON configuration able to connect to the source, process the Entities if needed, and reach the OpenMetadata server.

The workflow is modeled around the following [JSON Schema](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/workflow.json).

### 1. Define the JSON Config

This is a sample config for BigQuery:

```json
{
    "source": {
        "type": "bigquery",
        "serviceName": "<service name>",
        "serviceConnection": {
            "config": {
                "type": "BigQuery",
                "enablePolicyTagImport": true,
                "credentials": {
                    "gcsConfig": {
                        "type": "<type>",
                        "projectId": "<project ID>",
                        "privateKeyId": "<private key ID>",
                        "privateKey": "<private key>",
                        "clientEmail": "<client email>",
                        "clientId": "<client ID>",
                        "authUri": "<auth URI>",
                        "tokenUri": "<token URI>",
                        "authProviderX509CertUrl": "<auth provider x509 certificate URL>",
                        "clientX509CertUrl": "<client certificate URL>"
                    }
                }
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
                "dbtProvider": "<s3, gcs, gcs-path, local or http>",
                "dbtConfig": "<for the selected provider>",
                "dbtCatalogFileName": "<file name>",
                "dbtManifestFileName": "<file name>"
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

####

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json).

* **hostPort**: This is the BigQuery APIs URL.
* **username** (Optional): Specify the User to connect to BigQuery. It should have enough privileges to read all the metadata.
* **projectId** (Optional): The BigQuery Project ID is required only if the credentials path is being used instead of values.
* **credentials**: We support two ways of authenticating to BigQuery:
  * Passing the raw credential values provided by BigQuery. This requires us to provide the following information, all provided by BigQuery:
    * **type**: Credentials type, e.g. `service_account`.
    * **projectId**
    * **privateKey**
    * **privateKeyId**
    * **clientEmail**
    * **clientId**
    * **authUri**: [https://accounts.google.com/o/oauth2/auth](https://accounts.google.com/o/oauth2/auth) by default
    * **tokenUri**: [https://oauth2.googleapis.com/token](https://oauth2.googleapis.com/token) by default
    * **authProviderX509CertUrl**: [https://www.googleapis.com/oauth2/v1/certs](https://www.googleapis.com/oauth2/v1/certs) by default
    * **clientX509CertUrl**
  * Passing the credentials file path
    * **gcsCredentialsPath**: Path to file

If you prefer to pass the credentials file, you can do so as follows:

```json
"credentials": {
  "gcsConfig": {
    "gcsCredentialsPath": "<path to file>"
  }
}
```

* **enablePolicyTagImport** (Optional): Mark as 'True' to enable importing policy tags from BigQuery to OpenMetadata.
* **tagCategoryName** (Optional): If the Tag import is enabled, the name of the Tag Category will be created at OpenMetadata.
* **database** (Optional): The database of the data source is an optional parameter, if you would like to restrict the metadata reading to a single database. If left blank, OpenMetadata ingestion attempts to scan all the databases.
* **connectionOptions** (Optional): Enter the details for any additional connection options that can be sent to BigQuery during the connection. These details must be added as Key Value pairs.
* **connectionArguments** (Optional): Enter the details for any additional connection arguments such as security or protocol configs that can be sent to BigQuery during the connection. These details must be added as Key Value pairs.

For the Connection Arguments, In case you are using Single-Sign-On (SSO) for authentication, add the `authenticator` details in the Connection Arguments as a Key Value pair as follows.

`"authenticator" : "sso_login_url"`

In case you authenticate with SSO using an external browser popup, then add the `authenticator` details in the Connection Arguments as a Key Value pair as follows.

`"authenticator" : "externalbrowser"`

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

## Query Usage and Lineage Ingestion

To ingest the Query Usage and Lineage information, the `serviceConnection` configuration will remain the same. However, the `sourceConfig` is now modeled after [this](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json) JSON Schema.

### 1. Define the JSON Configuration

This is a sample config for BigQuery Usage:

```json
{
    "source": {
        "type": "bigquery",
        "serviceName": "<service name>",
        "serviceConnection": {
            "config": {
                "type": "BigQuery",
                "enablePolicyTagImport": true,
                "credentials": {
                    "gcsConfig": {
                        "type": "<type>",
                        "projectId": "<project ID>",
                        "privateKeyId": "<private key ID>",
                        "privateKey": "<private key>",
                        "clientEmail": "<client email>",
                        "clientId": "<client ID>",
                        "authUri": "<auth URI>",
                        "tokenUri": "<token URI>",
                        "authProviderX509CertUrl": "<auth provider x509 certificate URL>",
                        "clientX509CertUrl": "<client certificate URL>"
                    }
                }
            }
        },
        "sourceConfig": {
            "config": {
                "queryLogDuration": "<query log duration integer>",
                "stageFileLocation": "<path to store the stage file>",
                "resultLimit": "<query log limit integer>"
            }
        }
    },
    "processor": {
        "type": "query-parser",
        "config": {
            "filter": ""
        }
    },
    "stage": {
        "type": "table-usage",
        "config": {
            "filename": "/tmp/bigquery_usage"
        }
    },
    "bulk_sink": {
        "type": "metadata-usage",
        "config": {
            "filename": "/tmp/bigquery_usage"
        }
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "<OpenMetadata host and port>",
            "authProvider": "<OpenMetadata auth provider>"
        }
    }
}
```

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json).

They are the same as metadata ingestion.

#### Source Configuration - Source Config

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

* **queryLogDuration**: Configuration to tune how far we want to look back in query logs to process usage data.
* **resultLimit**: Configuration to set the limit for query logs

#### Processor, Stage, and Bulk Sink

To specify where the staging files will be located.

#### Workflow Configuration

The same as the [metadata](run-bigquery-connector-using-cli.md#workflow-configuration) ingestion.

### 2. Run with the CLI

#### Requirements

There is an extra requirement to run the Usage pipelines. You will need to install:

```
pip3 install --upgrade 'openmetadata-ingestion[bigquery-usage]'
```

#### Run the command

After saving the JSON config, we will run the command the same way we did for the metadata ingestion:

```
metadata ingest -c <path-to-json>
```

## Data Profiler and Quality Tests

The Data Profiler workflow will be using the `orm-profiler` processor. While the `serviceConnection` will still be the same to reach the source system, the `sourceConfig` will be updated from previous configurations.

### 1. Define the JSON Configuration

This is a sample config for the profiler:

```json
{
    "source": {
        "type": "bigquery",
        "serviceName": "<service name>",
        "serviceConnection": {
            "config": {
                "type": "BigQuery",
                "enablePolicyTagImport": true,
                "credentials": {
                    "gcsConfig": {
                        "type": "<type>",
                        "projectId": "<project ID>",
                        "privateKeyId": "<private key ID>",
                        "privateKey": "<private key>",
                        "clientEmail": "<client email>",
                        "clientId": "<client ID>",
                        "authUri": "<auth URI>",
                        "tokenUri": "<token URI>",
                        "authProviderX509CertUrl": "<auth provider x509 certificate URL>",
                        "clientX509CertUrl": "<client certificate URL>"
                    }
                }
            }
        },
        "sourceConfig": {
            "config": {
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

* You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json).
* The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceProfilerPipeline.json).

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

`tests` is a list of test definitions that will be applied to `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](broken-reference).

#### Workflow Configuration

The same as the [metadata](run-bigquery-connector-using-cli.md#workflow-configuration) ingestion.

### 2. Run with the CLI

Again, we will start by saving the JSON file.

Then, we can run the workflow as:

```
metadata profile -c <path-to-json>
```

Note how instead of running `ingest`, we are using the `profile` command to select the `Profiler` workflow.

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](../../../data-lineage/dbt-integration.md).
