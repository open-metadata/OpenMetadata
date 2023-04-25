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
Test Metrics behavior
"""
import datetime
import os
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import TEXT, Column, Date, DateTime, Integer, String, Time
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.profiler.interface.sqlalchemy.sqa_profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.processor.core import Profiler

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)
    dob = Column(DateTime)  # date of birth
    tob = Column(Time)  # time of birth
    doe = Column(Date)  # date of employment


class MetricsTest(TestCase):
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

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """

        with patch.object(
            SQAProfilerInterface, "_convert_table_to_orm_object", return_value=User
        ):
            cls.sqa_profiler_interface = SQAProfilerInterface(
                cls.sqlite_conn,
                None,
                cls.table_entity,
                None,
                None,
                None,
                None,
                thread_count=1,
            )
        cls.engine = cls.sqa_profiler_interface.session.get_bind()

        User.__table__.create(bind=cls.engine)

        data = [
            User(
                name="John",
                fullname="John Doe",
                nickname="johnny b goode",
                comments="no comments",
                age=30,
                dob=datetime.datetime(1992, 5, 17),
                tob=datetime.time(11, 2, 32),
                doe=datetime.date(2020, 1, 12),
            ),
            User(
                name="Jane",
                fullname="Jone Doe",
                nickname=None,
                comments="maybe some comments",
                age=31,
                dob=datetime.datetime(1991, 4, 4),
                tob=datetime.time(10, 1, 31),
                doe=datetime.date(2009, 11, 11),
            ),
            User(
                name="John",
                fullname="John Doe",
                nickname=None,
                comments=None,
                age=None,
                dob=datetime.datetime(1982, 2, 2),
                tob=datetime.time(9, 3, 25),
                doe=datetime.date(2012, 12, 1),
            ),
        ]
        cls.sqa_profiler_interface.session.add_all(data)
        cls.sqa_profiler_interface.session.commit()

    def test_count(self):
        """
        Check the Count metric
        """
        count = Metrics.COUNT.value
        profiler = Profiler(
            count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.name.name).get(Metrics.COUNT.name) == 3

    def test_min(self):
        """
        Check the Min metric
        """
        min_age = Metrics.MIN.value
        profiler = Profiler(
            min_age,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.age.name).get(Metrics.MIN.name) == 30

    def test_std(self):
        """
        Check STD metric
        """
        std_age = Metrics.STDDEV.value
        profiler = Profiler(
            std_age,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        # SQLITE STD custom implementation returns the squared STD.
        # Only useful for testing purposes
        assert res.get(User.age.name).get(Metrics.STDDEV.name) == 0.25

    def test_earliest_time(self):
        """
        Check Earliest Time Metric
        """
        earliest_time = Metrics.MIN.value
        profiler = Profiler(
            earliest_time,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert (
            res.get(User.dob.name).get(Metrics.MIN.name) == "1982-02-02 00:00:00.000000"
        )
        assert res.get(User.tob.name).get(Metrics.MIN.name) == "09:03:25.000000"
        assert res.get(User.doe.name).get(Metrics.MIN.name) == "2009-11-11"

    def test_latest_time(self):
        """
        Check Latest Time Metric
        """
        latest_time = Metrics.MAX.value
        profiler = Profiler(
            latest_time,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert (
            res.get(User.dob.name).get(Metrics.MAX.name) == "1992-05-17 00:00:00.000000"
        )
        assert res.get(User.tob.name).get(Metrics.MAX.name) == "11:02:32.000000"
        assert res.get(User.doe.name).get(Metrics.MAX.name) == "2020-01-12"

    def test_null_count(self):
        """
        Check null count
        """
        null_count = Metrics.NULL_COUNT.value
        profiler = Profiler(
            null_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        assert res.get(User.nickname.name).get(Metrics.NULL_COUNT.name) == 2

    def test_null_ratio(self):
        """
        Check composed metric run
        """
        count = Metrics.COUNT.value
        null_count = Metrics.NULL_COUNT.value

        # Build the ratio based on the other two metrics
        null_ratio = Metrics.NULL_RATIO.value

        profiler = Profiler(
            count,
            null_count,
            null_ratio,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert (
            str(round(res.get(User.nickname.name).get(Metrics.NULL_RATIO.name), 2))
            == "0.67"
        )

    def test_table_row_count(self):
        """
        Check Table Metric run
        """
        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 3

    def test_table_column_count(self):
        """
        Check Column Count metric
        """
        col_count = add_props(table=User)(Metrics.COLUMN_COUNT.value)
        profiler = Profiler(
            col_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.COLUMN_COUNT.name) == 9

    def test_avg(self):
        """
        Check avg for distinct types
        """

        # Integer
        avg = Metrics.MEAN.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MEAN.name] == 30.5

        # String
        avg = Metrics.MEAN.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MEAN.name] == 4.0

        # Text
        avg = Metrics.MEAN.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MEAN.name] == 15.0

    def test_duplicate_count(self):
        """
        Check composed duplicate count
        """
        count = Metrics.COUNT.value
        unique = Metrics.DISTINCT_COUNT.value
        dup_count = Metrics.DUPLICATE_COUNT.value
        res = (
            Profiler(
                count,
                unique,
                dup_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.DUPLICATE_COUNT.name] == 0

    def test_histogram(self):
        """
        Check histogram computation
        """

        hist = Metrics.HISTOGRAM.value
        count = Metrics.COUNT.value
        min = Metrics.MIN.value
        max = Metrics.MAX.value
        first_quartile = Metrics.FIRST_QUARTILE.value
        third_quartile = Metrics.THIRD_QUARTILE.value
        iqr = Metrics.IQR.value

        res = (
            Profiler(
                hist,
                count,
                min,
                max,
                first_quartile,
                third_quartile,
                iqr,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        age_histogram = res.get(User.age.name)[Metrics.HISTOGRAM.name]
        id_histogram = res.get(User.id.name)[Metrics.HISTOGRAM.name]

        assert age_histogram
        assert len(age_histogram["frequencies"]) == 1
        assert id_histogram
        assert len(id_histogram["frequencies"]) == 2

    def test_like_count(self):
        """
        Check LIKE count
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        like = add_props(expression="J%")(Metrics.LIKE_COUNT.value)
        res = (
            Profiler(
                like,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.LIKE_COUNT.name] == 3

        like = add_props(expression="Jo%")(Metrics.LIKE_COUNT.value)
        res = (
            Profiler(
                like,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.LIKE_COUNT.name] == 2

    def test_ilike_count(self):
        """
        Check ILIKE count: case-insensitive LIKE
        """
        ilike = add_props(expression="j%")(Metrics.ILIKE_COUNT.value)
        res = (
            Profiler(
                ilike,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.ILIKE_COUNT.name] == 3

        ilike = add_props(expression="ja%")(Metrics.ILIKE_COUNT.value)
        res = (
            Profiler(
                ilike,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.ILIKE_COUNT.name] == 1

    def test_like_ratio(self):
        """
        Check LIKE ratio
        """
        like = add_props(expression="J%")(Metrics.LIKE_COUNT.value)
        count = Metrics.COUNT.value
        like_ratio = Metrics.LIKE_RATIO.value
        res = (
            Profiler(
                like,
                count,
                like_ratio,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.LIKE_RATIO.name] == 1.0

    def test_ilike_ratio(self):
        """
        Check LIKE ratio
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        ilike = add_props(expression="J%")(Metrics.ILIKE_COUNT.value)
        count = Metrics.COUNT.value
        ilike_ratio = Metrics.ILIKE_RATIO.value
        res = (
            Profiler(
                ilike,
                count,
                ilike_ratio,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.ILIKE_RATIO.name] == 1.0

    def test_max(self):
        """
        Check MAX metric
        """
        _max = Metrics.MAX.value

        res = (
            Profiler(
                _max,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MAX.name] == 31

    def test_min_length(self):
        """
        Check MIN_LENGTH metric
        """

        min_length = Metrics.MIN_LENGTH.value

        # Integer
        res = (
            Profiler(
                min_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.MIN_LENGTH.name) is None

        # String
        res = (
            Profiler(
                min_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MIN_LENGTH.name] == 4

        # Text
        res = (
            Profiler(
                min_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MIN_LENGTH.name] == 11

    def test_max_length(self):
        """
        Check MAX_LENGTH metric
        """
        max_length = Metrics.MAX_LENGTH.value

        # Integer
        res = (
            Profiler(
                max_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.MAX_LENGTH.name) is None

        # String
        res = (
            Profiler(
                max_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MAX_LENGTH.name] == 4

        # Text
        res = (
            Profiler(
                max_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MAX_LENGTH.name] == 19

    def test_sum(self):
        """
        Check SUM Metric
        """
        _sum = Metrics.SUM.value

        res = (
            Profiler(
                _sum,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.SUM.name] == 61

        res = (
            Profiler(
                _sum,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name).get(Metrics.SUM.name) is None

    def test_unique_count(self):
        """
        Check Unique Count metric
        """
        unique_count = Metrics.UNIQUE_COUNT.value
        res = (
            Profiler(
                unique_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] == 1

    def test_unique_ratio(self):
        """
        Check Unique Count metric
        """
        count = Metrics.COUNT.value
        unique_count = Metrics.UNIQUE_COUNT.value
        unique_ratio = Metrics.UNIQUE_RATIO.value
        res = (
            Profiler(
                count,
                unique_count,
                unique_ratio,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert (
            str(round(res.get(User.name.name)[Metrics.UNIQUE_RATIO.name], 2)) == "0.33"
        )

    def test_distinct_count(self):
        """
        Check Distinct Count Metric
        """
        count = Metrics.DISTINCT_COUNT.value
        res = (
            Profiler(
                count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.DISTINCT_COUNT.name] == 2.0

    def test_distinct_ratio(self):
        """
        Check Distinct Ratio Metric
        """
        count = Metrics.COUNT.value
        distinct_count = Metrics.DISTINCT_COUNT.value
        distinct_ratio = Metrics.DISTINCT_RATIO.value
        res = (
            Profiler(
                count,
                distinct_count,
                distinct_ratio,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert (
            str(round(res.get(User.name.name)[Metrics.DISTINCT_RATIO.name], 2))
            == "0.67"
        )

    def test_count_in_set(self):
        """
        Check Count In Set metric
        """

        set_count = add_props(values=["John"])(Metrics.COUNT_IN_SET.value)
        res = (
            Profiler(
                set_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.COUNT_IN_SET.name] == 2.0

        set_count = add_props(values=["John", "Jane"])(Metrics.COUNT_IN_SET.value)
        res = (
            Profiler(
                set_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.COUNT_IN_SET.name] == 3

    def test_histogram_empty(self):
        """
        Run the histogram on an empty table
        """

        class EmptyUser(Base):
            __tablename__ = "empty_users"
            id = Column(Integer, primary_key=True)
            name = Column(String(256))
            fullname = Column(String(256))
            nickname = Column(String(256))
            comments = Column(TEXT)
            age = Column(Integer)

        EmptyUser.__table__.create(bind=self.engine)

        with patch.object(
            SQAProfilerInterface, "_convert_table_to_orm_object", return_value=EmptyUser
        ):
            sqa_profiler_interface = SQAProfilerInterface(
                self.sqlite_conn,
                None,
                self.table_entity,
                None,
                None,
                None,
                None,
            )

        hist = Metrics.HISTOGRAM.value
        res = (
            Profiler(
                hist,
                profiler_interface=sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(EmptyUser.age.name).get(Metrics.HISTOGRAM.name) is None

    def test_not_like_count(self):
        """
        Check NOT_LIKE count
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.

        test_cases = [
            ("b%", 0),
            ("Jo%", 2),
            ("Ja%", 1),
            ("J%", 3),
        ]

        for expression, expected in test_cases:
            with self.subTest(expression=expression, expected=expected):
                not_like = add_props(expression=expression)(
                    Metrics.NOT_LIKE_COUNT.value
                )
                res = (
                    Profiler(
                        not_like,
                        profiler_interface=self.sqa_profiler_interface,
                    )
                    .compute_metrics()
                    ._column_results
                )

                assert res.get(User.name.name)[Metrics.NOT_LIKE_COUNT.name] == expected

    def test_median(self):
        """
        Check MEDIAN
        """

        median = Metrics.MEDIAN.value
        res = (
            Profiler(
                median,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MEDIAN.name] == 30

    def test_first_quartile(self):
        """
        Check first quartile
        """

        first_quartile = Metrics.FIRST_QUARTILE.value
        res = (
            Profiler(
                first_quartile,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.FIRST_QUARTILE.name] == 30

    def test_third_quartile(self):
        """
        Check third quartile
        """

        third_quartile = Metrics.THIRD_QUARTILE.value
        res = (
            Profiler(
                third_quartile,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.THIRD_QUARTILE.name] == 31

    def test_iqr(self):
        """Check IQR metric"""
        iqr = Metrics.IQR.value
        first_quartile = Metrics.FIRST_QUARTILE.value
        third_quartile = Metrics.THIRD_QUARTILE.value
        res = (
            Profiler(
                first_quartile,
                third_quartile,
                iqr,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.IQR.name] == 1

    def test_sum_function(self):
        """Check overwritten sum function"""
        session = self.sqa_profiler_interface.session
        res = session.query(SumFn(User.age)).select_from(User).scalar()

        assert res == 61

    def test_system_metric(self):
        system = add_props(table=User)(Metrics.SYSTEM.value)
        session = self.sqa_profiler_interface.session
        system().sql(session)

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
        return super().tearDownClass()
