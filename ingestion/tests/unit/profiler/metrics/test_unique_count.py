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
Validate the UniqueCount metric query building
"""

from unittest.mock import Mock

from sqlalchemy import Column, String
from sqlalchemy.sql.sqltypes import NullType

from metadata.profiler.metrics.static.unique_count import UniqueCount
from metadata.profiler.orm.registry import Dialects


def test_bigquery_unique_count():
    """The BigQuery COUNTIF path must not carry the source column type into the comparison"""
    session_mock = Mock()
    session_mock.get_bind().dialect.name = Dialects.BigQuery

    unique_count_metric = UniqueCount(Column("test_col", String))
    result = unique_count_metric.query(sample=None, session=session_mock)

    assert "countif" in str(result).lower()

    # The column referenced inside COUNTIF must be untyped (NullType) so the literal `1`
    # binds as INT64 and matches the numeric COUNT subquery output. A typed column would
    # bind `1` as STRING/BYTES and fail on BigQuery with:
    #   No matching signature for operator = for argument types: INT64, STRING
    countif_args = list(result.element.clauses)
    binary_expression = countif_args[0]

    assert binary_expression.left.name == "test_col"
    assert isinstance(binary_expression.left.type, NullType)
