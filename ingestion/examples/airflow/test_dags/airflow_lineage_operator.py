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
You can run this DAG from the default OM installation.

For this DAG to run properly we expected an OpenMetadata
Airflow connection named `openmetadata_conn_id`.
"""
from datetime import datetime
from textwrap import dedent

import requests

# The DAG object; we'll need this to instantiate a DAG
from airflow import DAG

# Operators; we need this to operate!
from airflow.operators.bash import BashOperator

from airflow_provider_openmetadata.hooks.openmetadata import OpenMetadataHook

# These args will get passed on to each operator
# You can override them on a per-task basis during operator initialization
from airflow_provider_openmetadata.lineage.operator import OpenMetadataLineageOperator

# Version detection for Airflow 3.x API compatibility
try:
    import airflow
    from packaging import version

    AIRFLOW_VERSION = version.parse(airflow.__version__)
    IS_AIRFLOW_3_OR_HIGHER = AIRFLOW_VERSION.major >= 3
except Exception:
    IS_AIRFLOW_3_OR_HIGHER = False

OM_HOST_PORT = "http://localhost:8585/api"
OM_JWT = "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

# Airflow 3.x uses /api/v2, Airflow 2.x uses /api/v1
AIRFLOW_API_VERSION = "v2" if IS_AIRFLOW_3_OR_HIGHER else "v1"
AIRFLOW_HOST = "http://localhost:8080"
AIRFLOW_HOST_API_ROOT = f"{AIRFLOW_HOST}/api/{AIRFLOW_API_VERSION}/"
AIRFLOW_USERNAME = "admin"
AIRFLOW_PASSWORD = "admin"

DEFAULT_OM_AIRFLOW_CONNECTION = "openmetadata_conn_id"


def get_airflow_jwt_token():
    """
    Get JWT token from Airflow authentication endpoint.
    """
    token_url = f"{AIRFLOW_HOST}/auth/token"
    payload = {"username": AIRFLOW_USERNAME, "password": AIRFLOW_PASSWORD}

    try:
        response = requests.post(token_url, json=payload, timeout=5)
        if response.status_code in (200, 201):
            token_data = response.json()
            access_token = token_data.get("access_token")
            if access_token:
                return access_token
    except Exception:
        pass
    return None


def get_airflow_headers():
    """
    Get authentication headers for Airflow API.
    Tries JWT token first, falls back to Basic Auth.
    """
    jwt_token = get_airflow_jwt_token()
    if jwt_token:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}",
        }

    return {
        "Content-Type": "application/json",
        "Authorization": "Basic YWRtaW46YWRtaW4=",
    }


DEFAULT_AIRFLOW_HEADERS = get_airflow_headers()

default_args = {
    "retries": 0,
}

# Create the default OpenMetadata Airflow Connection (if it does not exist)
res = requests.get(
    AIRFLOW_HOST_API_ROOT + f"connections/{DEFAULT_OM_AIRFLOW_CONNECTION}",
    headers=DEFAULT_AIRFLOW_HEADERS,
)
if res.status_code == 404:  # not found
    requests.post(
        AIRFLOW_HOST_API_ROOT + "connections",
        json={
            "connection_id": DEFAULT_OM_AIRFLOW_CONNECTION,
            "conn_type": "openmetadata",
            "host": "openmetadata-server",
            "schema": "http",
            "port": 8585,
            "password": OM_JWT,
        },
        headers=DEFAULT_AIRFLOW_HEADERS,
    )
elif res.status_code == 500:  # Internal server error (e.g., corrupted connection)
    # Try to delete the corrupted connection and recreate it
    delete_res = requests.delete(
        AIRFLOW_HOST_API_ROOT + f"connections/{DEFAULT_OM_AIRFLOW_CONNECTION}",
        headers=DEFAULT_AIRFLOW_HEADERS,
    )
    # Recreate the connection regardless of delete result
    requests.post(
        AIRFLOW_HOST_API_ROOT + "connections",
        json={
            "connection_id": DEFAULT_OM_AIRFLOW_CONNECTION,
            "conn_type": "openmetadata",
            "host": "openmetadata-server",
            "schema": "http",
            "port": 8585,
            "password": OM_JWT,
        },
        headers=DEFAULT_AIRFLOW_HEADERS,
    )
elif res.status_code != 200:
    raise RuntimeError(f"Could not fetch {DEFAULT_OM_AIRFLOW_CONNECTION} connection")


with DAG(
    "lineage_tutorial_operator",
    default_args=default_args,
    description="A simple tutorial DAG",
    schedule=None,
    is_paused_upon_creation=True,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["example"],
) as dag:
    # t1, t2 and t3 are examples of tasks created by instantiating operators
    t1 = BashOperator(
        task_id="print_date",
        bash_command="date",
        outlets=[
            {
                "tables": [
                    "test-service-table-lineage.test-db.test-schema.lineage-test-outlet"
                ]
            }
        ],
    )

    t2 = BashOperator(
        task_id="sleep",
        depends_on_past=False,
        bash_command="sleep 1",
        retries=3,
        inlets=[
            {
                "tables": [
                    "test-service-table-lineage.test-db.test-schema.lineage-test-inlet",
                    "test-service-table-lineage.test-db.test-schema.lineage-test-inlet2",
                ]
            }
        ],
    )

    dag.doc_md = (
        __doc__  # providing that you have a docstring at the beginning of the DAG
    )
    dag.doc_md = """
    This is a documentation placed anywhere
    """  # otherwise, type it like this
    templated_command = dedent(
        """
    {% for i in range(5) %}
        echo "{{ ds }}"
        echo "{{ macros.ds_add(ds, 7)}}"
        echo "{{ params.my_param }}"
    {% endfor %}
    """
    )

    t3 = BashOperator(
        task_id="templated",
        depends_on_past=False,
        bash_command=templated_command,
        params={"my_param": "Parameter I passed in"},
    )

    t1 >> [t2, t3]

    t4 = OpenMetadataLineageOperator(
        task_id="lineage_op",
        depends_on_past=False,
        server_config=OpenMetadataHook(DEFAULT_OM_AIRFLOW_CONNECTION).get_conn(),
        service_name="airflow_lineage_op_service",
        only_keep_dag_lineage=True,
    )

    [t1, t2, t3] >> t4
