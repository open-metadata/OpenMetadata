---
title: Airflow Lineage Operator
slug: /connectors/pipeline/airflow/lineage-operator
---

# Airflow Lineage Operator

Another approach to extract Airflow metadata only for the DAGs you want is to use the `OpenMetadataLineageOperator`.

When the task executes, it will ingest:
- The Pipeline Service if it does not exist
- The DAG as a Pipeline if it does not exist.
- The status of the tasks. We recommend running this Operator as the last step if you want up-to-date statuses.
- The lineage from inlets and outlets.

## Installation

The Lineage Operator can be directly installed to the Airflow instances as part of the usual OpenMetadata Python
distribution:

```commandline
pip3 install "openmetadata-ingestion==x.y.z"
```

Where `x.y.z` is the version of your OpenMetadata server, e.g., 0.13.0. It is important that server and client
versions match.

**It requires the version `0.13.1` or higher**.

## Example DAG

An example DAG looks like follows:

```python
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
You can run this DAG from the default OM installation
"""

from datetime import datetime, timedelta
from textwrap import dedent

# The DAG object; we'll need this to instantiate a DAG
from airflow import DAG

# Operators; we need this to operate!
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

# These args will get passed on to each operator
# You can override them on a per-task basis during operator initialization
from airflow_provider_openmetadata.lineage.operator import OpenMetadataLineageOperator

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)


default_args = {
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}


def explode():
    raise Exception("Oh no!")


with DAG(
    'lineage_tutorial_operator',
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
            "tables": ["sample_data.ecommerce_db.shopify.dim_address"]
        }
    )

    t2 = BashOperator(
        task_id='sleep',
        depends_on_past=False,
        bash_command='sleep 1',
        retries=3,
        inlets={
            "tables": ["sample_data.ecommerce_db.shopify.dim_customer"]
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

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )

    t4 = OpenMetadataLineageOperator(
        task_id='lineage_op',
        depends_on_past=False,
        server_config=server_config,
        service_name="airflow_lineage_op_service",
        only_keep_dag_lineage=True,
    )

    t1 >> t4
```

## Retrieving the OpenMetadataConnection from Airflow

In 0.13.1 we have also added an `OpenMetadataHook`, which can be configured from the UI to safely store
the parameters to connect to OpenMetadata.

Go to the Airflow UI > Admin > Connection and create a new `OpenMetadata` connection as follows:

{% image src="/images/v1.10/connectors/airflow/airflow-connection.png" alt="Airflow Connection" /%}

Testing the connection will validate that the server is reachable and the installed client can be instantiated properly.

Once the connection is configured, you can use it in your DAGs without creating the `OpenMetadataConnection` manually

```python
from airflow_provider_openmetadata.hooks.openmetadata import OpenMetadataHook

openmetadata_hook = OpenMetadataHook(openmetadata_conn_id="om_id")
server_config = openmetadata_hook.get_conn()

OpenMetadataLineageOperator(
    task_id='lineage_op',
    depends_on_past=False,
    server_config=server_config,
    service_name="airflow_lineage_op_service",
    only_keep_dag_lineage=True,
)
```

### OpenMetadataHook with HTTPS and SSL

If the OpenMetadata server connection needs to happen through HTTPS, update the `Schema` accordingly to `https`.

For SSL parameters we have two options:

#### 1. Ignore the SSL certificates

You can add the `Extra` value as the following JSON to create the connection that will ignore SSL.

```json
{
  "verifySSL": "ignore"
}
```

#### 2. Validate SSL certificates

Otherwise, you can use the `validate` value and add the path to the certificate. **It should be reachable locally
in your Airflow instance**.

```json
{
  "verifySSL": "validate",
  "sslConfig": "path-to-cert"
}
```
