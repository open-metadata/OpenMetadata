#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from metadata.ingestion.ometa.client import REST
from metadata.generated.schema.type.common import EntityReference
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest
import pytest
import requests
import time
from sqlalchemy.engine import create_engine
from sqlalchemy.inspection import inspect

headers = {'Content-type': 'application/json'}
url = 'http://localhost:8585/api/v1/'


def is_responsive(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return True
    except ConnectionError:
        return False


def status(r):
    if r.status_code == 200 or r.status_code == 201:
        return 1
    else:
        return 0


def create_delete_table(client):
    databases = client.list_databases()
    columns = [Column(name="id", columnDataType="INT"),
               Column(name="name", columnDataType="VARCHAR")]
    table = CreateTableEntityRequest(
        name="test1", columns=columns, database=databases[0].id)
    created_table = client.create_or_update_table(table)
    if(table.name.__root__ == created_table.name.__root__):
        requests.delete(
            'http://localhost:8585/api/v1/tables/{}'.format(created_table.id.__root__))
        return 1
    else:
        requests.delete(
            'http://localhost:8585/api/v1/tables/{}'.format(created_table.id.__root__))
        return 0


def create_delete_database(client):
    data = {'jdbc': {'connectionUrl': 'hive://localhost/default', 'driverClass': 'jdbc'},
            'name': 'temp_local_hive',
            'serviceType': 'HIVE',
            'description': 'local hive env'}
    create_hive_service = CreateDatabaseServiceEntityRequest(**data)
    hive_service = client.create_database_service(create_hive_service)
    create_database_request = CreateDatabaseEntityRequest(
        name="dwh", service=EntityReference(id=hive_service.id, type="databaseService"))
    created_database = client.create_database(
        create_database_request)
    resp = create_delete_table(client)
    print(resp)
    client.delete_database(created_database.id.__root__)
    client.delete_database_service(hive_service.id.__root__)
    return resp


@pytest.fixture(scope="session")
def hive_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    port = docker_services.port_for("hive-server", 10000)
    print("HIVE is running on port {}".format(port))
    time.sleep(120)
    url = "http://localhost:8585"
    docker_services.wait_until_responsive(
        timeout=60.0, pause=0.1, check=lambda: is_responsive(url)
    )
    url = "hive://localhost:10000/"
    engine = create_engine(url)
    inspector = inspect(engine)
    return inspector


def test_check_tables(hive_service):
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
    check_tables = ["metadata_array_struct_test",
                    "metadata_struct_test",
                    "metadata_test_table",
                    "test_check"]
    tables = []
    for schema in inspector.get_schema_names():
        for table in inspector.get_table_names(schema):
            tables.append(table)
            if set(tables) == set(check_tables):
                assert 1
            else:
                assert 0


def test_check_tables():
    client = REST("http://localhost:8585/api", 'test', 'test')
    databases = client.list_databases()
    if len(databases) > 0:
        assert create_delete_table(client)
    else:
        assert create_delete_database(client)
