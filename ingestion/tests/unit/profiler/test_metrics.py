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

from sqlalchemy import Column, Integer, String, create_engine
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
    age = Column(Integer)


class MetricsTest(TestCase):
    """
    Run checks on different metrics
    """

    engine = create_engine("sqlite+pysqlite:///:memory:", echo=True, future=True)
    session = create_and_bind_session(engine)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        User.__table__.create(bind=cls.engine)

        data = [
            User(name="John", fullname="John Doe", nickname="johnny b goode", age=30),
            User(name="Jane", fullname="Jone Doe", nickname=None, age=31),
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
