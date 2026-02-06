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
Test PinotDB-specific SQL function compilers
"""
import pytest
from sqlalchemy import Column, Integer, String, create_engine, literal, types
from sqlalchemy.orm import declarative_base

from metadata.profiler.orm.functions.cast import CastFn
from metadata.profiler.orm.functions.concat import ConcatFn
from metadata.profiler.orm.functions.md5 import MD5
from metadata.profiler.orm.functions.substr import Substr

Base = declarative_base()


class SampleTable(Base):
    __tablename__ = "test_table"
    id = Column(Integer, primary_key=True)
    name = Column(String(50))
    email = Column(String(100))
    status = Column(String(20))


class TestCastFn:
    """Test CAST function compilation"""

    @pytest.fixture
    def engine(self):
        """Create a generic SQL engine for testing"""
        return create_engine("sqlite:///:memory:")

    @pytest.fixture
    def pinot_engine(self):
        """Create a PinotDB engine for testing"""
        return create_engine("pinot://localhost:8099/default")

    def test_cast_basic_compilation(self, engine):
        """Test basic CAST compilation for standard SQL"""
        cast_expr = CastFn(SampleTable.id, types.String())
        compiled = str(
            cast_expr.compile(engine, compile_kwargs={"literal_binds": True})
        )

        assert compiled == "CAST(test_table.id AS VARCHAR)"

    def test_cast_with_column(self, engine):
        """Test CAST with column reference"""
        cast_expr = CastFn(SampleTable.name, types.Integer())
        compiled = str(
            cast_expr.compile(engine, compile_kwargs={"literal_binds": True})
        )

        assert compiled == "CAST(test_table.name AS INTEGER)"

    def test_cast_requires_two_arguments(self, engine):
        """Test CAST validation requires exactly 2 arguments"""
        with pytest.raises(TypeError):
            CastFn(SampleTable.id)


class TestConcatFn:
    """Test CONCAT function compilation"""

    @pytest.fixture
    def engine(self):
        """Create a generic SQL engine for testing"""
        return create_engine("sqlite:///:memory:")

    @pytest.fixture
    def pinot_engine(self):
        """Create a PinotDB engine for testing"""
        return create_engine("pinot://localhost:8099/default")

    def test_concat_standard_sql(self, engine):
        """Test standard SQL CONCAT compilation"""
        concat_expr = ConcatFn(SampleTable.name, SampleTable.email)
        compiled = str(
            concat_expr.compile(engine, compile_kwargs={"literal_binds": True})
        )

        assert "||" in compiled

    def test_concat_pinot_two_values(self, pinot_engine):
        """Test PinotDB CONCAT with two values"""
        concat_expr = ConcatFn(SampleTable.name, SampleTable.email)
        compiled = str(
            concat_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert compiled == "CONCAT(test_table.\"name\", test_table.email, '')"

    def test_concat_pinot_three_values(self, pinot_engine):
        """Test PinotDB CONCAT with three values"""
        concat_expr = ConcatFn(SampleTable.name, SampleTable.email, SampleTable.status)
        compiled = str(
            concat_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert (
            compiled == 'CONCAT(test_table."name", test_table.status, test_table.email)'
        )

    def test_concat_pinot_multiple_values(self, pinot_engine):
        """Test PinotDB CONCAT with four values creates nested structure"""

        concat_expr = ConcatFn(
            SampleTable.name, SampleTable.email, SampleTable.status, literal("test")
        )
        compiled = str(
            concat_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert (
            compiled
            == "CONCAT(test_table.\"name\", CONCAT(test_table.status, 'test', ''), test_table.email)"
        )

    def test_concat_requires_minimum_elements(self, engine):
        """Test CONCAT requires at least 2 elements"""
        with pytest.raises(ValueError, match="at least two elements"):
            concat_expr = ConcatFn(SampleTable.name)
            str(concat_expr.compile(engine))


class TestSubstr:
    """Test SUBSTR function compilation"""

    @pytest.fixture
    def engine(self):
        """Create a generic SQL engine for testing"""
        return create_engine("sqlite:///:memory:")

    @pytest.fixture
    def pinot_engine(self):
        """Create a PinotDB engine for testing"""
        return create_engine("pinot://localhost:8099/default")

    def test_substr_standard_sql(self, engine):
        """Test standard SQL SUBSTRING compilation"""
        substr_expr = Substr(SampleTable.name, literal(0), literal(5))
        compiled = str(
            substr_expr.compile(engine, compile_kwargs={"literal_binds": True})
        )

        assert "SUBSTRING" in compiled
        assert "0" in compiled
        assert "5" in compiled

    def test_substr_pinot(self, pinot_engine):
        """Test PinotDB SUBSTR compilation"""
        substr_expr = Substr(SampleTable.name, literal(0), literal(5))
        compiled = str(
            substr_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert compiled == 'SUBSTR(test_table."name", 0, 5)'

    def test_substr_pinot_with_expressions(self, pinot_engine):
        """Test PinotDB SUBSTR with complex expressions"""
        hash_expr = MD5(SampleTable.name)
        substr_expr = Substr(hash_expr, literal(0), literal(2))
        compiled = str(
            substr_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert compiled == 'SUBSTR(MD5(toUtf8(test_table."name")), 0, 2)'

    def test_substr_requires_three_arguments(self, pinot_engine):
        """Test PinotDB SUBSTR requires exactly 3 arguments"""
        from sqlalchemy import literal

        with pytest.raises(TypeError, match="requires 3 clauses"):
            substr_expr = Substr(SampleTable.name, literal(0))
            str(
                substr_expr.compile(
                    pinot_engine, compile_kwargs={"literal_binds": True}
                )
            )


class TestPinotFunctionIntegration:
    """Test integration of PinotDB functions for sampling queries"""

    @pytest.fixture
    def pinot_engine(self):
        """Create a PinotDB engine for testing"""
        return create_engine("pinot://localhost:8099/default")

    def test_hash_based_sampling_expression(self, pinot_engine):
        """Test complete hash-based sampling expression compilation"""

        cast_expr = CastFn(SampleTable.id, types.String())
        hash_expr = MD5(cast_expr)
        substr_expr = Substr(hash_expr, literal(0), literal(2))

        compiled = str(
            substr_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert compiled == "SUBSTR(MD5(toUtf8(CAST(test_table.id AS VARCHAR))), 0, 2)"

    def test_multi_column_hash_expression(self, pinot_engine):
        """Test hash expression with multiple columns concatenated"""

        cast1 = CastFn(SampleTable.id, types.String())
        cast2 = CastFn(SampleTable.name, types.String())
        seed = literal("ABC123", types.String)

        concat_expr = ConcatFn(cast1, seed, cast2, seed, type_=types.String)
        hash_expr = MD5(concat_expr)
        substr_expr = Substr(hash_expr, literal(0), literal(2))

        compiled = str(
            substr_expr.compile(pinot_engine, compile_kwargs={"literal_binds": True})
        )

        assert (
            compiled
            == "SUBSTR(MD5(toUtf8(CONCAT(CAST(test_table.id AS VARCHAR), CONCAT(CAST(test_table.\"name\" AS VARCHAR), 'ABC123', ''), 'ABC123'))), 0, 2)"
        )

    def test_hex_comparison_value(self):
        """Test hex value generation for percentage sampling"""
        percentage = 50.0
        expected_hex = format(int(256 * percentage / 100), "02x")

        assert expected_hex == "80"

    def test_hex_comparison_values_range(self):
        """Test hex values for different percentages"""
        test_cases = [
            (0.0, "00"),
            (25.0, "40"),
            (50.0, "80"),
            (75.0, "c0"),
            (99.9, "ff"),
        ]

        for percentage, expected_hex in test_cases:
            actual_hex = format(int(256 * percentage / 100), "02x")
            assert (
                actual_hex == expected_hex
            ), f"Failed for {percentage}%: expected {expected_hex}, got {actual_hex}"
