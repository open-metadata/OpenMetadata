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

from ..features.database.entities import table_has_foreign_key, table_query
from ..runtime.case import WorkflowCase, run_and_check
from .cases import catalog_case, procedures_have_bodies
from .connector import mysql_invocation
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
def mysql_case(mysql_source, service_name, om_server_config, om):
    return catalog_case(source=mysql_source, service_name=service_name, server=om_server_config, om=om)


@pytest.fixture(
    params=[
        pytest.param("catalog", marks=pytest.mark.e2e_contract("catalog.metadata")),
        pytest.param("procedure-bodies", marks=pytest.mark.e2e_contract("procedure.code")),
        pytest.param("foreign-key", marks=pytest.mark.e2e_contract("fk.relationships")),
    ]
)
def workflow_case(request, mysql_case, mysql_source, service_name, om):
    if request.param == "catalog":
        return mysql_case
    if request.param == "procedure-bodies":
        return WorkflowCase(mysql_case.invocation, mysql_case.persisted, procedures_have_bodies)
    base = f"{service_name}.default.{mysql_source.schema}"
    return WorkflowCase(
        mysql_case.invocation,
        table_query(om, f"{base}.transactions"),
        table_has_foreign_key(("customer_id",), (f"{base}.customers.id",)),
    )


@pytest.fixture
def mysql_filter_case(mysql_source, service_name, om_server_config, om):
    def build(filters, expected_tables):
        return catalog_case(
            source=mysql_source,
            service_name=service_name,
            server=om_server_config,
            om=om,
            filters=filters,
            tables=expected_tables,
        )

    return build


@pytest.fixture
def mysql_run(mysql_source, service_name, om_server_config):
    def invocation(options, filters=None):
        return mysql_invocation(
            service_name=service_name,
            sources=(mysql_source,),
            options=options,
            filters=filters or {},
            server=om_server_config,
        )

    return invocation


@pytest.fixture
def mysql_metadata(cli, mysql_case):
    run_and_check(cli, mysql_case)


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
