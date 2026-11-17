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
"""Runner timeout wrapping must defer physical-table resolution until each case runs."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, text

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import SQATestSuiteInterface
from metadata.generated.schema.configuration.profilerConfiguration import SampleDataIngestionConfig
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import SQLiteConnection
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import EntityType, TestDefinition
from metadata.sampler.sqlalchemy.sampler import SQASampler


@pytest.fixture
def source(monkeypatch):
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE amounts (amount INT)"))
        connection.execute(text("INSERT INTO amounts VALUES (10), (-1), (20)"))
    checkouts = []
    event.listen(engine, "checkout", lambda *args: checkouts.append(True))
    for module in [
        "metadata.sampler.sqlalchemy.sampler",
        "metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface",
    ]:
        monkeypatch.setattr(module + ".get_ssl_connection", lambda _: engine)
    yield engine, checkouts
    engine.dispose()


@pytest.mark.parametrize("entity_type", [EntityType.COLUMN, EntityType.TABLE])
@pytest.mark.parametrize("raw_kind", ["valid", "columnless", "unsupported"])
@pytest.mark.parametrize("limit", [0, -10])
def test_constructed_suite_defers_table_resolution_and_reports_case_result(source, entity_type, raw_kind, limit):
    _, checkouts = source
    service = {"id": uuid4(), "type": "databaseService"}
    database = Database(id=uuid4(), name="metadata_label", service=service)
    table = Table(
        id=uuid4(),
        name="amounts",
        serviceType="SQLite",
        service=service,
        database={"id": database.id, "type": "database"},
        databaseSchema={"id": uuid4(), "type": "databaseSchema"},
        fullyQualifiedName="service.metadata_label.main.amounts",
        columns=[] if raw_kind == "columnless" else [{"name": "amount", "dataType": "INT"}],
    )
    definition = TestDefinition(
        id=uuid4(),
        name="noNegativeAmounts",
        fullyQualifiedName="noNegativeAmounts",
        description="Amounts must not be negative",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        validatorClass=f"{entity_type.value.title()}RuleLibrarySqlExpressionValidator",
        parameterDefinition=[{"name": "limit", "dataType": "INT"}],
        sqlExpression=(
            "SELECT * FROM {{ table_name }} WHERE {{ column_name }} < {{ limit }}"
            if entity_type is EntityType.COLUMN
            else "SELECT * FROM {{ table_name }} WHERE amount < {{ limit }}"
        ),
    )
    metadata = MagicMock()
    metadata.get_by_name.return_value = definition
    metadata.get_by_id.side_effect = lambda entity, *args, **kwargs: database if entity is Database else definition
    config = SQLiteConnection()
    sampler = SQASampler(config, metadata, table)
    if raw_kind == "columnless":
        assert sampler.raw_dataset is None
    if raw_kind == "unsupported":
        sampler._table = object()
    suite = None
    try:
        suite = SQATestSuiteInterface(
            config,
            metadata,
            sampler,
            table,
            validator_builder=ValidatorBuilder,
            sample_data_config=SampleDataIngestionConfig(storeSampleData=False),
        )
        assert checkouts == []
        link = "<#E::table::service.metadata_label.main.amounts"
        link += "::columns::amount>" if entity_type is EntityType.COLUMN else ">"
        case = TestCase(
            name="no_negative_amounts",
            entityLink=link,
            testDefinition={"id": definition.id, "type": "testDefinition", "fullyQualifiedName": "noNegativeAmounts"},
            testSuite={"id": uuid4(), "type": "testSuite"},
            parameterValues=[{"name": "limit", "value": str(limit)}],
        )
        result = suite.run_test_case(case).testCaseResult
        if raw_kind == "valid":
            assert result.testCaseStatus is (TestCaseStatus.Failed if limit == 0 else TestCaseStatus.Success)
            assert result.testResultValue[0].value == ("1" if limit == 0 else "0")
            assert checkouts
        else:
            assert result.testCaseStatus is TestCaseStatus.Aborted
            assert "physical SQLAlchemy Table" in result.result
            assert checkouts == []
    finally:
        if suite:
            suite.session.close()
        sampler.session_factory.remove()
