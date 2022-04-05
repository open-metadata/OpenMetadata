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

import time

import pytest
import requests
from requests.exceptions import ConnectionError
from sqlalchemy.engine import create_engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column
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


def create_delete_table(client: OpenMetadata):
    databases = client.list_entities(entity=Database).entities
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
        requests.delete(
            "http://localhost:8585/api/v1/tables/{}".format(created_table.id.__root__)
        )
        return 1
    else:
        requests.delete(
            "http://localhost:8585/api/v1/tables/{}".format(created_table.id.__root__)
        )
        return 0


def create_delete_database(client: OpenMetadata):
    data = {
        "databaseConnection": {"hostPort": "localhost"},
        "name": "temp_local_mysql",
        "serviceType": "MySQL",
        "description": "local mysql env",
    }
    create_mysql_service = CreateDatabaseServiceRequest(**data)
    mysql_service = client.create_or_update(create_mysql_service)
    create_database_request = CreateDatabaseRequest(
        name="dwh", service=EntityReference(id=mysql_service.id, type="databaseService")
    )
    created_database = client.create_or_update(create_database_request)
    resp = create_delete_table(client)
    print(resp)
    client.delete(entity=Database, entity_id=str(created_database.id.__root__))
    client.delete(entity=DatabaseService, entity_id=str(mysql_service.id.__root__))
    return resp


@pytest.fixture(scope="session")
def catalog_service(docker_ip, docker_services):
    """Ensure that Docker service is up and responsive."""
    port = docker_services.port_for("db", 3306)
    print("Mysql is running on port {}".format(port))
    url = "http://localhost:8585"
    time.sleep(30)
    docker_services.wait_until_responsive(
        timeout=30.0, pause=0.5, check=lambda: is_responsive(url)
    )
    return url


def test_check_tables(catalog_service):
    metadata_config = MetadataServerConfig.parse_obj(
        {"api_endpoint": catalog_service + "/api", "auth_provider_type": "no-auth"}
    )
    client = OpenMetadata(metadata_config)
    assert create_delete_database(client)


def test_read_schema():
    url = "mysql+pymysql://catalog_user:catalog_password@localhost:3307"
    # pool_recycle to avoid the occasional "Lost connection to MySQL server during query" error
    # when host machine is slow
    engine = create_engine(url, pool_recycle=1)
    inspector = inspect(engine)
    schemas = []
    for schema in inspector.get_schema_names():
        schemas.append(schema)
    if "catalog_test" in schemas:
        assert 1
    else:
        assert 0
