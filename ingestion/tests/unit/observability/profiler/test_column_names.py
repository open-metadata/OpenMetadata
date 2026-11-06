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

"""Column names exposed by profiling and data quality retain database identity."""

from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Session

from metadata.data_quality.validations.table.sqlalchemy.tableColumnNameToExist import (
    TableColumnNameToExistValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableColumnToMatchSet import (
    TableColumnToMatchSetValidator,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.static.column_names import ColumnNames
from metadata.profiler.orm.functions.table_metric_computer import (
    BaseTableMetricComputer,
    InformixTableMetricComputer,
    TimescaleTableMetricComputer,
    TrinoTableMetricComputer,
)
from metadata.profiler.processor.runner import QueryRunner

COLUMN_NAMES = ["__hevo_id", "_sa_special", "metadata", "metadata_", "MixedCase", "om_col___hevo_id"]


@pytest.fixture
def runner():
    class Base(DeclarativeBase):
        pass

    class Model(Base):
        __tablename__ = "column_names"
        om_col___hevo_id = Column("__hevo_id", Integer, primary_key=True)
        om_col__sa_special = Column("_sa_special", Integer)
        metadata_ = Column("metadata", Integer)
        metadata__ = Column("metadata_", Integer)
        MixedCase = Column("MixedCase", Integer, key="mixedcase")
        om_col___hevo_id_ = Column("om_col___hevo_id", Integer)

    engine = create_engine("sqlite://")
    try:
        with Session(engine) as session:
            yield QueryRunner(session=session, dataset=Model, raw_dataset=Model)
    finally:
        engine.dispose()


def test_column_names_metric_preserves_source_names(runner):
    metric = add_props(table=runner.table)(ColumnNames)()
    result = runner._session.execute(select(metric.fn())).scalar_one()
    assert result.split(",") == COLUMN_NAMES


@pytest.mark.parametrize("computer_class", [BaseTableMetricComputer, InformixTableMetricComputer])
def test_catalog_metric_expressions_preserve_source_names(runner, computer_class):
    computer = computer_class(runner, [], None, None)
    result = runner._session.execute(select(*computer._get_col_names_and_count())).one()
    assert result.columnNames.split(",") == COLUMN_NAMES
    assert result.columnCount == len(COLUMN_NAMES)


def test_stats_metrics_preserve_source_names(runner):
    result = TrinoTableMetricComputer(runner, [], None, None)._build_result(7)
    assert result.columnNames.split(",") == COLUMN_NAMES
    assert result.columnCount == len(COLUMN_NAMES)
    assert result.rowCount == 7


def test_timescale_metrics_preserve_source_names(runner):
    computer = TimescaleTableMetricComputer(runner, [], None, None)
    computer._set_table_and_schema_name()
    responses = [Mock(), Mock()]
    responses[0].first.return_value = (1,)
    responses[1].first.return_value = SimpleNamespace(row_count=7, size_bytes=100)
    with patch.object(runner._session, "execute", side_effect=responses):
        result = computer.compute()
    assert result.columnNames.split(",") == COLUMN_NAMES
    assert result.columnCount == len(COLUMN_NAMES)
    assert result.rowCount == 7


def make_test_case(parameters):
    return TestCase(
        name="column_names_test",
        entityLink="<#E::table::service.database.schema.table>",
        testDefinition={"id": uuid4(), "type": "testDefinition"},
        testSuite={"id": uuid4(), "type": "testSuite"},
        parameterValues=[{"name": name, "value": value} for name, value in parameters.items() if value is not None],
    )


@pytest.mark.parametrize("column_name", [*COLUMN_NAMES, "missing", "metadata__"])
def test_column_name_to_exist_uses_source_names(runner, column_name):
    validator = TableColumnNameToExistValidator(runner, make_test_case({"columnName": column_name}), 0)
    result = validator.run_validation()
    expected = TestCaseStatus.Success if column_name in COLUMN_NAMES else TestCaseStatus.Failed
    assert result.testCaseStatus == expected


@pytest.mark.parametrize(
    "names, ordered, expected",
    [
        (COLUMN_NAMES, "true", TestCaseStatus.Success),
        (list(reversed(COLUMN_NAMES)), None, TestCaseStatus.Success),
        (list(reversed(COLUMN_NAMES)), "true", TestCaseStatus.Failed),
        (COLUMN_NAMES[:-1], None, TestCaseStatus.Failed),
    ],
)
def test_column_match_set_uses_source_names(runner, names, ordered, expected):
    validator = TableColumnToMatchSetValidator(
        runner, make_test_case({"columnNames": ",".join(names), "ordered": ordered}), 0
    )
    assert validator.run_validation().testCaseStatus == expected


@pytest.mark.parametrize("validator_class", [TableColumnNameToExistValidator, TableColumnToMatchSetValidator])
def test_column_name_validators_reject_empty_columns(runner, validator_class):
    runner.raw_dataset = Table("empty", MetaData())
    validator = validator_class(runner, make_test_case({}), 0)
    with pytest.raises(ValueError, match=r"Column names.*returned None"):
        validator._run_results()
