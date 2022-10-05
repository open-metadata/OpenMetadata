---
title: Airflow Lineage Backend
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
pip3 install "openmetadata-ingestion[airflow-container]"
```

### Adding Lineage Config

After the installation, we need to update the Airflow configuration. This can be done following this example on
`airflow.cfg`:

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = no-auth
```

Or we can directly provide environment variables:

```env
AIRFLOW__LINEAGE__BACKEND="airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend"
AIRFLOW__LINEAGE__AIRFLOW_SERVICE_NAME="local_airflow"
AIRFLOW__LINEAGE__OPENMETADATA_API_ENDPOINT="http://localhost:8585/api"
AIRFLOW__LINEAGE__AUTH_PROVIDER_TYPE="no-auth"
```

We can choose the option that best adapts to our current architecture. Find more information on Airflow configurations
[here](https://airflow.apache.org/docs/apache-airflow/stable/howto/set-config.html).

We are now going to list the configurations for the different SSO. We will use the `ini` format for those,
but on your own Airflow you can freely choose.

#### Google SSO

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = google
# Note that the path should be local in Airflow
secret_key = path-to-secret-key-file.json
```

#### Okta SSO

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = okta
client_id = client id
org_url = org url
private_key = private key
email = email
# Optional
scopes = ["scope1", "scope2"]
```

#### Auth0 SSO

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = auth0
client_id = client id
secret_key = secret key
domain = domain
```

#### Azure SSO

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = azure
client_id = client id
client_secret = client secret
authority = authority
# Optional
scopes = ["scope1", "scope2"]
```

#### OpenMetadata SSO

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = openmetadata
jwt_token = token
```

#### Custom OIDC SSO

```ini
[lineage]
backend = airflow_provider_openmetadata.lineage.openmetadata.OpenMetadataLineageBackend
airflow_service_name = local_airflow
openmetadata_api_endpoint = http://localhost:8585/api
auth_provider_type = custom-oidc
client_id = client id
client_secret = client secret
token_endpoint = endpoint
```

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

Airflow [Operators](https://airflow.apache.org/docs/apache-airflow/stable/_api/airflow/models/baseoperator/index.html) 
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

<Note>

While we are showing here how to parse the lineage using the Lineage Backend, the setup of `inlets` and `outlets`
is supported as well through external metadata ingestion from Airflow, be it via the UI, CLI or directly running
an extraction DAG from Airflow itself.

</Note>
