import os
from copy import deepcopy
from pathlib import Path

import oracledb
import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.workflow.ingestion import IngestionWorkflow, OpenMetadataWorkflowConfig
from metadata.workflow.metadata import MetadataWorkflow

ORACLE_LINEAGE_SERVICE_NAME = "oracle-local-lineage-test-service"

ORACLE_COMMON_CONFIG = {
    "source": {
        "type": "oracle",
        "serviceName": ORACLE_LINEAGE_SERVICE_NAME,
        "serviceConnection": {
            "config": {
                "type": "Oracle",
                "hostPort": "localhost:11521",
                "username": "test",
                "password": "test",
                "oracleConnectionType": {
                    "oracleServiceName": "test",
                },
            }
        },
        "sourceConfig": {},  # placeholder to be filled in
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        # "loggerLevel": "DEBUG",
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
        },
    },
}

ORACLE_METADATA_CONFIG = deepcopy(ORACLE_COMMON_CONFIG)
ORACLE_METADATA_CONFIG["source"]["sourceConfig"] = {
    "config": {
        "type": "DatabaseMetadata",
        "schemaFilterPattern": {
            "includes": ["test"],
        },
        "tableFilterPattern": {
            "excludes": ["interim_temp_table_1"],
        },
    }
}

ORACLE_LINEAGE_CONFIG = deepcopy(ORACLE_COMMON_CONFIG)
ORACLE_LINEAGE_CONFIG["source"]["type"] = "oracle-lineage"
ORACLE_LINEAGE_CONFIG["source"]["sourceConfig"] = {
    "config": {
        "type": "DatabaseLineage",
        "enableTempTableLineage": True,
    }
}


@pytest.fixture(scope="package")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="package")
def oracle_lineage_service_name():
    return ORACLE_LINEAGE_SERVICE_NAME


@pytest.fixture(scope="package")
def oracle_lineage_container():
    from ingestion.tests.utils.docker_service_builders.database_container.oracle_test_container import (
        OracleTestContainer,
    )

    container = OracleTestContainer()
    print(f"\nOracle container started on port {container.exposed_port} for lineage tests")  # noqa: T201

    _grant_query_privileges(container)

    sql_file_path = Path(__file__).parent / "data" / "lineage.sql"
    _load_sql_file(container, sql_file_path)

    print("Schema: test (lineage tests)")  # noqa: T201
    yield container

    print("\nStopping container of lineage tests...")  # noqa: T201
    container.stop()
    print("Container stopped. Removing image...")  # noqa: T201
    container.delete_image()
    print("Image removed.")  # noqa: T201


@pytest.fixture(scope="package")
def oracle_lineage_ingestion(oracle_lineage_service_name, metadata):
    print("\n\nRunning metadata ingestion workflow for lineage tests...")  # noqa: T201
    metadata_workflow_config = OpenMetadataWorkflowConfig.model_validate(ORACLE_METADATA_CONFIG)
    metadata_workflow: IngestionWorkflow = MetadataWorkflow(metadata_workflow_config)
    metadata_workflow.execute()
    print("Metadata ingestion workflow completed.")  # noqa: T201

    print("\nRunning lineage ingestion workflow for lineage tests...")  # noqa: T201
    lineage_workflow_config = OpenMetadataWorkflowConfig.model_validate(ORACLE_LINEAGE_CONFIG)
    lineage_workflow: IngestionWorkflow = MetadataWorkflow(lineage_workflow_config)
    lineage_workflow.execute()
    print("Lineage ingestion workflow completed.")  # noqa: T201

    yield

    print("\nCleaning up lineage test service...")  # noqa: T201
    service_entity = metadata.get_by_name(DatabaseService, oracle_lineage_service_name)
    if service_entity:
        metadata.delete(DatabaseService, service_entity.id, recursive=True, hard_delete=True)
        print("Lineage test service cleaned up.")  # noqa: T201


def _grant_query_privileges(container):
    print("\nGranting query privileges to test user...")  # noqa: T201

    dsn = oracledb.makedsn("localhost", container.exposed_port, service_name=container.dbname)
    connection = oracledb.connect(user="sys", password="test", dsn=dsn, mode=oracledb.AUTH_MODE_SYSDBA)
    cursor = connection.cursor()

    # Grant query history access
    cursor.execute("GRANT SELECT ON gv_$sql TO test")
    cursor.execute("GRANT SELECT ON v_$sql TO test")
    cursor.execute("GRANT SELECT ANY DICTIONARY TO test")

    # Grant DDL privileges for stored procedures to create/drop temp tables
    cursor.execute("GRANT CREATE TABLE TO test")
    cursor.execute("GRANT DROP ANY TABLE TO test")

    connection.commit()
    try:
        cursor.close()
        connection.close()
    except Exception as e:
        print(f"Error closing cursor/connection after granting query privileges: {e}")  # noqa: T201
        pass  # noqa: PIE790
    print("Query privileges granted successfully")  # noqa: T201


def _load_sql_file(container, sql_file_path: Path):
    if not sql_file_path.exists():
        print(f"SQL file not found: {sql_file_path}")  # noqa: T201
        return

    if os.path.getsize(sql_file_path) == 0:  # noqa: PTH202
        print(f"SQL file is empty: {sql_file_path}")  # noqa: T201
        return

    print(f"Loading SQL from: {sql_file_path}")  # noqa: T201

    try:
        with open(sql_file_path, "r") as f:  # noqa: PTH123
            sql_content = f.read()

        connection = container.raw_connection()
        cursor = connection.cursor()

        # Split on / delimiter (SQL*Plus style) for PL/SQL blocks
        # This is the standard Oracle way to separate statements
        statements = sql_content.split("\n/\n")

        print(f"Executing {len(statements)} SQL statements...")  # noqa: T201
        for i, statement in enumerate(statements, 1):
            statement = statement.strip()  # noqa: PLW2901

            # Remove trailing / if present (last statement in file)
            if statement.endswith("/"):
                statement = statement[:-1].strip()  # noqa: PLW2901

            if not statement:
                continue

            try:
                cursor.execute(statement)
                connection.commit()
                print(f"  Statement {i}/{len(statements)} executed")  # noqa: T201
            except Exception as e:
                print(f"  Statement {i}/{len(statements)} failed: {e}")  # noqa: T201
                print(f"    Statement content: {statement}")  # noqa: T201
                connection.rollback()
                continue

        cursor.close()
        connection.close()
        print("Successfully loaded lineage.sql into Oracle container for lineage tests.")  # noqa: T201

    except Exception as e:
        print(f"Failed to load SQL: {e}")  # noqa: T201
        raise
