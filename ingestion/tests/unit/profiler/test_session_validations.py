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

from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesToBeNotInSet import (
    ColumnValuesToBeNotInSet,
)
from metadata.generated.schema.tests.column.columnValuesToMatchRegex import (
    ColumnValuesToMatchRegex,
)
from metadata.orm_profiler.validations.core import validate
from metadata.utils.engines import create_and_bind_session

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


class MetricsTest(TestCase):
    """
    Run checks on different metrics
    """

    engine = create_engine("sqlite+pysqlite:///:memory:", echo=False, future=True)
    session = create_and_bind_session(engine)

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

    def test_column_values_not_in_set(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="name")  # column name

        res_ok = validate(
            ColumnValuesToBeNotInSet(forbiddenValues=["random", "forbidden"]),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            session=self.session,
            table=User,
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found countInSet=0. It should be 0.",
        )

        res_ko = validate(
            ColumnValuesToBeNotInSet(forbiddenValues=["John", "forbidden"]),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            session=self.session,
            table=User,
        )

        assert res_ko == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found countInSet=1. It should be 0.",
        )

        res_aborted = validate(
            ColumnValuesToBeNotInSet(forbiddenValues=["John", "forbidden"]),
            col_profile=ColumnProfile(name="random"),
            execution_date=EXECUTION_DATE,
            session=self.session,
            table=User,
        )

        assert res_aborted == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=(
                "Error computing ColumnValuesToBeNotInSet for random - Cannot find"
                + " the configured column random for ColumnValuesToBeNotInSet"
            ),
        )

    def test_column_values_to_match_regex(self):
        """
        Check that the metric runs and the results are correctly validated
        """
        column_profile = ColumnProfile(name="name", valuesCount=2)  # column name

        res_ok = validate(
            ColumnValuesToMatchRegex(regex="J%"),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            session=self.session,
            table=User,
        )

        assert res_ok == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Success,
            result="Found likeCount=2 & valuesCount=2.0. They should be equal.",
        )

        res_ko = validate(
            ColumnValuesToMatchRegex(regex="Jo%"),
            col_profile=column_profile,
            execution_date=EXECUTION_DATE,
            session=self.session,
            table=User,
        )

        assert res_ko == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Failed,
            result="Found likeCount=1 & valuesCount=2.0. They should be equal.",
        )

        res_aborted = validate(
            ColumnValuesToMatchRegex(regex="J%"),
            col_profile=ColumnProfile(name="name"),
            execution_date=EXECUTION_DATE,
            session=self.session,
            table=User,
        )

        assert res_aborted == TestCaseResult(
            executionTime=EXECUTION_DATE.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=(
                "We expect `valuesCount` to be informed for ColumnValuesToMatchRegex."
            ),
        )
