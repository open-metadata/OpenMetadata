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
from unittest import TestCase

from sqlalchemy import TEXT, Column, Integer, String, create_engine, func
from sqlalchemy.orm import DeclarativeMeta, declarative_base

from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.core import Profiler
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.utils.engines import create_and_bind_session

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


class SampleTest(TestCase):
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

    def test_random_sampler(self):
        """
        The random sampler should be able to
        generate a random subset of data
        """
        sampler = Sampler(session=self.session, table=User, profile_sample=50.0)
        random_sample = sampler.random_sample()
        res = self.session.query(func.count()).select_from(random_sample).first()
        assert res[0] < 30

    def test_sample_property(self):
        """
        Sample property should be properly generated
        """

        # Randomly pick table_count to init the Profiler, we don't care for this test
        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count, session=self.session, table=User, profile_sample=50.0
        )

        res = self.session.query(func.count()).select_from(profiler.sample).first()
        assert res[0] < 30

    def test_table_row_count(self):
        """
        Profile sample should be ignored in row count
        """
        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count, session=self.session, table=User, profile_sample=50.0
        )
        res = profiler.execute()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 30

    def test_random_sample_count(self):
        """
        Check we can properly sample data.

        There's a random component, so we cannot ensure to always
        get 15 rows, but for sure we should get less than 30.
        """
        count = Metrics.COUNT.value
        profiler = Profiler(
            count,
            session=self.session,
            table=User,
            profile_sample=50.0,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results
        assert res.get(User.name.name)[Metrics.COUNT.name] < 30

        profiler = Profiler(
            count,
            session=self.session,
            table=User,
            profile_sample=100.0,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results
        assert res.get(User.name.name)[Metrics.COUNT.name] == 30

    def test_random_sample_histogram(self):
        """
        Histogram should run correctly
        """
        hist = Metrics.HISTOGRAM.value
        profiler = Profiler(
            hist,
            session=self.session,
            table=User,
            profile_sample=50.0,
            use_cols=[User.id],
        )
        res = profiler.execute()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.id.name)[Metrics.HISTOGRAM.name]["frequencies"]) < 30

        profiler = Profiler(
            hist,
            session=self.session,
            table=User,
            profile_sample=100.0,
            use_cols=[User.id],
        )
        res = profiler.execute()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.id.name)[Metrics.HISTOGRAM.name]["frequencies"]) == 30.0

    def test_random_sample_unique_count(self):
        """
        Unique count should run correctly
        """
        hist = Metrics.UNIQUE_COUNT.value
        profiler = Profiler(
            hist,
            session=self.session,
            table=User,
            profile_sample=50.0,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results

        # As we repeat data, we expect 0 unique counts.
        # This tests might very rarely, fail, depending on the sampled random data.
        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] <= 1

        profiler = Profiler(
            hist,
            session=self.session,
            table=User,
            profile_sample=100.0,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results

        # As we repeat data, we expect 0 unique counts.
        # This tests might very rarely, fail, depending on the sampled random data.
        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] == 0
