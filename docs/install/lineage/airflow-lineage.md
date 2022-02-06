---
description: >-
Learn how to capture lineage information directly from Airflow DAGs using the OpenMetadata Lineage Backend.
---

# Airflow Lineage

## Introduction

Obtaining metadata should be as simple as possible. Not only that, we want developers to be able to keep using their tools without any major changes.

We can directly use [Airflow code](https://airflow.apache.org/docs/apache-airflow/stable/lineage.html#lineage-backend) to help us track data lineage.
What we want to achieve through this backend is the ability to link OpenMetadata Table Entities and the pipelines that have those instances as inputs or outputs.

Being able to control and monitor these relationships can play a major role in helping discover and communicate issues to your company data practitioners and stakeholders.

This document will guide you through the installation, configuration and internals of the process to help you unlock as much value as possible from within your Airflow pipelines.

## Quickstart

### Installation

The Lineage Backend can be directly installed to the Airflow instances as part of the usual OpenMetadata Python distribution:

{% tabs %}
{% tab title="Install Using PyPI" %}
```bash
pip install 'openmetadata-ingestion'
```
{% endtab %}
{% endtabs %}

### Adding Lineage Config

After the installation, we need to update the Airflow configuration. This can be done following this example on `airflow.cfg`:

```airflow.cfg
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = no-auth
```

Or we can directly provide environment variables:

```
AIRFLOW__LINEAGE__BACKEND="airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend"
AIRFLOW__LINEAGE__AIRFLOW_SERVICE_NAME="local_airflow"
AIRFLOW__LINEAGE__OPENMETADATA_API_ENDPOINT="http://localhost:8585/api"
AIRFLOW__LINEAGE__AUTH_PROVIDER_TYPE="no-auth"
```

We can choose the option that best adapts to our current architecture. 

> Find more information on Airflow configurations [here](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-config.html).

In the following sections, we'll show how to adapt our pipelines to help us build the lineage information.

## Security

If you are securing the OpenMetadata endpoint with any Auth provider, you can use the following configurations:

```airflow.cfg
auth_provider_type = google  # if you are configuring google as SSO
secret_key = google-client-secret-key # it needs to be configured
             only if you are using google as SSO
```

You can find more information in [Enable Security](install/enable-security/README.md).

## Lineage Backend

> You can find the source code [here](https://github.com/open-metadata/OpenMetadata/tree/main/ingestion/src/airflow_provider_openmetadata).

### Pipeline Service

The backend will look for a Pipeline Service Entity with the name specified in the configuration under `airflow_service_name`.
If it cannot find the instance, it will create one based on the following information:

- `airflow_service_name` as name. If not informed, the default value will be `airflow`.
- It will use the `webserver` base URL as the URL of the service.

### Pipeline Entity

Each DAG processed by the backend will be created or updated as a Pipeline Entity linked to the above Pipeline Service.

We are going to extract the task information and add it to the Pipeline task property list.

### Adding Lineage

Airflow [Operators](https://airflow.apache.org/docs/apache-airflow/stable/_api/airflow/models/baseoperator/index.html) 
contain the attributes inlets and outlets. When creating our tasks, we can pass any of these two parameters as follows:

```python
BashOperator(
    task_id='print_date',
    bash_command='date',
    outlets={
        "tables": ["bigquery_gcp.shopify.dim_address"]
    }
)
```

Note how in this example we are defining a Python `dict` with the key `tables` and value a list. This `list` should contain the 
FQDN of tables ingested through any of our connectors or APIs.

When each task is processed, we will use the OpenMetadata client to add the lineage information 
(upstream for inlets and downstream for outlets) between the Pipeline and Table Entities.

It is important to get the naming right, as we will fetch the Table Entity by its FQDN. If no information is specified 
in terms of lineage, we will just ingest the Pipeline Entity without adding further information.

You can see another example [here](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/examples/airflow_lineage/openmetadata_airflow_lineage_example.py)

## Lineage Callback


One of the downsides of the Lineage Backend is that it does not get executed when a task fails.
In order to still get the metadata information from the workflow, we can configure the OpenMetadata lineage callback.

Import it with

```python
from airflow_provider_openmetadata.lineage.callback import lineage_callback
```

and use it as an argument for `on_failure_callback` property.

This can be set both at DAG and Task level, giving us flexibility on how (and if) we want to handle lineage on failure.
