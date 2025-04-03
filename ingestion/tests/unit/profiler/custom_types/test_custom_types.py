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

"""Test SQA custom types are correctly maped"""

from unittest import TestCase

from sqlalchemy import TEXT, Column, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base

from metadata.profiler.orm.types.bytea_to_string import ByteaToHex

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)
    config = Column(ByteaToHex)


class TestCustomTypes(TestCase):
    """test for customer sqa types"""

    engine = create_engine("sqlite+pysqlite:///:memory:", echo=False, future=True)
    session = Session(engine)

    @classmethod
    def setUpClass(cls) -> None:
        User.__table__.create(bind=cls.engine)

        for i in range(10):
            data = [
                User(
                    name="John",
                    fullname="John Doe",
                    nickname="johnny b goode",
                    comments="no comments",
                    age=30,
                    config=memoryview(b"foo"),
                ),
                User(
                    name="Jane",
                    fullname="Jone Doe",
                    nickname=None,
                    comments="maybe some comments",
                    age=31,
                    config=memoryview(b"bar"),
                ),
                User(
                    name="John",
                    fullname="John Doe",
                    nickname=None,
                    comments=None,
                    age=None,
                    config=memoryview(b"fooBar"),
                ),
            ]
            cls.session.add_all(data)
            cls.session.commit()

    def test_bytea_to_hex(self):
        """test ByteaToHex correctly returns an hex from a memoryview value"""
        assert isinstance(self.session.query(User.config).first().config, str)

    @classmethod
    def tearDownClass(cls) -> None:
        User.__table__.drop(bind=cls.engine)
        return super().tearDownClass()
