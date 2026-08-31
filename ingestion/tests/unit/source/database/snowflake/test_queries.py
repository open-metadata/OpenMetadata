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

"""Unit tests for the Snowflake session query tag statement"""

import pytest

from metadata.ingestion.source.database.snowflake.queries import set_session_tag_query


@pytest.mark.parametrize(
    "query_tag,expected",
    [
        ("my_tag", "ALTER SESSION SET QUERY_TAG='my_tag'"),
        (
            '{"app":"OpenMetadata"}',
            'ALTER SESSION SET QUERY_TAG=\'{"app":"OpenMetadata"}\'',
        ),
        ("it's a tag", "ALTER SESSION SET QUERY_TAG='it''s a tag'"),
        ("C:\\temp", "ALTER SESSION SET QUERY_TAG='C:\\\\temp'"),
        ("tag\\", "ALTER SESSION SET QUERY_TAG='tag\\\\'"),
        (
            "x' STATEMENT_TIMEOUT_IN_SECONDS=1 Y='",
            "ALTER SESSION SET QUERY_TAG='x'' STATEMENT_TIMEOUT_IN_SECONDS=1 Y='''",
        ),
    ],
    ids=[
        "plain",
        "json",
        "apostrophe",
        "backslash-escape",
        "trailing-backslash",
        "parameter-injection",
    ],
)
def test_set_session_tag_query_keeps_the_tag_inside_one_string_literal(query_tag, expected):
    assert set_session_tag_query(query_tag) == expected
