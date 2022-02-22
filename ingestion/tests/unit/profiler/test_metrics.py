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

import pytest
from numpy.random import normal
from sqlalchemy import TEXT, Column, Integer, String, create_engine, text
from sqlalchemy.orm import declarative_base

from metadata.orm_profiler.engines import create_and_bind_session
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiles.core import SingleProfiler

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
        min_age = Metrics.MIN(col=User.age)
        min_profiler = SingleProfiler(min_age, session=self.session, table=User)
        res = min_profiler.execute()

        # Note how we can get the result value by passing the metrics name
        assert res.get(Metrics.MIN.name) == 30

    def test_std(self):
        """
        Check STD metric
        """
        std_age = Metrics.STDDEV(col=User.age)
        std_profiler = SingleProfiler(std_age, session=self.session, table=User)
        res = std_profiler.execute()
        # SQLITE STD custom implementation returns the squared STD.
        # Only useful for testing purposes
        assert res.get(Metrics.STDDEV.name) == 0.25

    def test_null_count(self):
        """
        Check null count
        """
        null_count = Metrics.NULL_COUNT(col=User.nickname)
        nc_profiler = SingleProfiler(null_count, session=self.session, table=User)
        res = nc_profiler.execute()

        assert res.get(Metrics.NULL_COUNT.name) == 1

    def test_null_ratio(self):
        """
        Check composed metric run
        """
        count = Metrics.COUNT(col=User.nickname)
        null_count = Metrics.NULL_COUNT(col=User.nickname)

        # Build the ratio based on the other two metrics
        null_ratio = Metrics.NULL_RATIO(col=User.nickname)

        composed_profiler = SingleProfiler(
            count, null_count, null_ratio, session=self.session, table=User
        )
        res = composed_profiler.execute()
        assert res.get(Metrics.NULL_RATIO.name) == 0.5

    def test_table_count(self):
        """
        Check Table Metric run
        """
        table_count = Metrics.ROW_NUMBER()
        profiler = SingleProfiler(table_count, session=self.session, table=User)
        res = profiler.execute()
        assert res.get(Metrics.ROW_NUMBER.name) == 2

    def test_avg(self):
        """
        Check avg for distinct types
        """

        # Integer
        avg = Metrics.AVG(col=User.age)
        res = SingleProfiler(avg, session=self.session, table=User).execute()

        assert res["AVG"] == 30.5

        # String
        avg = Metrics.AVG(col=User.name)
        res = SingleProfiler(avg, session=self.session, table=User).execute()

        assert res["AVG"] == 4.0

        # Text
        avg = Metrics.AVG(col=User.comments)
        res = SingleProfiler(avg, session=self.session, table=User).execute()

        assert res["AVG"] == 15.0

    def test_distinct(self):
        """
        Check distinct count
        """
        dist = Metrics.DISTINCT(col=User.age)
        res = SingleProfiler(dist, session=self.session, table=User).execute()

        assert res["DISTINCT"] == 2

    def test_duplicate_count(self):
        """
        Check composed duplicate count
        """
        count = Metrics.COUNT(col=User.name)
        dist = Metrics.DISTINCT(col=User.name)
        dup_count = Metrics.DUPLICATE_COUNT(col=User.name)
        res = SingleProfiler(
            count, dist, dup_count, session=self.session, table=User
        ).execute()

        assert res["DUPLICATECOUNT"] == 0

    def test_histogram(self):
        """
        Check histogram computation
        """

        # Cook some data first
        class TestHist(Base):
            __tablename__ = "test_hist"
            id = Column(Integer, primary_key=True)
            num = Column(Integer)

        TestHist.__table__.create(bind=self.engine)

        data = [TestHist(num=int(rand)) for rand in normal(loc=0, scale=10, size=2000)]

        self.session.add_all(data)
        self.session.commit()

        hist = Metrics.HISTOGRAM(TestHist.num, bins=5)
        res = SingleProfiler(hist, session=self.session, table=TestHist).execute()

        assert res["HISTOGRAM"]
        assert len(res["HISTOGRAM"]["count"]) == 5

    def test_like_count(self):
        """
        Check LIKE count
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        like = Metrics.LIKE_COUNT(User.name, expression="J%")
        res = SingleProfiler(like, session=self.session, table=User).execute()

        assert res["LIKECOUNT"] == 2

        like_ko = Metrics.LIKE_COUNT(User.name)
        with pytest.raises(AttributeError):
            SingleProfiler(like_ko, session=self.session, table=User).execute()

    def test_ilike_count(self):
        """
        Check ILIKE count: case-insensitive LIKE
        """
        ilike = Metrics.ILIKE_COUNT(User.name, expression="j%")
        res = SingleProfiler(ilike, session=self.session, table=User).execute()

        assert res["ILIKECOUNT"] == 2

        ilike_ko = Metrics.ILIKE_COUNT(User.name)
        with pytest.raises(AttributeError):
            SingleProfiler(ilike_ko, session=self.session, table=User).execute()

    def test_like_ratio(self):
        """
        Check LIKE ratio
        """
        like = Metrics.LIKE_COUNT(User.name, expression="J%")
        count = Metrics.COUNT(User.name)
        like_ratio = Metrics.LIKE_RATIO(User.name)
        res = SingleProfiler(
            like, count, like_ratio, session=self.session, table=User
        ).execute()

        assert res["LIKERATIO"] == 1.0

    def test_ilike_ratio(self):
        """
        Check LIKE ratio
        """
        # In sqlite, LIKE is insensitive by default, so we just check here
        # that the metrics runs correctly rather than the implementation logic.
        ilike = Metrics.ILIKE_COUNT(User.name, expression="j%")
        count = Metrics.COUNT(User.name)
        ilike_ratio = Metrics.ILIKE_RATIO(User.name)
        res = SingleProfiler(
            ilike, count, ilike_ratio, session=self.session, table=User
        ).execute()

        assert res["ILIKERATIO"] == 1.0

    def test_max(self):
        """
        Check MAX metric
        """
        _max = Metrics.MAX(User.age)
        res = SingleProfiler(_max, session=self.session, table=User).execute()

        assert res["MAX"] == 31

        _max = Metrics.MAX(User.name)
        res = SingleProfiler(_max, session=self.session, table=User).execute()

        assert res["MAX"] == "John"

    def test_min_length(self):
        """
        Check MIN_LENGTH metric
        """

        # Integer
        min_length = Metrics.MIN_LENGTH(col=User.age)
        res = SingleProfiler(min_length, session=self.session, table=User).execute()

        assert res["MINLENGTH"] is None

        # String
        min_length = Metrics.MIN_LENGTH(col=User.name)
        res = SingleProfiler(min_length, session=self.session, table=User).execute()

        assert res["MINLENGTH"] == 4

        # Text
        min_length = Metrics.MIN_LENGTH(col=User.comments)
        res = SingleProfiler(min_length, session=self.session, table=User).execute()

        assert res["MINLENGTH"] == 11

    def test_max_length(self):
        """
        Check MAX_LENGTH metric
        """

        # Integer
        max_length = Metrics.MAX_LENGTH(col=User.age)
        res = SingleProfiler(max_length, session=self.session, table=User).execute()

        assert res["MAXLENGTH"] is None

        # String
        max_length = Metrics.MAX_LENGTH(col=User.name)
        res = SingleProfiler(max_length, session=self.session, table=User).execute()

        assert res["MAXLENGTH"] == 4

        # Text
        max_length = Metrics.MAX_LENGTH(col=User.comments)
        res = SingleProfiler(max_length, session=self.session, table=User).execute()

        assert res["MAXLENGTH"] == 19

    def test_sum(self):
        """
        Check SUM Metric
        """
        _sum = Metrics.SUM(User.age)
        res = SingleProfiler(_sum, session=self.session, table=User).execute()

        assert res["SUM"] == 61

        _sum = Metrics.SUM(User.name)
        res = SingleProfiler(_sum, session=self.session, table=User).execute()

        assert res["SUM"] is None

    def test_unique_count(self):
        """
        Check Unique Count metric
        """
        unique_count = Metrics.UNIQUE_COUNT(User.name)
        res = SingleProfiler(unique_count, session=self.session, table=User).execute()

        assert res["UNIQUECOUNT"] == 2

    def test_unique_ratio(self):
        """
        Check Unique Count metric
        """
        count = Metrics.COUNT(User.name)
        unique_count = Metrics.UNIQUE_COUNT(User.name)
        unique_ratio = Metrics.UNIQUE_RATIO(User.name)
        res = SingleProfiler(
            count, unique_count, unique_ratio, session=self.session, table=User
        ).execute()

        assert res["UNIQUERATIO"] == 1.0
