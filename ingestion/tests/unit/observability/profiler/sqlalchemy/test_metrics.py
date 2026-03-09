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

"""
Test Metrics behavior
"""
import datetime
import math
import os
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import TEXT, Column, Date, DateTime, Float, Integer, String, Time
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.tests.customMetric import CustomMetric
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.processor.core import Profiler
from metadata.sampler.sqlalchemy.sampler import SQASampler


class Base(DeclarativeBase):
    pass


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
    email = Column(String(256))  # unique email for testing allValuesUnique


class MetricsTest(TestCase):
    """
    Run checks on different metrics
    """

    worker_id = os.environ.get("PYTEST_XDIST_WORKER", "master")
    worker_suffix = f"_{worker_id}" if worker_id != "master" else ""
    db_path = os.path.join(
        os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}{worker_suffix}.db"
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
                name=ColumnName("id"),
                dataType=DataType.INT,
            )
        ],
    )

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """

        with patch.object(SQASampler, "build_table_orm", return_value=User):
            sampler = SQASampler(
                service_connection_config=cls.sqlite_conn,
                ometa_client=None,
                entity=None,
            )
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.sqlite_conn,
            None,
            cls.table_entity,
            None,
            sampler,
            1,
            43200,
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
                email="john1@example.com",
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
                email="jane@example.com",
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
                email="john2@example.com",
            ),
        ]
        cls.sqa_profiler_interface.session.add_all(data)
        cls.sqa_profiler_interface.session.commit()

    def test_count(self):
        """
        Check the Count metric
        """
        count = Metrics.valuesCount.value
        profiler = Profiler(
            count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.name.name).get(Metrics.valuesCount.name) == 3

    def test_min(self):
        """
        Check the Min metric
        """
        min_age = Metrics.min.value
        profiler = Profiler(
            min_age,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.age.name).get(Metrics.min.name) == 30
        assert res.get(User.comments.name).get(Metrics.min.name) == 11

    def test_std(self):
        """
        Check STD metric
        """
        std_age = Metrics.stddev.value
        profiler = Profiler(
            std_age,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert res.get(User.age.name).get(Metrics.stddev.name) == 0.5

    def test_earliest_time(self):
        """
        Check Earliest Time Metric
        """
        earliest_time = Metrics.min.value
        profiler = Profiler(
            earliest_time,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert res.get(User.dob.name).get(Metrics.min.name) == datetime.datetime(
            1982, 2, 2
        )
        assert res.get(User.tob.name).get(Metrics.min.name) == datetime.time(9, 3, 25)
        assert res.get(User.doe.name).get(Metrics.min.name) == datetime.date(
            2009, 11, 11
        )

    def test_latest_time(self):
        """
        Check Latest Time Metric
        """
        latest_time = Metrics.max.value
        profiler = Profiler(
            latest_time,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert res.get(User.dob.name).get(Metrics.max.name) == datetime.datetime(
            1992, 5, 17
        )
        assert res.get(User.tob.name).get(Metrics.max.name) == datetime.time(11, 2, 32)
        assert res.get(User.doe.name).get(Metrics.max.name) == datetime.date(
            2020, 1, 12
        )

    def test_null_count(self):
        """
        Check null count
        """
        null_count = Metrics.nullCount.value
        profiler = Profiler(
            null_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        assert res.get(User.nickname.name).get(Metrics.nullCount.name) == 2

    def test_null_ratio(self):
        """
        Check composed metric run
        """
        count = Metrics.valuesCount.value
        null_count = Metrics.nullCount.value

        # Build the ratio based on the other two metrics
        null_ratio = Metrics.nullProportion.value

        profiler = Profiler(
            count,
            null_count,
            null_ratio,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results
        assert (
            str(round(res.get(User.nickname.name).get(Metrics.nullProportion.name), 2))
            == "0.67"
        )

    def test_non_numeric(self):
        """
        Check Null Count, Null Ratio
        """

        class NonNumericNumbers(Base):
            __tablename__ = "non_numeric_numbers"
            id = Column(Integer, primary_key=True)
            float_col = Column(Float())  # date of employment

        NonNumericNumbers.__table__.create(bind=self.engine)
        with patch.object(
            SQASampler, "build_table_orm", return_value=NonNumericNumbers
        ):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=self.table_entity,
            )
        sqa_profiler_interface = SQAProfilerInterface(
            self.sqlite_conn,
            None,
            self.table_entity,
            None,
            sampler,
            1,
            43200,
        )

        data = [
            NonNumericNumbers(float_col=math.nan),
            NonNumericNumbers(float_col=math.inf),
            NonNumericNumbers(float_col=-math.inf),
            NonNumericNumbers(float_col=10),
            NonNumericNumbers(float_col=20),
            NonNumericNumbers(float_col=None),
        ]
        sqa_profiler_interface.session.add_all(data)
        sqa_profiler_interface.session.commit()
        count = Metrics.valuesCount.value
        null_count = Metrics.nullCount.value

        # Build the ratio based on the other two metrics
        null_ratio = Metrics.nullProportion.value
        profiler = Profiler(
            count,
            null_count,
            null_ratio,
            profiler_interface=sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        assert (
            res.get(NonNumericNumbers.float_col.name).get(Metrics.nullCount.name) == 2
        )
        assert (
            str(
                round(
                    res.get(NonNumericNumbers.float_col.name).get(
                        Metrics.nullProportion.name
                    ),
                    2,
                )
            )
            == "0.33"
        )

    def test_table_row_count(self):
        """
        Check Table Metric run
        """
        row_count = Metrics.rowCount.value
        profiler = Profiler(
            row_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.rowCount.name) == 3

    def test_table_column_count(self):
        """
        Check Column Count metric
        """
        col_count = add_props(table=User)(Metrics.columnCount.value)
        profiler = Profiler(
            col_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.columnCount.name) == 10

    def test_avg(self):
        """
        Check avg for distinct types
        """

        # Integer
        avg = Metrics.mean.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.mean.name] == 30.5

        # String
        avg = Metrics.mean.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.mean.name] == 4.0

        # Text
        avg = Metrics.mean.value
        res = (
            Profiler(
                avg,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.mean.name] == 15.0

    def test_duplicate_count(self):
        """
        Check composed duplicate count
        """
        count = Metrics.valuesCount.value
        unique = Metrics.distinctCount.value
        dup_count = Metrics.duplicateCount.value
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

        assert res.get(User.age.name)[Metrics.duplicateCount.name] == 0

    def test_histogram(self):
        """
        Check histogram computation
        """

        hist = Metrics.histogram.value
        count = Metrics.valuesCount.value
        min = Metrics.min.value
        max = Metrics.max.value
        first_quartile = Metrics.firstQuartile.value
        third_quartile = Metrics.thirdQuartile.value
        iqr = Metrics.interQuartileRange.value

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

        age_histogram = res.get(User.age.name)[Metrics.histogram.name]
        id_histogram = res.get(User.id.name)[Metrics.histogram.name]
        comments_histogram = res.get(User.comments.name)[Metrics.histogram.name]

        assert age_histogram
        assert len(age_histogram["frequencies"]) == 1
        assert id_histogram
        assert len(id_histogram["frequencies"]) == 2
        assert comments_histogram is None

    def test_cardinality_distribution(self):
        """
        Check cardinality distribution computation
        """
        cardinality_dist = Metrics.cardinalityDistribution.value
        count = Metrics.valuesCount.value
        distinct_count = Metrics.distinctCount.value

        res = (
            Profiler(
                cardinality_dist,
                count,
                distinct_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        # Test with string column that has repeated values (name column has "John" twice)
        name_cardinality = res.get(User.name.name)[Metrics.cardinalityDistribution.name]

        assert name_cardinality
        assert "categories" in name_cardinality
        assert "counts" in name_cardinality
        assert "percentages" in name_cardinality
        assert len(name_cardinality["categories"]) > 0
        assert len(name_cardinality["counts"]) > 0
        assert len(name_cardinality["percentages"]) > 0

        # Check that "John" appears as a category (appears twice in test data)
        assert "John" in name_cardinality["categories"]
        john_index = name_cardinality["categories"].index("John")
        assert name_cardinality["counts"][john_index] == 2

        # Check that percentages sum to approximately 100%
        assert abs(sum(name_cardinality["percentages"]) - 100.0) < 0.1

    def test_cardinality_distribution_all_distinct(self):
        """
        Check cardinality distribution when all values are distinct

        Note: The existing test data doesn't have a string column where all values are unique.
        This test verifies the logic works correctly by checking that with non-unique data,
        we don't get the allValuesUnique flag.
        """
        cardinality_dist = Metrics.cardinalityDistribution.value
        count = Metrics.valuesCount.value
        distinct_count = Metrics.distinctCount.value

        res = (
            Profiler(
                cardinality_dist,
                count,
                distinct_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        # The name column has: ["John", "Jane", "John"] - not all distinct
        # So it should return a normal cardinality distribution, not the allValuesUnique flag
        name_cardinality = res.get(User.name.name)[Metrics.cardinalityDistribution.name]

        assert name_cardinality is not None
        # Should have categories (distribution), not allValuesUnique flag
        assert name_cardinality.get("categories") is not None
        assert name_cardinality.get("allValuesUnique") is not True

    def test_cardinality_distribution_all_values_unique_flag(self):
        """
        Test that allValuesUnique flag is returned when count equals distinct_count

        The email column has all unique values, so it should trigger the allValuesUnique flag.
        """
        cardinality_dist = Metrics.cardinalityDistribution.value
        count = Metrics.valuesCount.value
        distinct_count = Metrics.distinctCount.value

        res = (
            Profiler(
                cardinality_dist,
                count,
                distinct_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        # email column has all unique values: ["john1@example.com", "jane@example.com", "john2@example.com"]
        # Count: 3, DistinctCount: 3
        email_cardinality = res.get(User.email.name)[
            Metrics.cardinalityDistribution.name
        ]

        # Should return the allValuesUnique flag
        assert email_cardinality is not None
        assert email_cardinality.get("allValuesUnique") is True
        # Should not have categories/counts/percentages when allValuesUnique is True
        assert email_cardinality.get("categories") is None

    def test_cardinality_distribution_unsupported_type(self):
        """
        Check cardinality distribution with unsupported data types
        """
        cardinality_dist = Metrics.cardinalityDistribution.value
        count = Metrics.valuesCount.value
        distinct_count = Metrics.distinctCount.value

        res = (
            Profiler(
                cardinality_dist,
                count,
                distinct_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        # Test with integer column (not concatenable)
        age_cardinality = res.get(User.age.name)[Metrics.cardinalityDistribution.name]

        # Should return None for unsupported types
        assert age_cardinality is None

    def test_cardinality_distribution_empty_table(self):
        """
        Check cardinality distribution with empty table
        """
        # Create a new table with no data
        class EmptyUser(Base):
            __tablename__ = "empty_users"
            id = Column(Integer, primary_key=True)
            name = Column(String(256))

        EmptyUser.__table__.create(bind=self.engine)

        with patch.object(SQASampler, "build_table_orm", return_value=EmptyUser):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=None,
            )
        empty_profiler_interface = SQAProfilerInterface(
            self.sqlite_conn,
            None,
            self.table_entity,
            None,
            sampler,
            1,
            43200,
        )

        cardinality_dist = Metrics.cardinalityDistribution.value
        count = Metrics.valuesCount.value
        distinct_count = Metrics.distinctCount.value

        res = (
            Profiler(
                cardinality_dist,
                count,
                distinct_count,
                profiler_interface=empty_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        # Should return None for empty table
        name_cardinality = res.get(EmptyUser.name.name)[
            Metrics.cardinalityDistribution.name
        ]
        assert name_cardinality is None

    def test_like_count(self):
        """
        Check LIKE count
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        like = add_props(expression="J%")(Metrics.likeCount.value)
        res = (
            Profiler(
                like,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.likeCount.name] == 3

        like = add_props(expression="Jo%")(Metrics.likeCount.value)
        res = (
            Profiler(
                like,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.likeCount.name] == 2

    def test_ilike_count(self):
        """
        Check ILIKE count: case-insensitive LIKE
        """
        ilike = add_props(expression="j%")(Metrics.iLikeCount.value)
        res = (
            Profiler(
                ilike,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.iLikeCount.name] == 3

        ilike = add_props(expression="ja%")(Metrics.iLikeCount.value)
        res = (
            Profiler(
                ilike,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.iLikeCount.name] == 1

    def test_like_ratio(self):
        """
        Check LIKE ratio
        """
        like = add_props(expression="J%")(Metrics.likeCount.value)
        count = Metrics.valuesCount.value
        like_ratio = Metrics.likeRatio.value
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

        assert res.get(User.name.name)[Metrics.likeRatio.name] == 1.0

    def test_ilike_ratio(self):
        """
        Check LIKE ratio
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        ilike = add_props(expression="J%")(Metrics.iLikeCount.value)
        count = Metrics.valuesCount.value
        ilike_ratio = Metrics.iLikeRatio.value
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

        assert res.get(User.name.name)[Metrics.iLikeRatio.name] == 1.0

    def test_max(self):
        """
        Check MAX metric
        """
        _max = Metrics.max.value

        res = (
            Profiler(
                _max,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.max.name] == 31
        assert res.get(User.name.name).get(Metrics.max.name) == 4

    def test_min_length(self):
        """
        Check MIN_LENGTH metric
        """

        min_length = Metrics.minLength.value

        # Integer
        res = (
            Profiler(
                min_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.minLength.name) is None

        # String
        res = (
            Profiler(
                min_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.minLength.name] == 4

        # Text
        res = (
            Profiler(
                min_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.minLength.name] == 11

    def test_max_length(self):
        """
        Check MAX_LENGTH metric
        """
        max_length = Metrics.maxLength.value

        # Integer
        res = (
            Profiler(
                max_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.maxLength.name) is None

        # String
        res = (
            Profiler(
                max_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.maxLength.name] == 4

        # Text
        res = (
            Profiler(
                max_length,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.maxLength.name] == 19

    def test_sum(self):
        """
        Check SUM Metric
        """
        _sum = Metrics.sum.value

        res = (
            Profiler(
                _sum,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.sum.name] == 61

        res = (
            Profiler(
                _sum,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name).get(Metrics.sum.name) == 12

    def test_unique_count(self):
        """
        Check Unique Count metric
        """
        unique_count = Metrics.uniqueCount.value
        res = (
            Profiler(
                unique_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.uniqueCount.name] == 1

    def test_unique_ratio(self):
        """
        Check Unique Count metric
        """
        count = Metrics.valuesCount.value
        unique_count = Metrics.uniqueCount.value
        unique_ratio = Metrics.uniqueProportion.value
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
            str(round(res.get(User.name.name)[Metrics.uniqueProportion.name], 2))
            == "0.33"
        )

    def test_distinct_count(self):
        """
        Check Distinct Count Metric
        """
        count = Metrics.distinctCount.value
        res = (
            Profiler(
                count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.distinctCount.name] == 2.0

    def test_distinct_ratio(self):
        """
        Check Distinct Ratio Metric
        """
        count = Metrics.valuesCount.value
        distinct_count = Metrics.distinctCount.value
        distinct_ratio = Metrics.distinctProportion.value
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
            str(round(res.get(User.name.name)[Metrics.distinctProportion.name], 2))
            == "0.67"
        )

    def test_count_in_set(self):
        """
        Check Count In Set metric
        """

        set_count = add_props(values=["John"])(Metrics.countInSet.value)
        res = (
            Profiler(
                set_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.countInSet.name] == 2.0

        set_count = add_props(values=["John", "Jane"])(Metrics.countInSet.value)
        res = (
            Profiler(
                set_count,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.countInSet.name] == 3

    def test_histogram_empty(self):
        """
        Run the histogram on an empty table
        """

        class EmptyUser2(Base):
            __tablename__ = "empty_users2"
            id = Column(Integer, primary_key=True)
            name = Column(String(256))
            fullname = Column(String(256))
            nickname = Column(String(256))
            comments = Column(TEXT)
            age = Column(Integer)

        EmptyUser2.__table__.create(bind=self.engine)

        with patch.object(SQASampler, "build_table_orm", return_value=EmptyUser2):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=self.table_entity,
            )
        sqa_profiler_interface = SQAProfilerInterface(
            self.sqlite_conn,
            None,
            self.table_entity,
            None,
            sampler,
            1,
            43200,
        )

        hist = Metrics.histogram.value
        res = (
            Profiler(
                hist,
                profiler_interface=sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(EmptyUser2.age.name) is None

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
                not_like = add_props(expression=expression)(Metrics.notLikeCount.value)
                res = (
                    Profiler(
                        not_like,
                        profiler_interface=self.sqa_profiler_interface,
                    )
                    .compute_metrics()
                    ._column_results
                )

                assert res.get(User.name.name)[Metrics.notLikeCount.name] == expected

    def test_median(self):
        """
        Check MEDIAN
        """

        median = Metrics.median.value
        res = (
            Profiler(
                median,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.median.name] == 30
        assert res.get(User.comments.name)[Metrics.median.name] == 11

    def test_first_quartile(self):
        """
        Check first quartile
        """

        first_quartile = Metrics.firstQuartile.value
        res = (
            Profiler(
                first_quartile,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.firstQuartile.name] == 30
        assert res.get(User.comments.name)[Metrics.firstQuartile.name] == 11

    def test_third_quartile(self):
        """
        Check third quartile
        """

        third_quartile = Metrics.thirdQuartile.value
        res = (
            Profiler(
                third_quartile,
                profiler_interface=self.sqa_profiler_interface,
            )
            .compute_metrics()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.thirdQuartile.name] == 31
        assert res.get(User.comments.name)[Metrics.thirdQuartile.name] == 19

    def test_iqr(self):
        """Check IQR metric"""
        iqr = Metrics.interQuartileRange.value
        first_quartile = Metrics.firstQuartile.value
        third_quartile = Metrics.thirdQuartile.value
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

        assert res.get(User.age.name)[Metrics.interQuartileRange.name] == 1
        assert res.get(User.comments.name)[Metrics.interQuartileRange.name] == 8

    def test_sum_function(self):
        """Check overwritten sum function"""
        session = self.sqa_profiler_interface.session
        res = session.query(SumFn(User.age)).select_from(User).scalar()

        assert res == 61

    def test_table_custom_metric(self):
        table_entity = Table(
            id=uuid4(),
            name="user",
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                )
            ],
            customMetrics=[
                CustomMetric(
                    name="CustomerBornAfter1991",
                    expression="SELECT COUNT(id) FROM users WHERE dob > '1991-01-01'",
                ),
                CustomMetric(
                    name="AverageAge",
                    expression="SELECT SUM(age)/COUNT(*) FROM users",
                ),
            ],
        )
        with patch.object(SQASampler, "build_table_orm", return_value=User):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=None,
            )
        sqa_profiler_interface = SQAProfilerInterface(
            self.sqlite_conn,
            None,
            table_entity,
            None,
            sampler,
            1,
            43200,
        )

        profiler = Profiler(
            profiler_interface=sqa_profiler_interface,
        )
        metrics = profiler.compute_metrics()
        for k, v in metrics._table_results.items():
            for metric in v:
                if metric.name == "CustomerBornAfter1991":
                    assert metric.value == 2
                if metric.name == "AverageAge":
                    assert metric.value == 20.0

    def test_column_custom_metric(self):
        table_entity = Table(
            id=uuid4(),
            name="user",
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                    customMetrics=[
                        CustomMetric(
                            name="CustomerBornAfter1991",
                            columnName="id",
                            expression="SELECT SUM(id) FROM users WHERE dob > '1991-01-01'",
                        ),
                        CustomMetric(
                            name="AverageAge",
                            columnName="id",
                            expression="SELECT SUM(age)/COUNT(*) FROM users",
                        ),
                    ],
                )
            ],
        )
        with patch.object(SQASampler, "build_table_orm", return_value=User):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=None,
            )
        sqa_profiler_interface = SQAProfilerInterface(
            self.sqlite_conn,
            None,
            table_entity,
            None,
            sampler,
            1,
            43200,
        )

        profiler = Profiler(
            profiler_interface=sqa_profiler_interface,
        )
        metrics = profiler.compute_metrics()
        for k, v in metrics._column_results.items():
            for metric in v.get("customMetrics", []):
                if metric.name == "CustomerBornAfter1991":
                    assert metric.value == 3.0
                if metric.name == "AverageAge":
                    assert metric.value == 20.0

    @classmethod
    def tearDownClass(cls) -> None:
        cls.sqa_profiler_interface.close()
        os.remove(cls.db_path)
        return super().tearDownClass()
