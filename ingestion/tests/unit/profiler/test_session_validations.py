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

"""
Test validations that need a session configured to run
"""
from datetime import datetime
from unittest import TestCase

from sqlalchemy import TEXT, Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import ColumnProfile, TableProfile
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesMissingCountToBeEqual import (
    ColumnValuesMissingCount,
)
from metadata.generated.schema.tests.column.columnValuesToBeInSet import (
    ColumnValuesToBeInSet,
)
from metadata.generated.schema.tests.column.columnValuesToBeNotInSet import (
    ColumnValuesToBeNotInSet,
)
from metadata.generated.schema.tests.column.columnValuesToMatchRegex import (
    ColumnValuesToMatchRegex,
)
from metadata.generated.schema.tests.column.columnValuesToNotMatchRegex import (
    ColumnValuesToNotMatchRegex,
)
from metadata.generated.schema.tests.table.tableCustomSQLQuery import (
    TableCustomSQLQuery,
)
from metadata.orm_profiler.interfaces.sqa_profiler_interface import SQAProfilerInterface
from metadata.orm_profiler.validations.core import validation_enum_registry

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


class SessionValidation(TestCase):
    """
    Run checks on different metrics
    """

    sqlite_conn = SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite)
    sqa_profiler_interface = SQAProfilerInterface(sqlite_conn)
    engine = sqa_profiler_interface.session.get_bind()
    session = sqa_profiler_interface.session

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        User.__table__.create(bind=cls.engine)

        data = [
            User(
                name="John",
                fullname="John Doe",
                nickname="johnny b goode",
                comments="no comments",
                age=30,
            ),
            User(
                name="Jane",
                fullname="Jone Doe",
                nickname=None,
                comments="maybe some comments",
                age=31,
            ),
        ]
        cls.session.add_all(data)
        cls.session.commit()

    def setUp(self) -> None:
        self.sqa_profiler_interface.create_sampler(User)
        self.sqa_profiler_interface.create_runner(User)

    def test_column_values_not_in_set(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="name")  # column name

        res_ok = validation_enum_registry.registry["columnValuesToBeNotInSet"](
            ColumnValuesToBeNotInSet(forbiddenValues=["random", "forbidden"]),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found countInSet=0. It should be 0.",
        )

        res_ko = validation_enum_registry.registry["columnValuesToBeNotInSet"](
            ColumnValuesToBeNotInSet(forbiddenValues=["John", "forbidden"]),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ko == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found countInSet=1. It should be 0.",
        )

        res_aborted = validation_enum_registry.registry["columnValuesToBeNotInSet"](
            ColumnValuesToBeNotInSet(forbiddenValues=["John", "forbidden"]),
            col_profile=ColumnProfile(name="random"),
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_aborted == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=(
                "Error computing ColumnValuesToBeNotInSet for users.random - Cannot find"
                + " the configured column random for ColumnValuesToBeNotInSet"
            ),
        )

    def test_column_values_to_match_regex(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="name", valuesCount=2)  # column name

        res_ok = validation_enum_registry.registry["columnValuesToMatchRegex"](
            ColumnValuesToMatchRegex(regex="J%"),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found 2 value(s) matching regex pattern vs 2 value(s) in the column.",
        )

        res_ko = validation_enum_registry.registry["columnValuesToMatchRegex"](
            ColumnValuesToMatchRegex(regex="Jo%"),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ko == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found 1 value(s) matching regex pattern vs 2 value(s) in the column.",
        )

        res_aborted = validation_enum_registry.registry["columnValuesToMatchRegex"](
            ColumnValuesToMatchRegex(regex="J%"),
            col_profile=ColumnProfile(name="name"),
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_aborted == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=(
                "We expect `valuesCount` to be informed for ColumnValuesToMatchRegex."
            ),
        )

    def test_column_values_missing_count_to_be_equal(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="nickname", nullCount=1)

        res_ok = validation_enum_registry.registry["columnValuesMissingCountToBeEqual"](
            ColumnValuesMissingCount(missingCountValue=1),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found missingCount=1.0. It should be 1.",
        )

        res_ok_2 = validation_enum_registry.registry[
            "columnValuesMissingCountToBeEqual"
        ](
            ColumnValuesMissingCount(
                missingCountValue=2,
                missingValueMatch=["johnny b goode"],
            ),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ok_2 == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found missingCount=2.0. It should be 2.",
        )

        res_ko = validation_enum_registry.registry["columnValuesMissingCountToBeEqual"](
            ColumnValuesMissingCount(
                missingCountValue=0,
            ),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ko == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found missingCount=1.0. It should be 0.",
        )

        res_aborted = validation_enum_registry.registry[
            "columnValuesMissingCountToBeEqual"
        ](
            ColumnValuesMissingCount(
                missingCountValue=0,
            ),
            col_profile=ColumnProfile(name="nickname"),
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_aborted == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=(
                "We expect `nullCount` to be informed on the profiler for ColumnValuesMissingCount."
            ),
        )

    def test_column_values_to_be_in_set(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="name")  # column name

        res_ok = validation_enum_registry.registry["columnValuesToBeInSet"](
            ColumnValuesToBeInSet(allowedValues=["random", "forbidden"]),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found countInSet=0",
        )

    def test_column_values_to_not_match_regex(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="name", valuesCount=2)  # column name

        res_ok = validation_enum_registry.registry["columnValuesToNotMatchRegex"](
            ColumnValuesToNotMatchRegex(forbiddenRegex="J%"),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            runner=self.sqa_profiler_interface.runner,
            table=User,
        )

        print(res_ok)

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found 2 matching the forbidden regex pattern. Expected 0.",
        )

    def test_table_custom_sql_query(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        table_profile = TableProfile(profileDate=EXECUTION_DATE.timestamp())

        res_ok = (
            validation_enum_registry.registry["tableCustomSQLQuery"](
                TableCustomSQLQuery(sqlExpression="SELECT * FROM users WHERE age < 10"),
                table_profile=table_profile,
                execution_date=EXECUTION_DATE,
                session=self.session,
                table=User,
            )
            or []
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found 0 row(s). Test query is expected to return 0 row.",
        )

        res_ok = (
            validation_enum_registry.registry["tableCustomSQLQuery"](
                TableCustomSQLQuery(
                    sqlExpression="SELECT * FROM users WHERE LOWER(name) LIKE '%john%'"
                ),
                table_profile=table_profile,
                execution_date=EXECUTION_DATE,
                session=self.session,
                table=User,
            )
            or []
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found 1 row(s). Test query is expected to return 0 row.",
        )
