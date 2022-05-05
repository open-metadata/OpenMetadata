---
description: Use your own Airflow instance to schedule and run the Connector.
---

# Run BigQuery Connector using Airflow SDK

Configure and schedule BigQuery **metadata**, **usage**, and **profiler** workflows using your own Airflow instances.

* [Requirements](run-bigquery-connector-using-airflow-sdk.md#requirements)
* [Metadata Ingestion](run-bigquery-connector-using-airflow-sdk.md#metadata-ingestion)
* [Query Usage and Lineage Ingestion](run-bigquery-connector-using-airflow-sdk.md#query-usage-and-lineage-ingestion)
* [Data Profiler and Quality Tests](run-bigquery-connector-using-airflow-sdk.md#data-profiler-and-quality-tests)
* [DBT Integration](run-bigquery-connector-using-airflow-sdk.md#dbt-integration)

## Requirements

Follow this [guide](../../airflow/) to learn how to set up Airflow to run the metadata ingestions.

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

#### Source Configuration - Service Connection

You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json).

* **hostPort**: **** This is the BigQuery APIs URL.
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

### 2. Prepare the Ingestion DAG

Create a Python file in your Airflow DAGs directory with the following contents:

```python
import pathlib
import json
from datetime import timedelta
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from airflow.utils.dates import days_ago

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60)
}

config = """
<your JSON configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = json.loads(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    schedule_interval='*/5 * * * *', 
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

Note that from connector to connector, this recipe will always be the same. By updating the JSON configuration, you will be able to extract metadata from different sources.

## Query Usage and Lineage Ingestion

To ingest the Query Usage and Lineage information, the `serviceConnection` configuration will remain the same. However, the `sourceConfig` is now modeled after [this](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json) JSON Schema.

### 1. Define the JSON Configuration

This is a sample config for BigQuery Usage:

```json
{
    "source": {
        "type": "bigquery-usage",
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
    "bulkSink": {
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

The same as the [metadata](run-bigquery-connector-using-airflow-sdk.md#workflow-configuration) ingestion.

### 2. Prepare the Ingestion DAG

For the usage workflow creation, the Airflow file will look the same as for the metadata ingestion. Updating the JSON configuration will be enough.

## Data Profiler and Quality Tests

The Data Profiler workflow will be using the `orm-profiler` processor. While the `serviceConnection` will still be the same to reach the source system, the `sourceConfig` will be updated from previous configurations.

### 1. Define the JSON configuration

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

* You can find all the definitions and types for the `serviceConnection` [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/connections/database/bigQueryConnection.json).
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

`tests` is a list of test definitions that will be applied to `table`, informed by its FQN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases [here](broken-reference).

#### Workflow Configuration

The same as the [metadata](run-bigquery-connector-using-airflow-sdk.md#workflow-configuration) ingestion.

### 2. Prepare the Ingestion DAG

Here, we follow a similar approach as with the metadata and usage pipelines, although we will use a different Workflow class:

```python
import json
from datetime import timedelta

from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from airflow.utils.dates import days_ago

from metadata.orm_profiler.api.workflow import ProfilerWorkflow


default_args = {
    "owner": "user_name",
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
<your JSON configuration>
"""

def metadata_ingestion_workflow():
    workflow_config = json.loads(config)
    workflow = ProfilerWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

with DAG(
    "profiler_example",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=days_ago(1),
    is_paused_upon_creation=False,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="profile_and_test_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

## DBT Integration

You can learn more about how to ingest DBT models' definitions and their lineage [here](../../../data-lineage/dbt-integration.md).
