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
"""
End-to-end SQLAlchemy and Pandas validator tests for column names containing '+' or '%XX' (#38351).
"""

from datetime import datetime
from uuid import uuid4

import pandas as pd
import pytest
import sqlalchemy as sqa
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from metadata.data_quality.validations.column.pandas.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator as PandasNotNullValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator as SQANotNullValidator,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.processor.runner import PandasRunner, QueryRunner
from metadata.utils.entity_link import get_entity_link

TABLE_FQN = "svc.db.schema.sales_special_cols"
EXECUTION_TS = int(datetime(2026, 11, 1).timestamp() * 1000)


class _Base(DeclarativeBase):
    pass


class _SalesSpecialCols(_Base):
    __tablename__ = "sales_special_cols"
    id = sqa.Column(sqa.Integer, primary_key=True)
    total_plus_sales = sqa.Column("total+sales", sqa.Integer)
    total_space_sales = sqa.Column("total sales", sqa.Integer)
    discount_pct20 = sqa.Column("discount%20rate", sqa.Integer)
    ratio_pctff = sqa.Column("ratio%FF", sqa.Integer)


def _make_test_case(column_name: str) -> TestCase:
    return TestCase(
        name=f"not_null_{column_name}",
        entityLink=get_entity_link(Table, fqn=TABLE_FQN, column_name=column_name),  # type: ignore
        testSuite=EntityReference(id=uuid4(), type="testSuite"),  # type: ignore
        testDefinition=EntityReference(
            id=uuid4(),
            type="testDefinition",
            fullyQualifiedName="columnValuesToBeNotNull",
        ),  # type: ignore
    )


@pytest.mark.parametrize(
    "column_name,expected_status",
    [
        ("total+sales", TestCaseStatus.Success),
        ("discount%20rate", TestCaseStatus.Success),
        ("ratio%FF", TestCaseStatus.Success),
        ("total sales", TestCaseStatus.Failed),
    ],
)
def test_sqa_validator_targets_literal_column_with_plus_and_percent(column_name, expected_status):
    """SQLAlchemy validator resolves 'total+sales' and '%XX' verbatim without hitting 'total sales'."""
    engine = sqa.create_engine("sqlite:///:memory:")
    _Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        session.add_all(
            [
                _SalesSpecialCols(
                    id=1,
                    total_plus_sales=100,
                    total_space_sales=None,
                    discount_pct20=10,
                    ratio_pctff=5,
                ),
                _SalesSpecialCols(
                    id=2,
                    total_plus_sales=200,
                    total_space_sales=None,
                    discount_pct20=20,
                    ratio_pctff=15,
                ),
            ]
        )
        session.commit()

        runner = QueryRunner(
            session=session,
            dataset=_SalesSpecialCols,
            raw_dataset=_SalesSpecialCols.__table__,
        )
        validator = SQANotNullValidator(
            runner,
            test_case=_make_test_case(column_name),
            execution_date=EXECUTION_TS,
        )
        result = validator.run_validation()
        assert result.testCaseStatus == expected_status
    finally:
        session.close()
        engine.dispose()


@pytest.mark.parametrize(
    "column_name,expected_status",
    [
        ("total+sales", TestCaseStatus.Success),
        ("discount%20rate", TestCaseStatus.Success),
        ("ratio%FF", TestCaseStatus.Success),
        ("total sales", TestCaseStatus.Failed),
    ],
)
def test_pandas_validator_targets_literal_column_with_plus_and_percent(column_name, expected_status):
    """Pandas validator resolves 'total+sales' and '%XX' verbatim without hitting 'total sales'."""
    df = pd.DataFrame(
        {
            "id": [1, 2],
            "total+sales": [100, 200],
            "total sales": [None, None],
            "discount%20rate": [10, 20],
            "ratio%FF": [5, 15],
        }
    )
    runner = PandasRunner.from_dataframe(df)
    validator = PandasNotNullValidator(
        runner,
        test_case=_make_test_case(column_name),
        execution_date=EXECUTION_TS,
    )
    result = validator.run_validation()
    assert result.testCaseStatus == expected_status
