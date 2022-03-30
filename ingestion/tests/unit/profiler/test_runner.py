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
Test Sample behavior
"""
import time
from unittest import TestCase

import pytest
from sqlalchemy import TEXT, Column, Integer, String, create_engine, func
from sqlalchemy.orm import DeclarativeMeta, declarative_base

from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.utils.engines import create_and_bind_session
from metadata.utils.timeout import cls_timeout

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


class Timer:
    """
    Helper to test timeouts
    """

    @staticmethod
    def slow():
        time.sleep(10)
        return 1

    @staticmethod
    def fast():
        return 1


class RunnerTest(TestCase):
    """
    Run checks on different metrics
    """

    engine = create_engine("sqlite+pysqlite:///:memory:", echo=False, future=True)
    session = create_and_bind_session(engine)

    sampler = Sampler(session=session, table=User, profile_sample=50.0)
    sample = sampler.random_sample()

    raw_runner = QueryRunner(session=session, table=User, sample=sample)

    timeout_runner: Timer = cls_timeout(1)(Timer())

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        User.__table__.create(bind=cls.engine)

        # Insert 30 rows
        for i in range(10):
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
                User(
                    name="John",
                    fullname="John Doe",
                    nickname=None,
                    comments=None,
                    age=None,
                ),
            ]
            cls.session.add_all(data)
            cls.session.commit()

    def test_select_from_table(self):
        """
        We can run queries against the table
        """
        res = self.raw_runner.select_first_from_table(func.count())
        assert res[0] == 30

        res = self.raw_runner.select_all_from_table(Column(User.name.name))
        assert len(res) == 30

    def test_select_from_sample(self):
        """
        We can run queries against the sample
        """
        res = self.raw_runner.select_first_from_sample(func.count())
        assert res[0] < 30

        # Note how we need to pass the column by name, not from the table
        # object, or it will run a cartesian product.
        res = self.raw_runner.select_all_from_sample(Column(User.name.name))
        assert len(res) < 30

    def test_select_from_query(self):
        """
        We can pick up results from a given query
        """
        query = self.session.query(func.count()).select_from(User)
        res = self.raw_runner.select_first_from_query(query)
        assert res[0] == 30

        query = self.session.query(func.count()).select_from(self.sample)
        res = self.raw_runner.select_first_from_query(query)
        assert res[0] < 30

        query = self.session.query(Column(User.name.name)).select_from(User)
        res = self.raw_runner.select_all_from_query(query)
        assert len(res) == 30

        query = self.session.query(func.count()).select_from(self.sample)
        res = self.raw_runner.select_all_from_query(query)
        assert len(res) < 30

    def test_timeout_runner(self):
        """
        Check that timeout alarms get executed
        """
        assert self.timeout_runner.fast() == 1

        with pytest.raises(TimeoutError):
            self.timeout_runner.slow()
