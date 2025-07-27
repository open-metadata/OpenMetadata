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
Tests utils function for the profiler
"""
from datetime import datetime
from unittest import TestCase
from unittest.mock import Mock

import pytest
from sqlalchemy import Column
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql.sqltypes import Integer, String

from metadata.ingestion.source.database.snowflake.models import SnowflakeQueryLogEntry
from metadata.profiler.metrics.hybrid.histogram import Histogram
from metadata.profiler.metrics.system.snowflake.system import (
    SnowflakeTableResovler,
    get_snowflake_system_queries,
)
from metadata.profiler.metrics.system.system import recursive_dic
from metadata.utils.profiler_utils import (
    get_identifiers_from_string,
    get_value_from_cache,
    set_cache,
)
from metadata.utils.sqa_utils import is_array

Base = declarative_base()


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(30))
    fullname = Column(String)


class TestHistogramUtils(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.histogram = Histogram()

    def test_histogram_label_formatter_positive(self):
        """test label formatter for histogram"""
        formatted_label = self.histogram._format_bin_labels(18927, 23456)
        assert formatted_label == "18.927K to 23.456K"

        formatted_label = self.histogram._format_bin_labels(18927)
        assert formatted_label == "18.927K and up"

    def test_histogram_label_formatter_negative(self):
        """test label formatter for histogram for negative numbers"""
        formatted_label = self.histogram._format_bin_labels(-18927, -23456)
        assert formatted_label == "-18.927K to -23.456K"

        formatted_label = self.histogram._format_bin_labels(-18927)
        assert formatted_label == "-18.927K and up"

    def test_histogram_label_formatter_none(self):
        """test label formatter for histogram for None"""
        formatted_label = self.histogram._format_bin_labels(None)
        assert formatted_label == "null and up"

    def test_histogram_label_formatter_zero(self):
        """test label formatter for histogram with zero"""
        formatted_label = self.histogram._format_bin_labels(0)
        assert formatted_label == "0 and up"

    def test_histogram_label_formatter_nines(self):
        """test label formatter for histogram for nines"""
        formatted_label = self.histogram._format_bin_labels(99999999)
        assert formatted_label == "100.000M and up"

    def test_histogram_label_formatter_floats(self):
        """test label formatter for histogram for floats"""
        formatted_label = self.histogram._format_bin_labels(167893.98542, 194993.98542)
        assert formatted_label == "167.894K to 194.994K"


def test_is_array():
    """test is array function"""
    kwargs = {}
    assert is_array(kwargs) is False
    assert not kwargs

    kwargs = {"is_array": True, "array_col": "name"}
    assert kwargs["is_array"] is True
    assert is_array(kwargs) is True
    assert kwargs["array_col"] == "name"
    assert len(kwargs) == 1

    kwargs = {"is_array": False, "array_col": "name"}
    assert kwargs["is_array"] is False
    assert is_array(kwargs) is False
    assert not kwargs


def test_get_snowflake_system_queries():
    """Test get snowflake system queries"""
    row = SnowflakeQueryLogEntry(
        query_id="1",
        query_type="INSERT",
        start_time=datetime.now(),
        query_text="INSERT INTO DATABASE.SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
    )

    # We don't need the ometa_client nor the db_service if we have all the db.schema.table in the query
    resolver = SnowflakeTableResovler(Mock())
    query_result = get_snowflake_system_queries(
        query_log_entry=row,
        resolver=resolver,
    )  # type: ignore
    assert query_result
    assert query_result.query_id == "1"
    assert query_result.query_type == "INSERT"
    assert query_result.database_name == "database"
    assert query_result.schema_name == "schema"
    assert query_result.table_name == "table1"

    row = SnowflakeQueryLogEntry(
        query_id="1",
        query_type="INSERT",
        start_time=datetime.now(),
        query_text="INSERT INTO SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
    )

    query_result = get_snowflake_system_queries(
        query_log_entry=row,
        resolver=resolver,
    )  # type: ignore

    assert not query_result


@pytest.mark.parametrize(
    "query, expected",
    [
        (
            "INSERT INTO IDENTIFIER('DATABASE.SCHEMA.TABLE1') (col1, col2) VALUES (1, 'a'), (2, 'b')",
            "INSERT",
        ),
        (
            "INSERT INTO DATABASE.SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
            "INSERT",
        ),
        (
            "INSERT OVERWRITE INTO DATABASE.SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
            "INSERT",
        ),
        (
            "MERGE INTO DATABASE.SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
            "MERGE",
        ),
        ("DELETE FROM DATABASE.SCHEMA.TABLE1 WHERE val = 9999", "MERGE"),
        ("UPDATE DATABASE.SCHEMA.TABLE1 SET col1 = 1 WHERE val = 9999", "UPDATE"),
    ],
)
def test_get_snowflake_system_queries_all_dll(query, expected):
    """test we ca get all ddl queries
    reference https://docs.snowflake.com/en/sql-reference/sql-dml
    """
    row = SnowflakeQueryLogEntry(
        query_id="1",
        query_type=expected,
        start_time=datetime.now(),
        query_text=query,
    )
    resolver = Mock()
    resolver.resolve_snowflake_fqn = Mock(return_value=("database", "schema", "table1"))
    query_result = get_snowflake_system_queries(
        query_log_entry=row,
        resolver=resolver,
    )  # type: ignore

    assert query_result
    assert query_result.query_type == expected
    assert query_result.database_name == "database"
    assert query_result.schema_name == "schema"
    assert query_result.table_name == "table1"

    query_result = get_snowflake_system_queries(
        query_log_entry=SnowflakeQueryLogEntry.model_validate(row),
        resolver=resolver,
    )  # type: ignore

    assert query_result
    assert query_result.query_type == expected
    assert query_result.database_name == "database"
    assert query_result.schema_name == "schema"
    assert query_result.table_name == "table1"


@pytest.mark.parametrize(
    "identifier, expected",
    [
        ("DATABASE.SCHEMA.TABLE1", ("DATABASE", "SCHEMA", "TABLE1")),
        ('DATABASE.SCHEMA."TABLE.DOT"', ("DATABASE", "SCHEMA", "TABLE.DOT")),
        ('DATABASE."SCHEMA.DOT".TABLE', ("DATABASE", "SCHEMA.DOT", "TABLE")),
        ('"DATABASE.DOT".SCHEMA.TABLE', ("DATABASE.DOT", "SCHEMA", "TABLE")),
        ('DATABASE."SCHEMA.DOT"."TABLE.DOT"', ("DATABASE", "SCHEMA.DOT", "TABLE.DOT")),
        ('"DATABASE.DOT"."SCHEMA.DOT".TABLE', ("DATABASE.DOT", "SCHEMA.DOT", "TABLE")),
        (
            '"DATABASE.DOT"."SCHEMA.DOT"."TABLE.DOT"',
            ("DATABASE.DOT", "SCHEMA.DOT", "TABLE.DOT"),
        ),
        ("SCHEMA.TABLE", (None, "SCHEMA", "TABLE")),
        ("TABLE", (None, None, "TABLE")),
        ('"SCHEMA.DOT"."TABLE.DOT"', (None, "SCHEMA.DOT", "TABLE.DOT")),
    ],
)
def test_get_identifiers_from_string(identifier, expected):
    """test get identifiers from string"""
    assert get_identifiers_from_string(identifier) == expected


def test_cache_func():
    """test get and set cache"""
    cache_dict = recursive_dic()
    cache_value = [1, 2, 3, 4, 5]
    new_cache_value = [6, 7, 8, 9, 10]

    cache = get_value_from_cache(cache_dict, "key1.key2.key3")
    assert not cache

    set_cache(cache_dict, "key1.key2.key3", cache_value)
    cache = get_value_from_cache(cache_dict, "key1.key2.key3")
    assert cache == cache_value

    # calling set_cache on the same key will reset the cache
    set_cache(cache_dict, "key1.key2.key3", new_cache_value)
    cache = get_value_from_cache(cache_dict, "key1.key2.key3")
    assert cache == new_cache_value
