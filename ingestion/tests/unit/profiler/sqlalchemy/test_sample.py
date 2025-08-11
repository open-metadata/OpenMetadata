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
Test Sample behavior
"""
import os
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import TEXT, Column, Integer, String, func
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import CustomTypes
from metadata.profiler.processor.core import Profiler
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


@patch.object(SQASampler, "build_table_orm", return_value=User)
class SampleTest(TestCase):
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
                name=ColumnName("id"),
                dataType=DataType.INT,
            ),
            EntityColumn(
                name=ColumnName("name"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("fullname"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("nickname"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("comments"),
                dataType=DataType.STRING,
            ),
            EntityColumn(
                name=ColumnName("age"),
                dataType=DataType.INT,
            ),
        ],
    )

    @classmethod
    @patch.object(SQASampler, "build_table_orm", return_value=User)
    def setUpClass(cls, sampler_mock) -> None:
        """
        Prepare Ingredients
        """
        with patch.object(SQASampler, "build_table_orm", return_value=User):
            cls.sampler = SQASampler(
                service_connection_config=cls.sqlite_conn,
                ometa_client=None,
                entity=None,
                sample_config=SampleConfig(profileSample=50.0),
            )
        cls.dataset = cls.sampler.get_dataset()
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.sqlite_conn,
            None,
            cls.table_entity,
            None,
            cls.sampler,
            5,
            43200,
        )
        cls.engine = cls.sqa_profiler_interface.session.get_bind()
        cls.session = cls.sqa_profiler_interface.session

        with patch.object(SQASampler, "build_table_orm", return_value=User):
            cls.full_sampler = SQASampler(
                service_connection_config=cls.sqlite_conn,
                ometa_client=None,
                entity=None,
            )
        cls.full_sqa_profiler_interface = SQAProfilerInterface(
            cls.sqlite_conn,
            None,
            cls.table_entity,
            None,
            cls.full_sampler,
            5,
            43200,
        )

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

    def test_sampler(self, sampler_mock):
        """
        The random sampler should be able to
        generate a random subset of data
        """
        random_sample = self.sampler.get_dataset()
        res = self.session.query(func.count()).select_from(random_sample).first()
        assert res[0] < 30

    def test_sample_property(self, sampler_mock):
        """
        Sample property should be properly generated
        """

        dataset = self.sqa_profiler_interface.sampler.get_dataset()

        res = self.session.query(func.count()).select_from(dataset).first()
        assert res[0] < 30

    def test_table_row_count(self, sampler_mock):
        """
        Profile sample should be ignored in row count
        """

        table_count = Metrics.ROW_COUNT.value
        profiler = Profiler(
            table_count,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._table_results
        assert res.get(Metrics.ROW_COUNT.name) == 30

    def test_random_sample_count(self, sampler_mock):
        """
        Check we can properly sample data.

        There's a random component, so we cannot ensure to always
        get 15 rows, but for sure we should get less than 30.
        """

        count = Metrics.COUNT.value

        profiler = Profiler(count, profiler_interface=self.sqa_profiler_interface)
        res = profiler.compute_metrics()._column_results
        assert res.get(User.name.name)[Metrics.COUNT.name] < 30

    def test_random_sample_histogram(self, sampler_mock):
        """
        Histogram should run correctly
        """
        hist = Metrics.HISTOGRAM.value
        count = Metrics.COUNT.value
        min = Metrics.MIN.value
        max = Metrics.MAX.value
        first_quartile = Metrics.FIRST_QUARTILE.value
        third_quartile = Metrics.THIRD_QUARTILE.value
        iqr = Metrics.IQR.value

        profiler = Profiler(
            hist,
            count,
            min,
            max,
            first_quartile,
            third_quartile,
            iqr,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.id.name)[Metrics.HISTOGRAM.name]["frequencies"]) < 30

        profiler = Profiler(
            hist,
            count,
            min,
            max,
            first_quartile,
            third_quartile,
            iqr,
            profiler_interface=self.full_sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # The sum of all frequencies should be sampled
        assert sum(res.get(User.id.name)[Metrics.HISTOGRAM.name]["frequencies"]) == 30.0

    def test_random_sample_unique_count(self, sampler_mock):
        """
        Unique count should run correctly
        """

        hist = Metrics.UNIQUE_COUNT.value
        profiler = Profiler(
            hist,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # As we repeat data, we expect 0 unique counts.
        # This tests might very rarely, fail, depending on the sampled random data.
        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] <= 1

        profiler = Profiler(
            hist,
            profiler_interface=self.sqa_profiler_interface,
        )
        res = profiler.compute_metrics()._column_results

        # As we repeat data, we expect 0 unique counts.
        # This tests might very rarely, fail, depending on the sampled random data.
        assert res.get(User.name.name)[Metrics.UNIQUE_COUNT.name] == 0

    def test_sample_data(self, sampler_mock):
        """
        We should be able to pick up sample data from the sampler
        """
        sample_data = self.full_sampler.fetch_sample_data()

        assert len(sample_data.columns) == 6
        assert len(sample_data.rows) == 30

        # Order matters, this is how we'll present the data
        names = [str(col.root) for col in sample_data.columns]
        assert names == ["id", "name", "fullname", "nickname", "comments", "age"]

    def test_sample_data_binary(self, sampler_mock):
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

        with patch.object(SQASampler, "build_table_orm", return_value=UserBinary):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=None,
            )

        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 7
        assert len(sample_data.rows) == 10

        names = [str(col.root) for col in sample_data.columns]
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

    def test_sample_from_user_query(self, sampler_mock):
        """
        Test sample data are returned based on user query
        """
        stmt = "SELECT id, name FROM users"
        with patch.object(SQASampler, "build_table_orm", return_value=User):
            sampler = SQASampler(
                service_connection_config=self.sqlite_conn,
                ometa_client=None,
                entity=None,
                sample_config=SampleConfig(profileSample=50.0),
                sample_query=stmt,
            )
        sample_data = sampler.fetch_sample_data()

        assert len(sample_data.columns) == 2
        names = [col.root for col in sample_data.columns]
        assert names == ["id", "name"]

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
        return super().tearDownClass()
