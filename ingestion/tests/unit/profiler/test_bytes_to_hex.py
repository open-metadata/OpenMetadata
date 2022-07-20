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
Test Metrics behavior
"""


from sqlalchemy import BINARY, INTEGER, Column, String

from metadata.orm_profiler.profiler.utils import (
    bytes_to_hex,
    get_bytes_column_indexes,
    transform_bytes_to_hex,
)


def test_bytes_to_hex():
    """tests transformation logic"""
    data = (
        1,
        b"r\x9e4J\x01\xe5,\x82+\xdf\xde\xc6",
        "foo",
        b"\xbax\x16\xbf\x8f\x01\xcf\xeaAA@\xde",
    )
    indexes = [1, 3]

    transformed = transform_bytes_to_hex(data, indexes)
    expected = (1, "729e344a01e52c822bdfdec6", "foo", "ba7816bf8f01cfea414140de")

    assert transformed == expected


def test_bytes_to_hex_empty_bytes():
    """tests if empty bytes list return expected types"""
    data = (1, None, "foo", None)
    indexes = [1, 3]

    transformed = transform_bytes_to_hex(data, indexes)
    expected = (1, None, "foo", None)

    print(transformed)

    assert transformed == expected


def test_get_bytes_column_indexes():
    """test we get the correct indexes from SQA column list"""
    columns = [
        Column("a", INTEGER),
        Column("a", BINARY),
        Column("a", String),
        Column("a", INTEGER),
    ]

    expected = [1]
    output = get_bytes_column_indexes(columns)

    assert expected == output


def test_get_bytes_column_indexes_no_bytes_columns():
    """test we get the correct indexes from SQA column list"""
    columns = [
        Column("a", INTEGER),
        Column("a", String),
        Column("a", INTEGER),
    ]

    expected = None
    output = get_bytes_column_indexes(columns)

    assert expected == output


def test_end_to_end():
    """end to end test to handle bytes fields"""
    columns = [
        Column("a", INTEGER),
        Column("a", BINARY),
        Column("a", String),
        Column("a", BINARY),
    ]
    data = [
        (1, b"", "foo", b""),
        (
            1,
            b"r\x9e4J\x01\xe5,\x82+\xdf\xde\xc6",
            "foo",
            b"\xbax\x16\xbf\x8f\x01\xcf\xeaAA@\xde",
        ),
    ]

    indexes = get_bytes_column_indexes(columns)
    output = bytes_to_hex(data, indexes)
    expected = [
        (1, "", "foo", ""),
        (1, "729e344a01e52c822bdfdec6", "foo", "ba7816bf8f01cfea414140de"),
    ]

    assert expected == output
