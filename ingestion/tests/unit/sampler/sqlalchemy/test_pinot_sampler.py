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
Tests for PinotDB sampling functionality
"""
from typing import Generator, List, Tuple
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import Query, declarative_base
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    ConstraintType,
    DataType,
    ProfileSampleType,
    Table,
    TableConstraint,
)
from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBConnection,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.pinot.sampler import PinotDBSampler
from metadata.sampler.sqlalchemy.sampler import SQASampler

Base = declarative_base()


class SampleTable(Base):
    __tablename__ = "test_table"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    status = Column(String(20))


class TestPinotDBSampler:
    """Test PinotDBSampler hash-based sampling functionality"""

    @pytest.fixture(autouse=True)
    def connection(self) -> PinotDBConnection:
        """Set up test fixtures"""
        return PinotDBConnection(
            username="test",
            hostPort="localhost:8099",
            pinotControllerHost="localhost:9000",
            database="test",
        )

    @pytest.fixture(autouse=True)
    def mock_random_table_name(
        self,
    ) -> Generator[Tuple[MagicMock, MagicMock], None, None]:
        with patch.object(
            SQASampler, "build_table_orm", return_value=SampleTable
        ) as mock:
            with patch.object(
                SQASampler, "get_sampler_table_name", return_value="test_table"
            ) as mock_name:
                yield mock, mock_name

    @pytest.fixture
    def table_constraints(self) -> List[TableConstraint]:
        return [
            TableConstraint(
                columns=["id"],
                constraintType=ConstraintType.PRIMARY_KEY,
            )
        ]

    @pytest.fixture
    def table_entity(self, table_constraints: List[TableConstraint]) -> Table:
        """Helper to create Table entity with specified columns and constraints"""
        return Table(
            id=uuid4(),
            name="test_table",
            columns=[
                EntityColumn(name=ColumnName(root="id"), dataType=DataType.INT),
                EntityColumn(name=ColumnName(root="name"), dataType=DataType.STRING),
                EntityColumn(name=ColumnName(root="status"), dataType=DataType.STRING),
            ],
            tableConstraints=table_constraints,
        )

    def test_get_sampling_columns_with_primary_key(
        self, connection: PinotDBConnection, table_entity: Table
    ) -> None:
        """Test column selection with PRIMARY KEY table constraint"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        columns = sampler._get_sampling_columns()
        assert columns == [SampleTable.id]

    @pytest.mark.parametrize(
        "table_constraints",
        ([TableConstraint(columns=["name"], constraintType=ConstraintType.UNIQUE)],),
    )
    def test_get_sampling_columns_with_unique_constraint(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test column selection with UNIQUE table constraint"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        columns = sampler._get_sampling_columns()
        assert columns == [SampleTable.name]

    @pytest.mark.parametrize("table_constraints", ([],))
    def test_get_sampling_columns_fallback_all(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test column selection fallback to all columns"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        columns = sampler._get_sampling_columns()
        assert len(columns) == 3
        assert SampleTable.id in columns
        assert SampleTable.name in columns
        assert SampleTable.status in columns

    def test_build_hash_expression_single_column(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test hash expression generation with single column"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        hash_expr = sampler._build_hash_expression(["id"])
        compiled = str(hash_expr.compile(compile_kwargs={"literal_binds": True}))

        assert "SUBSTR" in compiled
        assert "MD5" in compiled
        assert "CAST" in compiled
        assert "id" in compiled
        assert "VARCHAR" in compiled
        assert "0" in compiled
        assert "2" in compiled

    def test_build_hash_expression_single_column_with_quotable_name(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test hash expression generation with quotable column name"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        hash_expr = sampler._build_hash_expression(["quotable id"])
        compiled = str(hash_expr.compile(compile_kwargs={"literal_binds": True}))

        assert "SUBSTR" in compiled
        assert "MD5" in compiled
        assert "CAST" in compiled
        assert "VARCHAR" in compiled
        assert '"quotable id"' in compiled or "'quotable id'" in compiled
        assert "0" in compiled
        assert "2" in compiled

    def test_build_hash_expression_multiple_columns(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test hash expression generation with multiple columns"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        hash_expr = sampler._build_hash_expression(["id", "name"])
        compiled = str(hash_expr.compile(compile_kwargs={"literal_binds": True}))

        assert "SUBSTR" in compiled
        assert "MD5" in compiled
        assert "CONCAT" in compiled
        assert "CAST" in compiled
        assert "id" in compiled
        assert "name" in compiled
        assert "VARCHAR" in compiled
        assert "0" in compiled
        assert "2" in compiled

    def test_sample_query_percentage_sampling(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that get_sample_query generates correct SQL for percentage sampling"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        query: CTE = sampler.get_sample_query()
        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True})).lower()

        assert "with test_table_rnd as" in query_str
        assert "select" in query_str
        assert "md5" in query_str or "substr" in query_str

    def test_sample_query_row_sampling(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that get_sample_query generates correct SQL for row count sampling"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.ROWS, profileSample=100
            ),
        )

        with patch.object(Query, "count", return_value=500):
            query: CTE = sampler.get_sample_query()

        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True})).lower()
        assert "limit" in query_str
        assert "100" in query_str

    def test_sample_query_percentage_contains_hash_functions(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that percentage sampling query contains all required hash functions"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        query: CTE = sampler.get_sample_query()
        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True}))

        assert "SUBSTR" in query_str or "substr" in query_str.lower()
        assert "MD5" in query_str or "md5" in query_str.lower()
        assert "CAST" in query_str or "cast" in query_str.lower()
        assert "VARCHAR" in query_str or "varchar" in query_str.lower()

    def test_sample_query_percentage_contains_where_clause(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that percentage sampling includes WHERE clause for filtering"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        query: CTE = sampler.get_sample_query()
        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True})).lower()

        assert "where" in query_str
        assert "random" in query_str
        assert "<=" in query_str

    def test_sample_query_percentage_hex_threshold(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that percentage sampling uses correct hex threshold value"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=25.0
            ),
        )

        query: CTE = sampler.get_sample_query()
        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True}))

        assert "40" in query_str or "'40'" in query_str

    def test_sample_query_no_random_function(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that the query does NOT use RANDOM() function"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        query: CTE = sampler.get_sample_query()
        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True})).upper()

        assert "RANDOM()" not in query_str
        assert "RAND()" not in query_str

    def test_build_hash_expression_with_three_columns(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test hash expression with all three columns"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
            salt="ABCDE",
        )

        engine = sampler.session_factory().bind

        hash_expr = sampler._build_hash_expression(
            [SampleTable.id, SampleTable.name, SampleTable.status]
        )
        compiled = str(
            hash_expr.compile(engine, compile_kwargs={"literal_binds": True})
        )

        assert (
            compiled
            == """SUBSTR(
    MD5(
        toUtf8(
            CONCAT(
                CAST(test_table.id AS VARCHAR),
                CONCAT(
                    CAST(test_table."name" AS VARCHAR),
                    CAST(test_table.status AS VARCHAR),
                    'ABCDE'
                ),
                'ABCDE'
            )
        )
    ),
    0,
    2
)""".replace(
                "\n", ""
            )
            .replace(",", ", ")
            .replace("    ", "")
        )

    def test_build_hash_expression_empty_columns_raises_error(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that empty column list raises ValueError"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        with pytest.raises(ValueError, match="No columns specified"):
            sampler._build_hash_expression([])

    def test_sample_query_uses_primary_key_in_hash(
        self, connection: PinotDBConnection, table_entity: Table
    ):
        """Test that sampling uses PRIMARY KEY column in hash expression"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )

        engine = sampler.session_factory().bind
        query: CTE = sampler.get_sample_query()

        assert query is not None
        query_str = str(query.compile(engine, compile_kwargs={"literal_binds": True}))

        assert (
            "SUBSTR(MD5(toUtf8(CAST(test_table.id AS VARCHAR))), 0, 2) AS random"
            in query_str
        )

    @pytest.mark.parametrize(
        "percentage,expected_hex",
        [
            (0.0, "00"),
            (25.0, "40"),
            (50.0, "80"),
            (75.0, "c0"),
            (100.0, "xx"),
        ],
    )
    def test_sample_query_percentage_to_hex_conversion(
        self,
        connection: PinotDBConnection,
        table_entity: Table,
        percentage: float,
        expected_hex: str,
    ):
        """Test correct conversion from percentage to hex threshold"""

        sampler = PinotDBSampler(
            service_connection_config=connection,
            ometa_client=None,
            entity=table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=percentage
            ),
        )

        query: CTE = sampler.get_sample_query()
        assert query is not None
        query_str = str(query.compile(compile_kwargs={"literal_binds": True}))

        assert (
            f"WHERE test_table_rnd.random <= CAST('{expected_hex}' AS VARCHAR)"
            in query_str
        )
