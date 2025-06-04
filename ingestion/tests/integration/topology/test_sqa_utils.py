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
sqlalchemy utility tests
"""

import pytest
import sqlalchemy
from sqlalchemy import Column, text

from metadata.utils.sqa_utils import build_query_filter, dispatch_to_date_or_datetime

FILTER_TEST_DATA = [
    (
        [(Column("foo"), "eq", "foo"), (Column("bar"), "ne", "bar")],
        "foo = 'foo' AND bar != 'bar'",
    ),
    ([(Column("foo"), "gt", 1), (Column("bar"), "lt", 2)], "foo > 1 AND bar < 2"),
    ([(Column("foo"), "in", [1, 2, 3, 4])], "foo IN (1, 2, 3, 4)"),
    ([(Column("foo"), "not_in", [1, 2, 3, 4])], "(foo NOT IN (1, 2, 3, 4))"),
]

DISPATCH_TEST_DATA = [
    (1, "DAY", sqlalchemy.DATE(), "CAST(CURRENT_DATE - interval '1' DAY  AS DATE)"),
    (
        1,
        "HOUR",
        sqlalchemy.DATETIME(),
        "CAST(CURRENT_TIMESTAMP - interval '1' HOUR AS TIMESTAMP)",
    ),
]


@pytest.mark.parametrize(
    "filters,expected", FILTER_TEST_DATA, ids=["eq", "gt_lt", "in", "not_in"]
)
def test_build_query_filter(filters, expected):
    """Test SQA query filter builder"""
    filter_ = build_query_filter(filters, False)
    assert filter_.compile(compile_kwargs={"literal_binds": True}).string == expected


@pytest.mark.parametrize(
    "interval,interval_type,type_,expected",
    DISPATCH_TEST_DATA,
    ids=["date", "datetime"],
)
def test_dispatch_to_date_or_datetime(interval, interval_type, type_, expected):
    """Test dispatch function"""
    fn = dispatch_to_date_or_datetime(interval, text(interval_type), type_)

    assert fn.compile(compile_kwargs={"literal_binds": True}).string == expected
