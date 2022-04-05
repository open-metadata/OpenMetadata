#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import socket
import time
from typing import List
from urllib.parse import urlparse

import pytest
import requests
from sqlalchemy.engine import create_engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def is_responsive(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return True
    except ConnectionError:
        return False


def is_port_open(url):
    url_parts = urlparse(url)
    hostname = url_parts.hostname
    port = url_parts.port
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((hostname, port))
        return True
    except socket.error:
        return False
    finally:
        s.close()


def sleep(timeout_s):
    print(f"sleeping for {timeout_s} seconds")
    n = len(str(timeout_s))
    for i in range(timeout_s, 0, -1):
        print(f"{i:>{n}}", end="\r", flush=True)
        time.sleep(1)
    print(f"{'':>{n}}", end="\n", flush=True)


def status(r):
    if r.status_code == 200 or r.status_code == 201:
        return 1
    else:
        return 0


def create_delete_table(client: OpenMetadata, databases: List[Database]):
    columns = [
        Column(name="id", dataType="INT", dataLength=1),
        Column(name="name", dataType="VARCHAR", dataLength=1),
    ]
    db_ref = EntityReference(
        id=databases[0].id, name=databases[0].name.__root__, type="database"
    )
    table = CreateTableRequest(name="test1", columns=columns, database=db_ref)
    created_table = client.create_or_update(table)
    if table.name.__root__ == created_table.name.__root__:
        client.delete(entity=Table, entity_id=str(created_table.id.__root__))
        return 1
    else:
        client.delete(entity=Table, entity_id=str(created_table.id.__root__))
        return 0


def create_delete_database(client: OpenMetadata, databases: List[Database]):
    data = {
        "databaseConnection": {"hostPort": "localhost"},
        "name": "temp_local_hive",
        "serviceType": "Hive",
        "description": "local hive env",
    }
    create_hive_service = CreateDatabaseServiceRequest(**data)
    hive_service = client.create_or_update(create_hive_service)
    create_database_request = CreateDatabaseRequest(
        name="dwh", service=EntityReference(id=hive_service.id, type="databaseService")
    )
    created_database = client.create_or_update(create_database_request)
    resp = create_delete_table(client, databases)
    print(resp)
    client.delete(entity=Database, entity_id=str(created_database.id.__root__))
    client.delete(entity=DatabaseService, entity_id=str(hive_service.id.__root__))
    return resp


@pytest.fixture(scope="session")
def hive_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    port = docker_services.port_for("hive-server", 10000)
    print(f"HIVE is running on port {port}")
    timeout_s = 120
    sleep(timeout_s)
    url = "hive://localhost:10000/"
    docker_services.wait_until_responsive(
        timeout=timeout_s, pause=0.1, check=lambda: is_port_open(url)
    )
    engine = create_engine(url)
    inspector = inspect(engine)
    return inspector


def test_check_schema(hive_service):
    inspector = hive_service
    schemas = []
    for schema in inspector.get_schema_names():
        schemas.append(schema)
    if "default" in schemas:
        assert 1
    else:
        assert 0


def test_read_tables(hive_service):
    inspector = hive_service
    check_tables = [
        "metadata_array_struct_test",
        "metadata_struct_test",
        "metadata_test_table",
        "test_check",
    ]
    tables = []
    for schema in inspector.get_schema_names():
        for table in inspector.get_table_names(schema):
            tables.append(table)
            if set(tables) == set(check_tables):
                assert 1
            else:
                assert 0


def test_check_table():
    is_responsive("http://localhost:8585/api/v1/health-check")
    metadata_config = MetadataServerConfig.parse_obj(
        {"api_endpoint": "http://localhost:8585/api", "auth_provider_type": "no-auth"}
    )
    client = OpenMetadata(metadata_config)
    databases = client.list_entities(entity=Database).entities
    if len(databases) > 0:
        assert create_delete_table(client, databases)
    else:
        assert create_delete_database(client, databases)
