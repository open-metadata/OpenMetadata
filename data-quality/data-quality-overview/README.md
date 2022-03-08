---
description: >-
  Learn how you can use OpenMetadata to define Data Quality tests and measure
  your data reliability.
---

# Data Quality Overview

## Requirements

### OpenMetadata (version 0.9.0 or later)

You must have a running deployment of OpenMetadata to use this guide. OpenMetadata includes the following services:

* OpenMetadata server supporting the metadata APIs and user interface
* Elasticsearch for metadata search and discovery
* MySQL as the backing store for all metadata
* Airflow for metadata ingestion workflows

### Python (version 3.8.0 or later)

Please use the following command to check the version of Python you have.

```
python3 --version
```

## Building Trust

OpenMetadata aims to be where all users share and collaborate around data. One of the main benefits of ingesting metadata into OpenMetadata is to make assets discoverable.

However, we need to ask ourselves: What happens after a user stumbles upon our assets? Then, we can help other teams use the data by adding proper descriptions with up-to-date information or even examples on how to extract information properly.&#x20;

What is imperative to do, though, is to build **trust**. For example, users might find a Table that looks useful for their use case, but how can they be sure it correctly follows the SLAs? What issues has this source undergone in the past? Data Quality & tests play a significant role in making any asset trustworthy. Being able to show together the Entity information and its reliability will help our users think, "This is safe to use".

This section will show you how to configure and run Data Profiling and Quality pipelines with the supported tests.

## Data Profiling

The Ingestion Framework currently supports two types of pipelines:

* **Ingestion:** Captures metadata from the sources and updates the Entities' instances.
* **Profiling:** Extracts metrics from SQL sources and configures and runs Data Quality tests. It requires previous executions of the Ingestion Pipeline.



> Note that you can configure Ingestion pipelines with `source.config.data_profiler_enabled` as `"true"` or `"false"` to run the legacy profiler as well during the metadata ingestion. This, however, does not support Quality Tests.

The steps of the **Profiling** pipeline are the following:

1. First, use the source configuration to create a connection.
2. Next, iterate over the selected tables and schemas that the Ingestion has previously added.
3. Run a default set of metrics to all the table's columns. (We will add more customization in further releases).
4. Finally, compare the metrics' results against the configured Data Quality tests.

Note that all the results are published to the OpenMetadata API, both the Profiling and the tests executions. This will allow users to visit the evolution of the data and its reliability directly in the UI.

You can take a look at the supported metrics and tests here:

{% content-ref url="metrics.md" %}
[metrics.md](metrics.md)
{% endcontent-ref %}

{% content-ref url="tests.md" %}
[tests.md](tests.md)
{% endcontent-ref %}

## Configuration

{% tabs %}
{% tab title="OpenMetadata UI" %}
TBD
{% endtab %}

{% tab title="JSON Configuration" %}
## Requirements

Note that the Profiling Pipeline needs to run at least after one Ingestion Pipeline. Then, the easiest way to configure the Profiling and Testing is by updating an existing JSON configuration from existing ingestions.

## Procedure

Here’s an overview of the steps in this procedure. Please follow the steps relevant to your use case.

1. Pick up an existing Ingestion configuration
2. Update the data filters (optional)
3. Configure the `processor` to specify our profiler
4. Add the tests you'd like to run

### 1. Use an existing Ingestion JSON configuration

We have taken a sample from MySQL, but feel free to adapt it.

```json
{
  "source": {
    "type": "mysql",
    "config": {
      "host_port": "hostname.domain.com:5439",
      "username": "username",
      "password": "strong_password",
      "database": "mysql_db",
      "service_name": "local_mysql",
      "data_profiler_enabled": "false",
      "table_filter_pattern": {
        "excludes": ["[\\w]*event_vw.*"]
      },
      "schema_filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*", "performance_schema.*", "sys.*"]
      }
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}  
```

### 2. Update the data filters (optional)

Consider that Profiling pipelines can take longer to execute than Ingestion ones. You might want to run the Profiling in different processes and for specific tables/schemas for more significant data volumes.

This would also allow running each process in a different frequency, depending on the data needs.

### 3. Configure the processor

Let's start by adding a minimal configuration for the Profiler processor.

Leaving only the defaults shown below will just execute the profiler on the source without creating any new tests.

```json
{
  "source": {
    ...
  },
  "processor": {
    "type": "orm-profiler",
    "config": {}
  },
  "sink": {
    ...
  },
  "metadata_server": {
    ...
}  
```

### 4. Adding new tests

Let's configure our example further to add a couple of tests:

1. **Table Test:** This is applied to table metrics, such as the row count or the number of columns.
2. **Column Test:** This goes at column level and helps us check null values or ranges, among many others.

> Make sure to review the available [Tests](tests.md)! If there's something you'd like to test that is not currently supported, you can reach us out oppening an [Issue](https://github.com/open-metadata/OpenMetadata/issues/new/choose) in Github or dropping a line in [Slack](https://slack.open-metadata.org).

We are going to now configure both Table and Column tests.

```json
{
  "source": {
    ...
  },
  "processor": {
    "type": "orm-profiler",
    "config": {
        "test_suite": {
            "name": "<Test Suite name>",
            "tests": [
                {
                    "table": "<Table FQDN>",
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
  "sink": {
    ...
  },
  "metadata_server": {
    ...
}
```

`tests` is a list of test definitions that will be applied to `table`, informed by its FQDN. For each table, one can then define a list of `table_tests` and `column_tests`. Review the supported tests and their definitions to learn how to configure the different cases.

## How to run

You can run this pipeline in two ways:

1. From the command line, using the metadata CLI: `metadata profile -c <path-to-config.json>`.
2. Calling the `Workflow` from any scheduler:

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
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
  ## REPLACE THIS LINE WITH YOUR CONFIGURATION JSON
"""

def metadata_ingestion_workflow():
    workflow_config = json.loads(config)
    workflow = ProfilerWorkflow.create(workflow_config)
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
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )
```

Note how it is exactly the same approach as with the Ingestion Pipeline. We are only changing the type of Workflow with `ProfilerWorkflow`.

## Outcome

This Pipeline will finish as a failure if any of the tests fail.

After running this process, the Table Entities you configured tests for will have the configuration stored in OpenMetadata. This means that you could rerun the tests just by executing the simple JSON we had at step 3.

The workflow is then in charge of picking up the stored Entity information and running all the tests that it finds already configured.
{% endtab %}
{% endtabs %}



