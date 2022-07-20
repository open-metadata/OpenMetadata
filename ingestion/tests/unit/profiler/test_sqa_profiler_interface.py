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
Test SQA Interface
"""

from unittest import TestCase

from pytest import raises
from sqlalchemy import TEXT, Column, Integer, String
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm.session import Session

from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.orm_profiler.interfaces.sqa_profiler_interface import SQAProfilerInterface
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.orm_profiler.profiler.sampler import Sampler


class User(declarative_base()):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)


class SQAProfilerInterfaceTest(TestCase):
    def setUp(self) -> None:
        sqlite_conn = SQLiteConnection(
            scheme=SQLiteScheme.sqlite_pysqlite,
        )
        self.sqa_profiler_interface = SQAProfilerInterface(sqlite_conn)
        self.table = User

    def test_init_interface(self):
        """Test we can instantiate our interface object correctly"""

        assert self.sqa_profiler_interface._sampler == None
        assert self.sqa_profiler_interface._runner == None
        assert isinstance(self.sqa_profiler_interface.session, Session)

    def test_create_sampler(self):
        """Test we can create our sampler correctly"""
        self.sqa_profiler_interface.create_sampler(
            self.table,
        )

        assert isinstance(self.sqa_profiler_interface.sampler, Sampler)

    def test_create_runner(self):
        """Test we can create our sampler correctly"""

        with raises(RuntimeError):
            self.sqa_profiler_interface.create_runner(self.table)

        self.sqa_profiler_interface.create_sampler(self.table)
        self.sqa_profiler_interface.create_runner(self.table)
        assert isinstance(self.sqa_profiler_interface.runner, QueryRunner)

    def test_private_attributes(self):
        with raises(AttributeError):
            self.sqa_profiler_interface.runner = None
            self.sqa_profiler_interface.sampler = None
            self.sqa_profiler_interface.sample = None

    def tearDown(self) -> None:
        self.sqa_profiler_interface._sampler = None
