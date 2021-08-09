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

import time
from metadata.ingestion.ometa.client import REST
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceEntityRequest
from metadata.generated.schema.api.data.createTable import CreateTableEntityRequest
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseEntityRequest

import pytest
import requests
from requests.exceptions import ConnectionError
from sqlalchemy.engine import create_engine
from sqlalchemy.inspection import inspect


def is_responsive(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return True
    except ConnectionError:
        return False


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
    data = {'jdbc': {'connectionUrl': 'mysql://localhost/catalog_db', 'driverClass': 'jdbc'},
            'name': 'temp_local_mysql',
            'serviceType': 'MYSQL',
            'description': 'local mysql env'}
    create_mysql_service = CreateDatabaseServiceEntityRequest(**data)
    mysql_service = client.create_database_service(create_mysql_service)
    create_database_request = CreateDatabaseEntityRequest(
        name="dwh", service=EntityReference(id=mysql_service.id, type="databaseService"))
    created_database = client.create_database(
        create_database_request)
    resp = create_delete_table(client)
    print(resp)
    client.delete_database(created_database.id.__root__)
    client.delete_database_service(mysql_service.id.__root__)
    return resp


@pytest.fixture(scope="session")
def catalog_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    port = docker_services.port_for("db", 3306)
    print("Mysql is running on port {}".format(port))
    url = "http://localhost:8585"
    time.sleep(420)
    docker_services.wait_until_responsive(
        timeout=60.0, pause=0.5, check=lambda: is_responsive(url)
    )
    return url


def test_check_tables(catalog_service):
    client = REST(catalog_service + "/api", 'test', 'test')
    databases = client.list_databases()
    if len(databases) > 0:
        assert create_delete_table(client)
    else:
        assert create_delete_database(client)


def test_read_schema():
    url = "mysql+pymysql://catalog_user:catalog_password@localhost:3307"
    engine = create_engine(url)
    inspector = inspect(engine)
    schemas = []
    for schema in inspector.get_schema_names():
        schemas.append(schema)
    if "catalog_test" in schemas:
        assert 1
    else:
        assert 0
