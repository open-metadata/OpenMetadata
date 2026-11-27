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
"""Teradata binary types retain their metadata types without eager driver imports."""

import pytest

from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser


@pytest.mark.parametrize("type_name,expected", [("BYTE", "BINARY"), ("VARBYTE", "VARBINARY")])
@pytest.mark.parametrize("length", [None, 1, 64000])
def test_binary_type_instances(type_name, expected, length):
    teradata = pytest.importorskip("teradatasqlalchemy")
    column_type = getattr(teradata, type_name)(length=length)

    assert ColumnTypeParser.get_column_type(column_type) == expected


@pytest.mark.parametrize(
    "column_type,expected",
    [
        ("BYTE", "BINARY"),
        ("VARBYTE", "VARBINARY"),
        ("BYTE(32)", "BINARY"),
        ("VARBYTE(32)", "VARBINARY"),
        ("byte(32)", "BINARY"),
        ("varbyte(32)", "VARBINARY"),
    ],
)
def test_binary_type_names(column_type, expected):
    assert ColumnTypeParser.get_column_type(column_type) == expected
