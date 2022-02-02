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

import pytest
import requests

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.client import REST

headers = {"Content-type": "application/json"}
service_name = "temp_local_postgres"
database_name = "Test_Postgres"
table_name = "test1"


def is_responsive(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return True
    except ConnectionError:
        return False


@pytest.fixture(scope="session")
def catalog_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    port = docker_services.port_for("postgres", 5432)
    print("Postgres is running on port {}".format(port))
    url = "http://localhost:8585"
    docker_services.wait_until_responsive(
        timeout=60.0, pause=0.5, check=lambda: is_responsive(url)
    )
    return url


def test_create_database_service(catalog_service):
    client = REST(catalog_service + "/api", "test", "test")
    data = {
        "databaseConnection": {"hostPort": "localhost:5432"},
        "name": "temp_local_postgres",
        "serviceType": "POSTGRES",
        "description": "local postgres env",
    }
    create_postgres_service = CreateDatabaseServiceRequest(**data)
    database_service = client.create_database_service(create_postgres_service)
    if database_service:
        assert 1
    else:
        assert 0


def test_create_table_service(catalog_service):
    client = REST(catalog_service + "/api", "test", "test")
    postgres_dbservice = client.get_database_service(service_name)
    columns = [
        Column(
            name="test",
            description="test_desc",
            columnDataType="VARCHAR",
            ordinalPosition=0,
        ),
        Column(
            name="test2",
            description="test_desc2",
            columnDataType="INT",
            ordinalPosition=1,
        ),
    ]

    create_database_request = CreateDatabaseRequest(
        name=database_name,
        service=EntityReference(id=postgres_dbservice.id, type="databaseService"),
    )
    created_database = client.create_database(create_database_request)
    table = CreateTableRequest(
        name=table_name, columns=columns, database=created_database.id.__root__
    )
    created_table = client.create_or_update_table(table)
    if created_database and created_table:
        assert 1
    else:
        assert 0


def test_check_and_delete_ingest(catalog_service):
    client = REST(catalog_service + "/api", "test", "test")
    postgres_dbservice = client.get_database_service(service_name)
    database = client.get_database_by_name("{}.{}".format(service_name, database_name))
    table = client.get_table_by_name(f"{service_name}.{database_name}.{table_name}")
    r = requests.delete(
        "http://localhost:8585/api/v1/tables/{}".format(table.id.__root__)
    )
    r.raise_for_status()
    client.delete_database(database.id.__root__)
    client.delete_database_service(postgres_dbservice.id.__root__)
