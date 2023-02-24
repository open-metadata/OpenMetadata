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
import os
from concurrent.futures import TimeoutError
from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy.types
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.api.data.createTableProfile import (
    CreateTableProfileRequest,
)
from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    ColumnProfile,
    DataType,
    Table,
    TableProfile,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.ingestion.source import sqa_types
from metadata.profiler.profiler.interface.sqlalchemy.sqa_profiler_interface import SQAProfilerInterface
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.profiler.core import MissingMetricException, Profiler
from metadata.profiler.profiler.default import DefaultProfiler

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

    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
    )
    sqlite_conn = SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=db_path + "?check_same_thread=False",
    )

    table_entity = Table(
        id=uuid4(),
        name="user",
        columns=[
            EntityColumn(
                name=ColumnName(__root__="id"),
                dataType=DataType.INT,
            )
        ],
    )
    with patch.object(
        SQAProfilerInterface, "_convert_table_to_orm_object", return_value=User
    ):
        sqa_profiler_interface = SQAProfilerInterface(
                sqlite_conn,
                None,
                table_entity,
                None,
                None,
                None,
                None,
        )

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
        )
        simple.compute_metrics()

        profile = simple.get_profile()

        assert profile.tableProfile.rowCount == 2
        assert profile.tableProfile.columnCount == 5

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
            timestamp=datetime.now(tz=timezone.utc).timestamp()
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
        )

        with pytest.raises(MissingMetricException):
            # We are missing ingredients here
            Profiler(
                like,
                like_ratio,
                profiler_interface=self.sqa_profiler_interface,
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
        )

        assert not profiler.column_results

    def test__check_profile_and_handle(self):
        """test _check_profile_and_handle returns as expected"""
        profiler = Profiler(
            Metrics.COUNT.value,
            profiler_interface=self.sqa_profiler_interface,
        )

        profile = profiler._check_profile_and_handle(
            CreateTableProfileRequest(
                tableProfile=TableProfile(
                    timestamp=datetime.now().timestamp(), columnCount=10
                )
            )
        )

        assert profile.tableProfile.columnCount == 10

        with pytest.raises(Exception):
            profiler._check_profile_and_handle(
                CreateTableProfileRequest(
                    tableProfile=TableProfile(
                        timestamp=datetime.now().timestamp(), profileSample=100
                    )
                )
            )

    def test_profiler_with_timeout(self):
        """check timeout is properly used"""

        with patch.object(
            SQAProfilerInterface, "_convert_table_to_orm_object", return_value=User
        ):
            sqa_profiler_interface = SQAProfilerInterface(
                    self.sqlite_conn,
                    None,
                    self.table_entity,
                    None,
                    None,
                    None,
                    None,
                    timeout_seconds=0,
            )

        simple = DefaultProfiler(
            profiler_interface=sqa_profiler_interface,
        )

        with pytest.raises(TimeoutError):
            simple.compute_metrics()

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
