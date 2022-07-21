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

from sqlalchemy import BINARY, TEXT, Column, Integer, String, func
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.orm_profiler.interfaces.sqa_profiler_interface import SQAProfilerInterface
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.core import Profiler
from metadata.orm_profiler.profiler.sampler import Sampler
from metadata.orm_profiler.orm.registry import CustomTypes

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

    sqlite_conn = SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite)
    sqa_profiler_interface = SQAProfilerInterface(sqlite_conn)
    engine = sqa_profiler_interface.session.get_bind()
    session = sqa_profiler_interface.session

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

        self.sqa_profiler_interface.create_sampler(User, profile_sample=50.0)

        # Randomly pick table_count to init the Profiler, we don't care for this test
        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
        )

        res = self.session.query(func.count()).select_from(profiler.sample).first()
        assert res[0] < 30

    def test_table_row_count(self):
        """
        Profile sample should be ignored in row count
        """

        self.sqa_profiler_interface.create_sampler(User, profile_sample=50.0)
        self.sqa_profiler_interface.create_runner(User)

        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
        )
        res = profiler.execute()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 30

    def test_random_sample_count(self):
        """
        Check we can properly sample data.

        There's a random component, so we cannot ensure to always
        get 15 rows, but for sure we should get less than 30.
        """

        self.sqa_profiler_interface.create_sampler(
            User,
            profile_sample=50.0,
        )
        self.sqa_profiler_interface.create_runner(User)

        count = Metrics.COUNT.value
        profiler = Profiler(
            count,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results
        assert res.get(User.name.name)[Metrics.COUNT.name] < 30

        self.sqa_profiler_interface.create_sampler(
            User,
            profile_sample=100.0,
        )
        self.sqa_profiler_interface.create_runner(User)

        profiler = Profiler(
            count,
            profiler_interface=self.sqa_profiler_interface,
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

        self.sqa_profiler_interface.create_sampler(
            User,
            profile_sample=50.0,
        )
        self.sqa_profiler_interface.create_runner(User)

        hist = Metrics.HISTOGRAM.value
        profiler = Profiler(
            hist,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
            use_cols=[User.id],
        )
        res = profiler.execute()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.id.name)[Metrics.HISTOGRAM.name]["frequencies"]) < 30

        self.sqa_profiler_interface.create_sampler(
            User,
            profile_sample=100.0,
        )
        self.sqa_profiler_interface.create_runner(User)

        profiler = Profiler(
            hist,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
            use_cols=[User.id],
        )
        res = profiler.execute()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.id.name)[Metrics.HISTOGRAM.name]["frequencies"]) == 30.0

    def test_random_sample_unique_count(self):
        """
        Unique count should run correctly
        """

        self.sqa_profiler_interface.create_sampler(
            User,
            profile_sample=50.0,
        )
        self.sqa_profiler_interface.create_runner(User)

        hist = Metrics.UNIQUE_COUNT.value
        profiler = Profiler(
            hist,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results

        # As we repeat data, we expect 0 unique counts.
        # This tests might very rarely, fail, depending on the sampled random data.
        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] <= 1

        self.sqa_profiler_interface.create_sampler(
            User,
            profile_sample=100.0,
        )
        self.sqa_profiler_interface.create_runner(User)

        profiler = Profiler(
            hist,
            profiler_interface=self.sqa_profiler_interface,
            table=User,
            use_cols=[User.name],
        )
        res = profiler.execute()._column_results

        # As we repeat data, we expect 0 unique counts.
        # This tests might very rarely, fail, depending on the sampled random data.
        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] == 0

    def test_sample_data(self):
        """
        We should be able to pick up sample data from the sampler
        """
        sampler = Sampler(session=self.session, table=User)
        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 6
        assert len(sample_data.rows) == 30

        # Order matters, this is how we'll present the data
        names = [str(col.__root__) for col in sample_data.columns]
        assert names == ["id", "name", "fullname", "nickname", "comments", "age"]

    def test_sample_data_binary(self):
        """
        We should be able to pick up sample data from the sampler
        """

        class UserBinary(Base):
            __tablename__ = "users_binary"
            id = Column(Integer, primary_key=True)
            name = Column(String(256))
            fullname = Column(String(256))
            nickname = Column(String(256))
            comments = Column(TEXT)
            age = Column(Integer)
            password_hash = Column(CustomTypes.BYTES.value)

        UserBinary.__table__.create(bind=self.engine)

        for i in range(10):
            data = [
                UserBinary(
                    name="John",
                    fullname="John Doe",
                    nickname="johnny b goode",
                    comments="no comments",
                    age=30,
                    password_hash=b"foo",
                ),
            ]

            self.session.add_all(data)
            self.session.commit()

        sampler = Sampler(session=self.session, table=UserBinary)
        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 7
        assert len(sample_data.rows) == 10

        names = [str(col.__root__) for col in sample_data.columns]
        assert names == [
            "id",
            "name",
            "fullname",
            "nickname",
            "comments",
            "age",
            "password_hash",
        ]

        assert type(sample_data.rows[0][6]) == str

        UserBinary.__table__.drop(bind=self.engine)

    def test_sample_from_user_query(self):
        """
        Test sample data are returned based on user query
        """
        stmt = "SELECT id, name FROM users"
        sampler = Sampler(session=self.session, table=User, profile_sample_query=stmt)
        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 2
        names = [col.__root__ for col in sample_data.columns]
        assert names == ["id", "name"]
