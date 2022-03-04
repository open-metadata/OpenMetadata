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
from unittest import TestCase

from sqlalchemy import TEXT, Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.orm_profiler.engines import create_and_bind_session
from metadata.orm_profiler.metrics.core import add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiles.core import Profiler

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

    def test_min(self):
        """
        Check the Min metric
        """
        min_age = Metrics.MIN.value
        profiler = Profiler(
            min_age, session=self.session, table=User, use_cols=[User.age]
        )
        res = profiler.execute()._column_results

        # Note how we can get the result value by passing the metrics name
        assert res.get(User.age.name).get(Metrics.MIN.name) == 30

    def test_std(self):
        """
        Check STD metric
        """
        std_age = Metrics.STDDEV.value
        profiler = Profiler(
            std_age, session=self.session, table=User, use_cols=[User.age]
        )
        res = profiler.execute()._column_results
        # SQLITE STD custom implementation returns the squared STD.
        # Only useful for testing purposes
        assert res.get(User.age.name).get(Metrics.STDDEV.name) == 0.25

    def test_null_count(self):
        """
        Check null count
        """
        null_count = Metrics.NULL_COUNT.value
        profiler = Profiler(
            null_count, session=self.session, table=User, use_cols=[User.nickname]
        )
        res = profiler.execute()._column_results

        assert res.get(User.nickname.name).get(Metrics.NULL_COUNT.name) == 1

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
            session=self.session,
            table=User,
            use_cols=[User.nickname],
        )
        res = profiler.execute()._column_results
        assert res.get(User.nickname.name).get(Metrics.NULL_RATIO.name) == 0.5

    def test_table_row_count(self):
        """
        Check Table Metric run
        """
        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(table_count, session=self.session, table=User)
        res = profiler.execute()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 2

    def test_table_column_count(self):
        """
        Check Column Count metric
        """
        col_count = add_props(table=User)(Metrics.COLUMN_COUNT.value)
        profiler = Profiler(col_count, session=self.session, table=User)
        res = profiler.execute()._table_results
        assert res.get(Metrics.COLUMN_COUNT.name) == 6

    def test_avg(self):
        """
        Check avg for distinct types
        """

        # Integer
        avg = Metrics.MEAN.value
        res = (
            Profiler(avg, session=self.session, table=User, use_cols=[User.age])
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MEAN.name] == 30.5

        # String
        avg = Metrics.MEAN.value
        res = (
            Profiler(avg, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MEAN.name] == 4.0

        # Text
        avg = Metrics.MEAN.value
        res = (
            Profiler(avg, session=self.session, table=User, use_cols=[User.comments])
            .execute()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MEAN.name] == 15.0

    def test_duplicate_count(self):
        """
        Check composed duplicate count
        """
        count = Metrics.COUNT.value
        unique = Metrics.UNIQUE_COUNT.value
        dup_count = Metrics.DUPLICATE_COUNT.value
        res = (
            Profiler(
                count,
                unique,
                dup_count,
                session=self.session,
                table=User,
                use_cols=[User.age],
            )
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.DUPLICATE_COUNT.name] == 0

    def test_histogram(self):
        """
        Check histogram computation
        """

        hist = add_props(bins=5)(Metrics.HISTOGRAM.value)
        res = (
            Profiler(hist, session=self.session, table=User, use_cols=[User.age])
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.HISTOGRAM.name]
        assert (
            len(res.get(User.age.name)[Metrics.HISTOGRAM.name]["frequencies"])
            == 2  # Too little values
        )

    def test_like_count(self):
        """
        Check LIKE count
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        like = add_props(expression="J%")(Metrics.LIKE_COUNT.value)
        res = (
            Profiler(like, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.LIKE_COUNT.name] == 2

        like = add_props(expression="Jo%")(Metrics.LIKE_COUNT.value)
        res = (
            Profiler(like, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.LIKE_COUNT.name] == 1

        # Running safely
        # with pytest.raises(AttributeError):
        #     Profiler(
        #         Metrics.LIKE_COUNT.value,
        #         session=self.session,
        #         table=User,
        #         use_cols=[User.age],
        #     ).execute()

    def test_ilike_count(self):
        """
        Check ILIKE count: case-insensitive LIKE
        """
        ilike = add_props(expression="j%")(Metrics.ILIKE_COUNT.value)
        res = (
            Profiler(ilike, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.ILIKE_COUNT.name] == 2

        ilike = add_props(expression="ja%")(Metrics.ILIKE_COUNT.value)
        res = (
            Profiler(ilike, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.ILIKE_COUNT.name] == 1

        # Running safely
        # with pytest.raises(AttributeError):
        #     Profiler(
        #         Metrics.ILIKE_COUNT.value,
        #         session=self.session,
        #         table=User,
        #         use_cols=[User.age],
        #     ).execute()

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
                session=self.session,
                table=User,
                use_cols=[User.name],
            )
            .execute()
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
                session=self.session,
                table=User,
                use_cols=[User.name],
            )
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.ILIKE_RATIO.name] == 1.0

    def test_max(self):
        """
        Check MAX metric
        """
        _max = Metrics.MAX.value

        res = (
            Profiler(_max, session=self.session, table=User, use_cols=[User.age])
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.MAX.name] == 31

        # TMP disable min/max on strings
        # res = (
        #     Profiler(_max, session=self.session, table=User, use_cols=[User.name])
        #     .execute()
        #     ._column_results
        # )

        # assert res.get(User.name.name)[Metrics.MAX.name] == "John"

    def test_min_length(self):
        """
        Check MIN_LENGTH metric
        """

        min_length = Metrics.MIN_LENGTH.value

        # Integer
        res = (
            Profiler(min_length, session=self.session, table=User, use_cols=[User.age])
            .execute()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.MIN_LENGTH.name) is None

        # String
        res = (
            Profiler(min_length, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MIN_LENGTH.name] == 4

        # Text
        res = (
            Profiler(
                min_length, session=self.session, table=User, use_cols=[User.comments]
            )
            .execute()
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
            Profiler(max_length, session=self.session, table=User, use_cols=[User.age])
            .execute()
            ._column_results
        )

        assert res.get(User.age.name).get(Metrics.MAX_LENGTH.name) is None

        # String
        res = (
            Profiler(max_length, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.MAX_LENGTH.name] == 4

        # Text
        res = (
            Profiler(
                max_length, session=self.session, table=User, use_cols=[User.comments]
            )
            .execute()
            ._column_results
        )

        assert res.get(User.comments.name)[Metrics.MAX_LENGTH.name] == 19

    def test_sum(self):
        """
        Check SUM Metric
        """
        _sum = Metrics.SUM.value

        res = (
            Profiler(_sum, session=self.session, table=User, use_cols=[User.age])
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.SUM.name] == 61

        res = (
            Profiler(_sum, session=self.session, table=User, use_cols=[User.name])
            .execute()
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
                unique_count, session=self.session, table=User, use_cols=[User.age]
            )
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.UNIQUE_COUNT.name] == 2

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
                session=self.session,
                table=User,
                use_cols=[User.age],
            )
            .execute()
            ._column_results
        )

        assert res.get(User.age.name)[Metrics.UNIQUE_RATIO.name] == 1.0

    def test_count_in_set(self):
        """
        Check Count In Set metric
        """

        set_count = add_props(values=["John"])(Metrics.COUNT_IN_SET.value)
        res = (
            Profiler(set_count, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.COUNT_IN_SET.name] == 1.0

        set_count = add_props(values=["John", "Jane"])(Metrics.COUNT_IN_SET.value)
        res = (
            Profiler(set_count, session=self.session, table=User, use_cols=[User.name])
            .execute()
            ._column_results
        )

        assert res.get(User.name.name)[Metrics.COUNT_IN_SET.name] == 2.0
