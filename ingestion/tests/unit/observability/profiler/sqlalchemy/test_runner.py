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

import sys
import time
from unittest import TestCase, mock
from unittest.mock import Mock, patch

import pytest
from sqlalchemy import TEXT, Column, Integer, String, create_engine, func
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.models import (
    ProfileSampleConfig,
    SampleConfig,
)
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.timeout import cls_timeout


class Base(DeclarativeBase):
    pass


if sys.version_info < (3, 9):  # noqa: UP036
    pytest.skip(
        "requires python 3.9+ due to incompatibility with object patch",
        allow_module_level=True,
    )


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

    def slow(self):
        time.sleep(10)
        return 1

    def fast(self):
        return 1


class RunnerTest(TestCase):
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

        with (
            patch.object(SQASampler, "get_client", return_value=cls.session),
            patch.object(SQASampler, "build_table_orm", return_value=User),
            mock.patch(
                "metadata.sampler.sqlalchemy.sampler.get_ssl_connection",
                return_value=Mock(),
            ),
        ):
            sampler = SQASampler.__new__(SQASampler)
            sampler.build_table_orm = lambda *args, **kwargs: User
            sampler.__init__(
                service_connection_config=Mock(),
                ometa_client=None,
                entity=None,
                config=DatabaseSamplerConfig(
                    sample_config=SampleConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType=SampleConfigType.STATIC,
                            config=StaticSamplingConfig(profileSample=50.0),
                        )
                    )
                ),
            )
            cls.dataset = sampler.get_dataset()

        cls.raw_runner = QueryRunner(session=cls.session, dataset=cls.dataset, raw_dataset=sampler.raw_dataset)
        cls.timeout_runner: Timer = cls_timeout(1)(Timer())

        # Insert 30 rows
        for i in range(10):  # noqa: B007
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

        query = self.session.query(func.count()).select_from(self.dataset)
        res = self.raw_runner.select_first_from_query(query)
        assert res[0] < 30

        query = self.session.query(Column(User.name.name)).select_from(User)
        res = self.raw_runner.select_all_from_query(query)
        assert len(res) == 30

        query = self.session.query(func.count()).select_from(self.dataset)
        res = self.raw_runner.select_all_from_query(query)
        assert len(res) < 30

    def test_timeout_runner(self):
        """
        Check that timeout alarms get executed
        """
        assert self.timeout_runner.fast() == 1

        with pytest.raises(TimeoutError):
            self.timeout_runner.slow()

    def test_select_from_statement(self):
        """
        Test querying using `from_statement` returns expected values
        """
        stmt = "SELECT name FROM users"
        self.raw_runner.profile_sample_query = stmt

        res = self.raw_runner.select_all_from_table(Column(User.name.name))
        assert len(res) == 30

        res = self.raw_runner.select_first_from_table(Column(User.name.name))
        assert len(res) == 1

        stmt = "SELECT id FROM users"
        self.raw_runner.profile_sample_query = stmt

        with pytest.raises(OperationalError):
            self.raw_runner.select_first_from_table(Column(User.name.name))

        self.raw_runner.profile_sample_query = None


@pytest.mark.parametrize("raw_kind", ["table", "orm"])
def test_table_reference_uses_raw_physical_table(raw_kind):
    from sqlalchemy import MetaData, Table
    from sqlalchemy.orm import Session

    physical = Table("Order.Items", MetaData(), Column("id", Integer, primary_key=True))
    raw = physical if raw_kind == "table" else type("Physical", (Base,), {"__table__": physical})
    with Session(create_engine("sqlite://")) as session:
        runner = QueryRunner(session, User, raw, profile_sample_query="SELECT * FROM decoy")
        assert runner.get_table_reference() == '"Order.Items"'


@pytest.mark.parametrize("raw", [None, "orders", object()])
def test_table_reference_rejects_missing_physical_table_before_connection(raw):
    session = Mock()
    runner = QueryRunner(session, User, raw)
    with pytest.raises(ValueError, match="physical SQLAlchemy Table"):
        runner.get_table_reference()
    session.connection.assert_not_called()


@pytest.mark.parametrize("source_schema,target_schema", [("logical", "main"), (None, "main"), ("logical", None)])
def test_table_reference_uses_connection_schema_translation(source_schema, target_schema):
    from sqlalchemy import MetaData, Table
    from sqlalchemy.orm import Session

    engine = create_engine("sqlite://")
    physical = Table("orders", MetaData(), Column("id", Integer), schema=source_schema)
    with (
        engine.connect().execution_options(schema_translate_map={source_schema: target_schema}) as connection,
        Session(connection) as session,
    ):
        runner = QueryRunner(session, User, physical)
        physical.metadata.create_all(connection)
        session.execute(physical.insert(), [{"id": 1}])
        assert runner.get_table_reference() == "main.orders"
        from sqlalchemy import select, text

        assert session.execute(select(physical.c.id)).scalar() == 1
        assert session.execute(text(f"SELECT id FROM {runner.get_table_reference()}")).scalar() == 1
