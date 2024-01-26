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
Tests utils function for the profiler
"""
import uuid
from datetime import datetime
from unittest import TestCase
from unittest.mock import patch

import pytest
from sqlalchemy import Column
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql.sqltypes import Integer, String

from metadata.generated.schema.entity.data.table import Column as OMetaColumn
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.metrics.hybrid.histogram import Histogram
from metadata.profiler.metrics.system.queries.snowflake import (
    get_snowflake_system_queries,
)
from metadata.profiler.metrics.system.system import recursive_dic
from metadata.utils.profiler_utils import (
    get_identifiers_from_string,
    get_value_from_cache,
    set_cache,
)
from metadata.utils.sqa_utils import is_array

from .conftest import LowerRow, Row

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
    row = Row(
        query_id="1",
        query_type="INSERT",
        start_time=datetime.now(),
        query_text="INSERT INTO DATABASE.SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
    )

    # We don't need the ometa_client nor the db_service if we have all the db.schema.table in the query
    query_result = get_snowflake_system_queries(
        row=row, database="DATABASE", schema="SCHEMA", ometa_client=..., db_service=...
    )  # type: ignore
    assert query_result
    assert query_result.query_id == "1"
    assert query_result.query_type == "INSERT"
    assert query_result.database_name == "database"
    assert query_result.schema_name == "schema"
    assert query_result.table_name == "table1"

    row = Row(
        query_id=1,
        query_type="INSERT",
        start_time=datetime.now(),
        query_text="INSERT INTO SCHEMA.TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
    )

    query_result = get_snowflake_system_queries(
        row=row, database="DATABASE", schema="SCHEMA", ometa_client=..., db_service=...
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
    row = Row(
        query_id=1,
        query_type=expected,
        start_time=datetime.now(),
        query_text=query,
    )

    lower_row = LowerRow(
        query_id=1,
        query_type=expected,
        start_time=datetime.now(),
        query_text=query,
    )

    query_result = get_snowflake_system_queries(
        row=row, database="DATABASE", schema="SCHEMA", ometa_client=..., db_service=...
    )  # type: ignore

    assert query_result
    assert query_result.query_type == expected
    assert query_result.database_name == "database"
    assert query_result.schema_name == "schema"
    assert query_result.table_name == "table1"

    query_result = get_snowflake_system_queries(
        row=row, database="DATABASE", schema="SCHEMA", ometa_client=..., db_service=...
    )  # type: ignore

    assert query_result
    assert query_result.query_type == expected
    assert query_result.database_name == "database"
    assert query_result.schema_name == "schema"
    assert query_result.table_name == "table1"


def test_get_snowflake_system_queries_from_es():
    """Test the ES integration"""

    ometa_client = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider=AuthProvider.openmetadata,
            enableVersionValidation=False,
            securityConfig=OpenMetadataJWTClientConfig(jwtToken="token"),
        )
    )

    db_service = DatabaseService(
        id=uuid.uuid4(),
        name=EntityName(__root__="service"),
        fullyQualifiedName=FullyQualifiedEntityName(__root__="service"),
        serviceType=DatabaseServiceType.CustomDatabase,
    )

    table = Table(
        id=uuid.uuid4(),
        name="TABLE",
        columns=[OMetaColumn(name="id", dataType=DataType.BIGINT)],
        database=EntityReference(id=uuid.uuid4(), type="database", name="database"),
        databaseSchema=EntityReference(
            id=uuid.uuid4(), type="databaseSchema", name="schema"
        ),
    )

    # With too many responses, we won't return anything since we don't want false results
    # that we cannot properly assign
    with patch.object(OpenMetadata, "es_search_from_fqn", return_value=[table] * 4):
        row = Row(
            query_id=1,
            query_type="INSERT",
            start_time=datetime.now(),
            query_text="INSERT INTO TABLE1 (col1, col2) VALUES (1, 'a'), (2, 'b')",
        )
        query_result = get_snowflake_system_queries(
            row=row,
            database="DATABASE",
            schema="SCHEMA",
            ometa_client=ometa_client,
            db_service=db_service,
        )
        assert not query_result

    # Returning a single table should work fine
    with patch.object(OpenMetadata, "es_search_from_fqn", return_value=[table]):
        row = Row(
            query_id=1,
            query_type="INSERT",
            start_time=datetime.now(),
            query_text="INSERT INTO TABLE2 (col1, col2) VALUES (1, 'a'), (2, 'b')",
        )
        query_result = get_snowflake_system_queries(
            row=row,
            database="DATABASE",
            schema="SCHEMA",
            ometa_client=ometa_client,
            db_service=db_service,
        )
        assert query_result
        assert query_result.query_type == "INSERT"
        assert query_result.database_name == "database"
        assert query_result.schema_name == "schema"
        assert query_result.table_name == "table2"


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
