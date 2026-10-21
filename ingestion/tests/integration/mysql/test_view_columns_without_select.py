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

from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, make_url, text
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.mysql.metadata import MysqlSource

MYSQL_TEST_CONNECTION_DEFINITION = (
    Path(__file__).parents[4] / "openmetadata-service/src/main/resources/json/data/testConnections/database/mysql.json"
)
VIEW_READER = "view_reader"
VIEW_READER_PASSWORD = "view_reader_password"
CURRENT_DEPT_EMP_COLUMNS = [
    ("emp_no", "int"),
    ("dept_no", "char(4)"),
    ("from_date", "date"),
    ("to_date", "date"),
]


@pytest.fixture(scope="module")
def root_engine(mysql_container):
    url = make_url(mysql_container.get_connection_url()).set(username="root", password=mysql_container.root_password)
    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def view_reader(root_engine, grants):
    with root_engine.begin() as conn:
        conn.execute(text(f"CREATE USER '{VIEW_READER}'@'%' IDENTIFIED BY '{VIEW_READER_PASSWORD}'"))
        conn.execute(text(f"GRANT {grants} ON employees.* TO '{VIEW_READER}'@'%'"))
    yield VIEW_READER
    with root_engine.begin() as conn:
        conn.execute(text(f"DROP USER '{VIEW_READER}'@'%'"))


@pytest.fixture
def mysql_source(mysql_container, view_reader):
    metadata = MagicMock()
    metadata.get_by_name.return_value = TestConnectionDefinition.model_validate_json(
        MYSQL_TEST_CONNECTION_DEFINITION.read_text()
    )
    source = MysqlSource.create(
        {
            "type": "mysql",
            "serviceName": "mysql_view_grants",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": view_reader,
                    "authType": {"password": VIEW_READER_PASSWORD},
                    "hostPort": f"localhost:{mysql_container.get_exposed_port(mysql_container.port)}",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        },
        metadata,
    )
    source.context.get().__dict__.update(
        database_service="mysql_view_grants", database="default", database_schema="employees"
    )
    yield source
    source.close()


def select_error_code(engine) -> int | None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT * FROM employees.current_dept_emp LIMIT 1"))
    except OperationalError as err:
        return err.orig.args[0]
    return None


@pytest.mark.parametrize(
    ("grants", "select_error", "columns"),
    [
        pytest.param("SELECT, SHOW VIEW", None, CURRENT_DEPT_EMP_COLUMNS, id="describe"),
        pytest.param("SHOW VIEW, REFERENCES", 1142, CURRENT_DEPT_EMP_COLUMNS, id="references"),
        pytest.param("SHOW VIEW", 1142, [], id="show-view-only"),
    ],
)
def test_view_is_ingested_with_the_columns_its_grants_expose(mysql_source, select_error, columns):
    assert select_error_code(mysql_source.engine) == select_error

    (either,) = mysql_source.yield_table(("current_dept_emp", TableType.View))

    assert either.left is None, either.left.error
    table = either.right
    assert [(model_str(column.name), column.dataTypeDisplay) for column in table.columns] == columns
    assert "VIEW `employees`.`current_dept_emp` AS select" in model_str(table.schemaDefinition)
