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
"""Session-owned MySQL container and per-test owned source schemas."""

from contextlib import ExitStack

import pytest
from sqlalchemy import Column, Integer, Table

from metadata.generated.schema.entity.services.databaseService import DatabaseService

from .connector import MySqlContext
from .source import fresh_mysql_instance, fresh_mysql_source


@pytest.fixture(scope="session")
def mysql_instance(ci_output):
    with ExitStack() as cleanup:
        with ci_output():
            instance = cleanup.enter_context(fresh_mysql_instance())
        yield instance


@pytest.fixture(scope="session")
def mysql_container(mysql_instance):
    return mysql_instance.container


@pytest.fixture(scope="session")
def mysql_admin_engine(mysql_instance):
    return mysql_instance.admin_engine


@pytest.fixture(scope="session")
def mysql_ingestion_engine(mysql_instance):
    return mysql_instance.ingestion_engine


@pytest.fixture
def mysql_source(mysql_admin_engine):
    with fresh_mysql_source(mysql_admin_engine) as source:
        yield source


@pytest.fixture
def service_entity():
    return DatabaseService


@pytest.fixture
def mysql(mysql_source, service_name, om_server_config, om):
    return MySqlContext(source=mysql_source, service_name=service_name, server=om_server_config, om=om)


@pytest.fixture
def mysql_profile_table(mysql_source):
    table = Table(
        "profile_values",
        mysql_source.baseline.metadata,
        Column("id", Integer, primary_key=True),
        Column("score", Integer, nullable=True),
    )
    with mysql_source.admin_engine.begin() as connection:
        table.create(connection)
        connection.execute(
            table.insert(), [{"id": key, "score": score} for key, score in enumerate((10, 20, 20, None), 1)]
        )
    return table
