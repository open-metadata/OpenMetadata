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
Test run sql query functions
"""

import datetime
import os
import unittest

import pytest
from openmetadata_managed_apis.operations.run_sql_query import (
    execute_sql_query,
    get_row_count,
    get_subquery_wrapper,
)
from sqlalchemy import (
    TEXT,
    Column,
    Date,
    DateTime,
    Integer,
    String,
    Time,
    create_engine,
)
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql.selectable import Alias

from metadata.generated.schema.entity.automations.runQueryRequest import QueryTypes
from metadata.generated.schema.entity.automations.runQueryResponse import (
    Data,
    RunQueryResponse,
)
from metadata.profiler.orm.registry import Dialects

Base = declarative_base()


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


class TestRunQuery(unittest.TestCase):
    """
    Test run sql query functions
    """

    @classmethod
    def setUpClass(cls) -> None:
        """Setup class for test"""
        cls.db_path = os.path.join(
            os.path.dirname(__file__), f"{os.path.splitext(__file__)[0]}.db"
        )
        cls.engine = create_engine(f"sqlite:///{cls.db_path}")

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
            ),
        ]

        Session = sessionmaker()
        cls.session = Session(bind=cls.engine)

        with cls.session as sess:
            sess.add_all(data)
            sess.commit()

    @classmethod
    def tearDownClass(cls) -> None:
        os.remove(cls.db_path)
        return super().tearDownClass()

    def test_row_count(self):
        """Test row_count function"""

        query = """
        SELECT * FROM users
        """
        curs = self.engine.execute(query)
        rowcount = get_row_count(curs)

        expected = RunQueryResponse(
            queryType=QueryTypes.TEST.value,
            data=Data(columnNames=["rowCount"], rowValues=[[3]]),
            error=None,
            offset=None,
            limit=None,
        )

        assert rowcount == expected

        query = """
        SELECT * FROM fake_users
        """

        with pytest.raises(OperationalError):
            curs = self.engine.execute(query)
            get_row_count(curs)

    def test_get_subquery_wrapper(self):
        query = """
        WITH foo AS (
            SELECT * FROM users
        ) SELECT * FROM foo
        """
        subquery = get_subquery_wrapper(self.session, query)
        assert type(subquery) is Alias

    def test_execute_sql_query(self):
        query = """
        WITH foo AS (
            SELECT * FROM users
        ) SELECT * FROM foo
        """
        limit = 2
        offset = 1

        results = execute_sql_query(
            Dialects.SQLite,
            self.session,
            query,
            QueryTypes.RUN,
            limit=limit,
            offset=offset,
        )

        assert results.data.columnNames == [col.name for col in User.__table__.columns]
        assert len(results.data.rowValues) == 2
        assert results.offset == (limit + offset)

        results = execute_sql_query(
            Dialects.SQLite,
            self.session,
            query,
            QueryTypes.TEST,
            limit=limit,
            offset=offset,
        )

        assert results.data.columnNames == ["rowCount"]
        assert results.data.rowValues[0][0] == 3
