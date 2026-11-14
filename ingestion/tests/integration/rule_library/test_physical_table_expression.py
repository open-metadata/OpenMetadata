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
"""Source execution without a metadata server; full workflow acceptance is separate."""

from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from testcontainers.clickhouse import ClickHouseContainer
from testcontainers.mysql import MySqlContainer
from testcontainers.postgres import PostgresContainer

from metadata.data_quality.validations.column.sqlalchemy.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator,
)
from metadata.data_quality.validations.models import RuleLibrarySqlExpressionRuntimeParameters
from metadata.data_quality.validations.table.sqlalchemy.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import EntityType, TestCaseParameterDefinition, TestDefinition
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.processor.runner import QueryRunner


@pytest.fixture(scope="module", params=["postgres", "mysql", "clickhouse"])
def source_engines(request):
    kind = request.param
    containers = {
        "postgres": lambda: PostgresContainer("postgres:16", dbname="col7374_target"),
        "mysql": lambda: MySqlContainer("mysql:8.4.5", dialect="pymysql", username="root", dbname="col7374_target"),
        "clickhouse": lambda: ClickHouseContainer("clickhouse/clickhouse-server:24.8", dbname="col7374_target"),
    }
    with containers[kind]() as container:
        url = make_url(container.get_connection_url())
        if kind == "clickhouse":
            url = url.set(drivername="clickhouse+http", port=int(container.get_exposed_port(8123)))
        target = create_engine(url)
        admin = target.execution_options(isolation_level="AUTOCOMMIT") if kind == "postgres" else target
        with admin.connect() as connection:
            connection.execute(text("CREATE DATABASE col7374_decoy"))
            connection.commit()
        decoy = create_engine(url.set(database="col7374_decoy"))
        try:
            yield kind, target, decoy
        finally:
            target.dispose()
            decoy.dispose()


def make_case(kind, level, label, limit, percentage):
    entity_type = EntityType.COLUMN if level == "column" else EntityType.TABLE
    definitions = [TestCaseParameterDefinition(name="limit", dataType="INT")]
    values = [TestCaseParameterValue(name="limit", value=limit)]
    if percentage:
        definitions += [
            TestCaseParameterDefinition(name="threshold", dataType="NUMBER"),
            TestCaseParameterDefinition(name="thresholdUnit", dataType="STRING"),
        ]
        values += [
            TestCaseParameterValue(name="threshold", value="25"),
            TestCaseParameterValue(name="thresholdUnit", value="PERCENTAGE"),
        ]
    definition = TestDefinition(
        id=uuid4(),
        name="col7374",
        description="Physical source selection",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        parameterDefinition=definitions,
        sqlExpression="SELECT * FROM {{ table_name }} WHERE amount < {{ limit }}",
    )
    configs = {
        "postgres": {"type": "Postgres", "username": "test", "hostPort": "localhost:5432", "database": "col7374_decoy"},
        "mysql": {"type": "Mysql", "username": "test", "hostPort": "localhost:3306"},
        "clickhouse": {"type": "Clickhouse", "username": "test", "hostPort": "localhost:8123"},
    }
    runtime = RuleLibrarySqlExpressionRuntimeParameters(
        conn_config=DatabaseConnection(config=configs[kind]), test_definition=definition
    )
    values.append(
        TestCaseParameterValue(name=RuleLibrarySqlExpressionRuntimeParameters.__name__, value=runtime.model_dump_json())
    )
    link = f'<#E::table::"dotted.service".{label}.wrong.wrong'
    link += "::columns::amount>" if level == "column" else ">"
    return TestCase(
        name="col7374",
        entityLink=link,
        testSuite=EntityReference(id=uuid4(), type="testSuite"),
        testDefinition=EntityReference(id=uuid4(), type="testDefinition"),
        parameterValues=values,
    )


@pytest.mark.parametrize("level", ["column", "table"])
@pytest.mark.parametrize("label", ["default", "reporting"])
@pytest.mark.parametrize("physical_name", ["Order.Items", "select", "rate%:amount"])
@pytest.mark.parametrize("limit,percentage", [("0", False), ("-10", False), ("0", True)])
def test_rule_and_denominator_read_the_same_source(source_engines, level, label, physical_name, limit, percentage):
    from sqlalchemy import func

    kind, target, decoy = source_engines
    schema = "public" if kind == "postgres" else "col7374_target"
    physical = Table(physical_name, MetaData(), Column("amount", Integer), schema=schema)
    decoy_table = Table(
        physical_name, MetaData(), Column("amount", Integer), schema="public" if kind == "postgres" else "col7374_decoy"
    )
    for engine, table, rows in [(target, physical, [10, -1, 20]), (decoy, decoy_table, [-1, -2] + [10] * 8)]:
        reference = str(table.compile(dialect=engine.dialect, compile_kwargs={"asfrom": True}))
        # DDL has no user values; exec_driver_sql avoids TextClause's colon parsing.
        with engine.begin() as connection:
            connection.exec_driver_sql(f"DROP TABLE IF EXISTS {reference}")
            suffix = " ENGINE = MergeTree ORDER BY tuple()" if kind == "clickhouse" else ""
            connection.exec_driver_sql(f"CREATE TABLE {reference} (amount INTEGER){suffix}")
            # ClickHouse executemany interpolates only VALUES, leaving escaped identifier percents doubled.
            for amount in rows:
                connection.execute(table.insert(), {"amount": amount})
            assert connection.execute(select(func.count()).select_from(table)).scalar() == len(rows)
    with Session(target) as session:
        runner = QueryRunner(session, decoy_table, physical, profile_sample_query="SELECT * FROM decoy")
        validator_class = (
            ColumnRuleLibrarySqlExpressionValidator if level == "column" else TableRuleLibrarySqlExpressionValidator
        )
        validator = validator_class(
            runner, make_case(kind, level, label, limit, percentage), int(datetime.now().timestamp() * 1000)
        )
        result = validator.run_validation()
        assert result.testCaseStatus == (TestCaseStatus.Success if limit == "-10" else TestCaseStatus.Failed)
        assert result.testResultValue[0].value == ("0" if limit == "-10" else "1")
        assert runner.get_table_reference() in result.result
        if percentage:
            assert result.failedRows == 1
            assert result.passedRows == 2
            assert "out of 3 evaluated (33.33%)" in result.result
