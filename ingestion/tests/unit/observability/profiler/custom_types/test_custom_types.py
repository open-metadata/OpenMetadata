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

import json
from unittest import TestCase
from unittest.mock import MagicMock

import pytest
from sqlalchemy import TEXT, Column, Integer, String, create_engine
from sqlalchemy.orm import Session, declarative_base

from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    comments = Column(TEXT)
    age = Column(Integer)
    config = Column(HexByteString)


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
        """test HexByteString correctly returns a string from a memoryview value"""
        assert isinstance(self.session.query(User.config).first().config, str)

    @classmethod
    def tearDownClass(cls) -> None:
        User.__table__.drop(bind=cls.engine)
        return super().tearDownClass()


MOCK_DIALECT = MagicMock()


class TestHexByteStringResultIsJsonSerializable:
    """Ensure HexByteString output is safe for PostgreSQL jsonb storage."""

    converter = HexByteString()

    @pytest.mark.parametrize(
        "data",
        [
            b"simple ascii",
            b"null\x00byte",
            b"\x00\x00\x00",
            b"\x89PNG\r\n\x1a\n\x00\x00",
            bytes(range(256)),
            b"\xff\xfe\xfd\xfc",
            memoryview(b"\x00binary\x00data\x00"),
            bytearray(b"\x00test\x00"),
        ],
        ids=[
            "ascii",
            "embedded_null_byte",
            "only_null_bytes",
            "png_header",
            "all_byte_values",
            "high_bytes",
            "memoryview_with_nulls",
            "bytearray_with_nulls",
        ],
    )
    def test_result_is_json_safe(self, data):
        result = self.converter.process_result_value(data, MOCK_DIALECT)
        assert isinstance(result, str)
        assert "\x00" not in result
        json.dumps(result)
