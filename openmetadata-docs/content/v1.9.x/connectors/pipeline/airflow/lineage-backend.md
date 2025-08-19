---
title: Airflow Lineage Backend | Official Documentation
description: Integrate Airflow lineage backend to capture runtime metadata and execution traces for DAGs and tasks.
slug: /connectors/pipeline/airflow/lineage-backend
---

# Airflow Lineage Backend

Learn how to capture lineage information directly from Airflow DAGs using the OpenMetadata Lineage Backend.

## Introduction

Obtaining metadata should be as simple as possible. Not only that, we want developers to be able to keep using their 
tools without any major changes.

We can directly use [Airflow code](https://airflow.apache.org/docs/apache-airflow/stable/lineage.html#lineage-backend) 
to help us track data lineage. What we want to achieve through this backend is the ability to link OpenMetadata Table Entities and the pipelines that have those instances as inputs or outputs.

Being able to control and monitor these relationships can play a major role in helping discover and communicate issues 
to your company data practitioners and stakeholders.

This document will guide you through the installation, configuration and internals of the process to help you unlock as
much value as possible from within your Airflow pipelines.

## Quickstart

### Installation

The Lineage Backend can be directly installed to the Airflow instances as part of the usual OpenMetadata Python
distribution:

```commandline
pip3 install "openmetadata-ingestion==x.y.z"
```

Where `x.y.z` is the version of your OpenMetadata server, e.g., 1.2.2. **It is important that server and client
versions match**.

### Adding Lineage Config

After the installation, we need to update the Airflow configuration. This can be done following this example on
`airflow.cfg`:

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.backend.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
jwt_token = <your-token>
```

Or we can directly provide environment variables:

```env
AIRFLOW__LINEAGE__BACKEND="airflow_provider_openmetadata.lineage.backend.OpenMetadataLineageBackend"
AIRFLOW__LINEAGE__AIRFLOW_SERVICE_NAME="local_airflow"
AIRFLOW__LINEAGE__OPENMETADATA_API_ENDPOINT="http://localhost:8585/api"
AIRFLOW__LINEAGE__JWT_TOKEN="<your-token>"
```

We can choose the option that best adapts to our current architecture. Find more information on Airflow configurations
[here](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-config.html).

Moreover, when using the lineage backend to bring in Pipeline metadata, we will add the URL of DAG. We build
this URL by using the `webserver` base URL. If you want to make sure this value is informed correctly, double-check
what you have defined in the `webserver` configuration [here](https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html#base-url).

```env
AIRFLOW__WEBSERVER__BASE_URL="http://localhost:8080"
```

Make sure this is a valid URI by not forgetting to add the scheme, otherwise we won't be able to properly parse it.

#### Optional Parameters

You can also set the following parameters:

```ini
[lineage]
...
only_keep_dag_lineage = true
max_status = 10
timeout = 30
retry = 3
retry_wait = 60
retry_codes = 500,502,503,504
```

- `only_keep_dag_lineage` will remove any table lineage not present in the inlets or outlets. This will ensure
that any lineage in OpenMetadata comes only from your code.
- `max_status` controls the number of status to ingest in each run. By default, we'll pick the last 10.
- `timeout` sets the timeout for the airflow lineage backend's connection to openMetadata.
- `retry` limits the numbers of retries for the airflow lineage backend's connection to openMetadata.
- `retry_wait` the base wait time (in seconds) between retry attempts. On each retry, the wait time increases linearly based on the number of attempts already made: `retry_wait * (total_retries - retry + 1)` This mechanism helps avoid overwhelming the service by spacing out retries.
- `retry_codes` is a comma-separated list of HTTP status codes that will trigger a retry. By default, it includes Gateway Timeout (HTTP 504).


In the following sections, we'll show how to adapt our pipelines to help us build the lineage information.

## Lineage Backend

You can find the source code [here](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/airflow_provider_openmetadata).

### Pipeline Service

The backend will look for a Pipeline Service Entity with the name specified in the configuration under
`airflow_service_name`. If it cannot find the instance, it will create one based on the following information:

- `airflow_service_name` as name. If not informed, the default value will be `airflow`.
- It will use the `webserver` base URL as the URL of the service.

### Pipeline Entity

Each DAG processed by the backend will be created or updated as a Pipeline Entity linked to the above Pipeline Service.

We are going to extract the task information and add it to the Pipeline task property list. Then, a 
DAG created with some tasks as the following random example:

```commandline
t1 >> [t2, t3]
```

We will capture this information as well, therefore showing how the DAG contains three tasks t1, t2 and t3; and t1 having
t2 and t3 as downstream tasks.

### Adding Lineage

Airflow [Operators](https://airflow.apache.org/docs/apache-airflow/1.10.4/_api/airflow/models/baseoperator/index.html) 
contain the attributes `inlets` and `outlets`. When creating our tasks, we can pass any of these two
parameters as follows:

```python
BashOperator(
    task_id='print_date',
    bash_command='date',
    outlets={
        "tables": ["service.database.schema.table"]
    }
)
```

Note how in this example we are defining a Python `dict` with the key tables and value a `list`. 
This list should contain the FQN of tables ingested through any of our connectors or APIs.

When each task is processed, we will use the OpenMetadata client to add the lineage information (upstream for inlets 
and downstream for outlets) between the Pipeline and Table Entities.

It is important to get the naming right, as we will fetch the Table Entity by its FQN. If no information is specified 
in terms of lineage, we will just ingest the Pipeline Entity without adding further information.

{% note %}

While we are showing here how to parse the lineage using the Lineage Backend, the setup of `inlets` and `outlets`
is supported as well through external metadata ingestion from Airflow, be it via the UI, CLI or directly running
an extraction DAG from Airflow itself.

{% /note %}

## Example

This is a full example of a working DAG. Note how we are passing the inlets and outlets for the `fullyQualifiedName`s
- `mysql.default.openmetadata_db.bot_entity`
- `snow.TEST.PUBLIC.COUNTRIES`

We are pointing at already ingested assets, so there is no limitation of them being part of the same service. For
this example to work on your end, update the FQNs to tables you already have in OpenMetadata.

```python
from datetime import datetime, timedelta
from textwrap import dedent

# The DAG object; we'll need this to instantiate a DAG
from airflow import DAG

# Operators; we need this to operate!
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

# These args will get passed on to each operator
# You can override them on a per-task basis during operator initialization
from airflow_provider_openmetadata.lineage.callback import success_callback, failure_callback


default_args = {
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
    'on_failure_callback': failure_callback,
    'on_success_callback': success_callback,
}


def explode():
    raise Exception("I am an angry exception!")

with DAG(
    'lineage_tutorial',
    default_args=default_args,
    description='A simple tutorial DAG',
    schedule_interval=timedelta(days=1),
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=['example'],
) as dag:

    # t1, t2 and t3 are examples of tasks created by instantiating operators
    t1 = BashOperator(
        task_id='print_date',
        bash_command='date',
        outlets={
            "tables": ["mysql.default.openmetadata_db.bot_entity"]
        }
    )

    t2 = BashOperator(
        task_id='sleep',
        depends_on_past=False,
        bash_command='sleep 5',
        retries=3,
        inlets={
            "tables": ["snow.TEST.PUBLIC.COUNTRIES"]
        }
    )

    risen = PythonOperator(
        task_id='explode',
        provide_context=True,
        python_callable=explode,
        retries=0,
    )

    dag.doc_md = __doc__  # providing that you have a docstring at the beginning of the DAG
    dag.doc_md = """
    This is a documentation placed anywhere
    """  # otherwise, type it like this
    templated_command = dedent("")

    t3 = BashOperator(
        task_id='templated',
        depends_on_past=False,
        bash_command=templated_command,
        params={'my_param': 'Parameter I passed in'},
    )

    t1 >> [t2, t3]
```

Running the lineage backend will not only ingest the lineage data, but will also send the DAG as a pipeline with its tasks
and status to OpenMetadata.

If you are running this example using the quickstart deployment of OpenMetadata, then your `airflow.cfg` could look like
this:

```
backend = airflow_provider_openmetadata.lineage.backend.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = openmetadata
jwt_token = ...
```

After running the DAG, you should be able to see the following information in the ingested Pipeline:

{% image src="/images/v1.9/connectors/airflow/lineage-backend-dag.png" alt="DAG" caption="DAG ingested as a Pipeline with the Task view." /%}

{% image src="/images/v1.9/connectors/airflow/lineage-backend-lineage.png" alt="Lineage" caption="Pipeline Lineage." /%}

A fast way to try and play with Airflow locally is to install `apache-airflow` in a virtual environment and, when using
versions greater than 2.2.x, using `airflow standalone`.
