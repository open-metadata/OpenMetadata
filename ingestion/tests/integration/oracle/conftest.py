#  Copyright 2026 Collate
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
Oracle integration test fixtures: spins up an Oracle test container,
seeds it with one regular table and two Global Temporary Tables (GTTs)
— a session-level and a transaction-level — so the includeTemporaryTables
flag can be exercised end-to-end.
"""

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.services.databaseService import DatabaseService

REGULAR_TABLE = "regular_orders"
SESSION_GTT = "gtt_user_session"
TRANSACTION_GTT = "gtt_order_staging"

SEED_STATEMENTS = [
    f"""
    CREATE TABLE {REGULAR_TABLE} (
        order_id NUMBER PRIMARY KEY,
        sku VARCHAR2(40),
        qty NUMBER(10,2)
    )
    """,
    f"""
    CREATE GLOBAL TEMPORARY TABLE {SESSION_GTT} (
        user_id NUMBER NOT NULL,
        action_code VARCHAR2(50) NOT NULL,
        payload CLOB
    ) ON COMMIT PRESERVE ROWS
    """,
    f"""
    CREATE GLOBAL TEMPORARY TABLE {TRANSACTION_GTT} (
        order_id NUMBER NOT NULL,
        sku VARCHAR2(40) NOT NULL,
        qty NUMBER(10,2),
        CONSTRAINT pk_{TRANSACTION_GTT} PRIMARY KEY (order_id, sku)
    ) ON COMMIT DELETE ROWS
    """,
]

ORACLE_GTT_SERVICE_BASE = "oracle-local-gtt-test-service"


def _build_workflow_config(service_name, exposed_port, include_temporary_tables):
    return {
        "source": {
            "type": "oracle",
            "serviceName": service_name,
            "serviceConnection": {
                "config": {
                    "type": "Oracle",
                    "hostPort": f"localhost:{exposed_port}",
                    "username": "test",
                    "password": "test",
                    "oracleConnectionType": {"oracleServiceName": "test"},
                    "includeTemporaryTables": include_temporary_tables,
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "schemaFilterPattern": {"includes": ["test"]},
                }
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": (
                        "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                        "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0Y"
                        "S5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS"
                        "8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwI"
                        "WKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP"
                        "66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj"
                        "3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTn"
                        "P49U493VanKpUAfzIiOiIbhg"
                    )
                },
            }
        },
    }


@pytest.fixture(scope="package")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="package")
def oracle_gtt_container():
    from ingestion.tests.utils.docker_service_builders.database_container.oracle_test_container import (
        OracleTestContainer,
    )

    container = OracleTestContainer()
    print(f"\nOracle container started on port {container.exposed_port} for GTT tests")

    _grant_catalog_access(container)
    _seed_schema(container)
    yield container

    print("\nStopping container of GTT tests...")
    container.stop()
    container.delete_image()


@pytest.fixture(scope="package")
def gtt_workflow_configs(oracle_gtt_container):
    """Two workflow configs, one with the flag off and one with it on,
    each pointing at a distinct service so they don't share entities."""
    off_service = f"{ORACLE_GTT_SERVICE_BASE}-off"
    on_service = f"{ORACLE_GTT_SERVICE_BASE}-on"
    return {
        "off": (
            off_service,
            _build_workflow_config(
                off_service, oracle_gtt_container.exposed_port, False
            ),
        ),
        "on": (
            on_service,
            _build_workflow_config(on_service, oracle_gtt_container.exposed_port, True),
        ),
    }


@pytest.fixture(scope="package", autouse=True)
def _cleanup_gtt_services(metadata, gtt_workflow_configs):
    yield
    for service_name, _ in gtt_workflow_configs.values():
        service_entity = metadata.get_by_name(DatabaseService, service_name)
        if service_entity:
            metadata.delete(
                DatabaseService,
                service_entity.id,
                recursive=True,
                hard_delete=True,
            )


def _seed_schema(container):
    print("Seeding regular + GTT tables for tests...")
    connection = container.raw_connection()
    cursor = connection.cursor()
    try:
        for statement in SEED_STATEMENTS:
            cursor.execute(statement)
        connection.commit()
    finally:
        cursor.close()
        connection.close()
    print("Seed complete.")


def _grant_catalog_access(container):
    """OpenMetadata's CheckAccess reads DBA_TABLES; app user needs SELECT_CATALOG_ROLE."""
    print("Granting SELECT_CATALOG_ROLE to test user...")
    connection = container.admin_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(f"GRANT SELECT_CATALOG_ROLE TO {container.username}")
        connection.commit()
    finally:
        cursor.close()
        connection.close()
    print("Grant complete.")
