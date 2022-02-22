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
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.orm_profiler.engines import create_and_bind_session
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiles.core import MissingMetricException, SingleProfiler
from metadata.orm_profiler.profiles.simple import SimpleProfiler, SimpleTableProfiler

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

    def test_simple_profiler(self):
        """
        Check our pre-cooked profiler
        """
        simple = SimpleProfiler(session=self.session, col=User.age, table=User)
        simple.execute()
        assert simple.results == {
            "MIN": 30,
            "COUNT": 2,
            "STDDEV": 0.25,
            "NULLCOUNT": 0,
            "NULLRATIO": 0.0,
        }

    def test_simple_table_profiler(self):
        """
        Check the default table profiler
        """
        simple = SimpleTableProfiler(session=self.session, table=User)
        simple.execute()
        assert simple.results == {"ROWNUMBER": 2}

    def test_required_metrics(self):
        """
        Check that we raise properly MissingMetricException
        when not building the profiler with all the
        required ingredients
        """
        like = Metrics.LIKE_COUNT(User.name, expression="J%")
        count = Metrics.COUNT(User.name)
        like_ratio = Metrics.LIKE_RATIO(User.name)

        # This should run properly
        SingleProfiler(like, count, like_ratio, session=self.session, table=User)

        with pytest.raises(MissingMetricException):
            # We are missing ingredients here
            SingleProfiler(like, like_ratio, session=self.session, table=User)
