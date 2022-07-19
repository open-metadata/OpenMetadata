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
Test Profiler behavior
"""
from unittest import TestCase

import pytest
import sqlalchemy.types
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.orm_profiler.interfaces.sqa_profiler_interface import SQAProfilerInterface
from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.ingestion.source import sqa_types
from metadata.orm_profiler.metrics.core import add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.core import MissingMetricException, Profiler
from metadata.orm_profiler.profiler.default import DefaultProfiler
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)


class ProfilerTest(TestCase):
    """
    Run checks on different metrics
    """

    sqlite_conn = SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite)
    sqa_profiler_interface = SQAProfilerInterface(sqlite_conn)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        User.__table__.create(bind=cls.sqa_profiler_interface.session.get_bind())

        data = [
            User(name="John", fullname="John Doe", nickname="johnny b goode", age=30),
            User(name="Jane", fullname="Jone Doe", nickname=None, age=31),
        ]
        cls.sqa_profiler_interface.session.add_all(data)
        cls.sqa_profiler_interface.session.commit()

    def test_default_profiler(self):
        """
        Check our pre-cooked profiler
        """
        simple = DefaultProfiler(
            profiler_interface=self.sqa_profiler_interface,
            table=User,
        )
        simple.execute()

        profile = simple.get_profile()

        assert profile.rowCount == 2
        assert profile.columnCount == 5

        age_profile = next(
            (
                col_profile
                for col_profile in profile.columnProfile
                if col_profile.name == "age"
            ),
            None,
        )

        assert age_profile == ColumnProfile(
            name="age",
            valuesCount=2,
            valuesPercentage=None,
            validCount=None,
            duplicateCount=None,
            nullCount=0,
            nullProportion=0.0,
            uniqueCount=2,
            uniqueProportion=1.0,
            min=30.0,
            max=31.0,
            minLength=None,
            maxLength=None,
            mean=30.5,
            sum=61.0,
            stddev=0.25,
            variance=None,
            distinctCount=2.0,
            distinctProportion=1.0,
            median=30.5,
            # histogram=Histogram(
            #     boundaries=["30.0 to 30.25", "31.0 to 31.25"], frequencies=[1, 1]
            # ),
        )

    def test_required_metrics(self):
        """
        Check that we raise properly MissingMetricException
        when not building the profiler with all the
        required ingredients
        """
        like = add_props(expression="J%")(Metrics.LIKE_COUNT.value)
        count = Metrics.COUNT.value
        like_ratio = Metrics.LIKE_RATIO.value

        # This should run properly
        Profiler(
            like,
            count,
            like_ratio,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
            use_cols=[User.age],
        )

        with pytest.raises(MissingMetricException):
            # We are missing ingredients here
            Profiler(
                like, like_ratio, profiler_interface=self.sqa_profiler_interface, table=User, use_cols=[User.age]
            )

    def test_skipped_types(self):
        """
        Check that we are properly skipping computations for
        not supported types
        """

        class NotCompute(Base):
            __tablename__ = "not_compute"
            id = Column(Integer, primary_key=True)
            null_col = Column(sqlalchemy.types.NULLTYPE)
            array_col = Column(sqlalchemy.ARRAY(Integer, dimensions=2))
            json_col = Column(sqlalchemy.JSON)
            map_col = Column(sqa_types.SQAMap)
            struct_col = Column(sqa_types.SQAStruct)

        profiler = Profiler(
            Metrics.COUNT.value,
            profiler_interface=self.sqa_profiler_interface,
            table=NotCompute,
            use_cols=[
                NotCompute.null_col,
                NotCompute.array_col,
                NotCompute.json_col,
                NotCompute.map_col,
                NotCompute.struct_col,
            ],
        )

        assert not profiler.column_results
