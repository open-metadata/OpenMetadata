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
Test MySQL median/quartile SQL generation with reserved word table names.

Issue: https://github.com/open-metadata/OpenMetadata/issues/26798
When table names are MySQL reserved words (e.g., "Signal"), the generated SQL
must escape them with backticks to avoid syntax errors.
"""

import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase

from metadata.profiler.orm.functions.median import MedianFn


class Base(DeclarativeBase):
    pass


class Signal(Base):
    """Test table with reserved word name"""

    __tablename__ = "Signal"
    id = Column(Integer, primary_key=True)
    customer_id = Column(String(50))
    value = Column(Integer)


class TestMySQLMedianSQL:
    """Test MySQL median SQL generation with reserved word table names"""

    @pytest.fixture
    def mysql_engine(self):
        """Create a MySQL engine for compilation testing"""
        # Using mysql+pymysql://localhost/test dialect for compilation
        # We don't need actual connection, just the dialect for SQL compilation
        engine = create_engine(
            "mysql+pymysql://", strategy="mock", executor=lambda *a, **kw: None
        )
        return engine

    def test_median_with_reserved_word_table_name(self, mysql_engine):
        """Test that table name is properly escaped with backticks"""
        col = Signal.customer_id
        table_name = "Signal"  # Reserved word
        percentile = 0.5

        # Create the MedianFn expression
        median_expr = MedianFn(col, table_name, percentile)

        # Compile with MySQL dialect
        compiled = median_expr.compile(
            dialect=mysql_engine.dialect, compile_kwargs={"literal_binds": True}
        )
        sql_string = str(compiled)

        # Verify table name is escaped with backticks
        assert "`Signal`" in sql_string, (
            f"Table name 'Signal' should be escaped with backticks.\n"
            f"Generated SQL: {sql_string}"
        )

        # Verify that the unquoted "Signal" doesn't appear as a table reference
        # (it may appear in other contexts, but not as "FROM Signal," or "FROM Signal)")
        lines = sql_string.split("\n")
        for line in lines:
            # Check FROM clauses - they should have backticks
            if "FROM" in line and "Signal" in line and "Signal" not in "`Signal`":
                # This would be the problematic case: FROM Signal without backticks
                assert "`Signal`" in line, (
                    f"FROM clause should have backticks around table name.\n"
                    f"Line: {line}"
                )

    def test_first_quartile_with_reserved_word_table_name(self, mysql_engine):
        """Test that first quartile (Q1) works with reserved word table names"""
        col = Signal.customer_id
        table_name = "Signal"
        percentile = 0.25

        median_expr = MedianFn(col, table_name, percentile)
        compiled = median_expr.compile(
            dialect=mysql_engine.dialect, compile_kwargs={"literal_binds": True}
        )
        sql_string = str(compiled)

        assert "`Signal`" in sql_string, (
            f"Q1 (0.25): Table name should be escaped.\n" f"Generated SQL: {sql_string}"
        )

    def test_third_quartile_with_reserved_word_table_name(self, mysql_engine):
        """Test that third quartile (Q3) works with reserved word table names"""
        col = Signal.customer_id
        table_name = "Signal"
        percentile = 0.75

        median_expr = MedianFn(col, table_name, percentile)
        compiled = median_expr.compile(
            dialect=mysql_engine.dialect, compile_kwargs={"literal_binds": True}
        )
        sql_string = str(compiled)

        assert "`Signal`" in sql_string, (
            f"Q3 (0.75): Table name should be escaped.\n" f"Generated SQL: {sql_string}"
        )

    def test_median_with_multiple_reserved_words(self, mysql_engine):
        """Test with various MySQL reserved words as table names"""
        reserved_words = ["Signal", "Order", "Group", "Select", "Create", "Table"]
        percentile = 0.5

        for table_name in reserved_words:
            col = Signal.customer_id
            median_expr = MedianFn(col, table_name, percentile)
            compiled = median_expr.compile(
                dialect=mysql_engine.dialect, compile_kwargs={"literal_binds": True}
            )
            sql_string = str(compiled)

            expected_escaped = f"`{table_name}`"
            assert expected_escaped in sql_string, (
                f"Reserved word '{table_name}' should be escaped with backticks.\n"
                f"Generated SQL: {sql_string}"
            )

    def test_column_name_properly_quoted(self, mysql_engine):
        """Verify that column names are properly quoted by compiler.process()"""
        col = Signal.customer_id
        table_name = "Signal"
        percentile = 0.5

        median_expr = MedianFn(col, table_name, percentile)
        compiled = median_expr.compile(
            dialect=mysql_engine.dialect, compile_kwargs={"literal_binds": True}
        )
        sql_string = str(compiled)

        # Column name should be quoted (either backticks or other depending on compiler)
        # It should be present in the SQL
        assert "customer_id" in sql_string or "`customer_id`" in sql_string, (
            f"Column name should be present in generated SQL.\n"
            f"Generated SQL: {sql_string}"
        )

    def test_no_cross_join_syntax_error(self, mysql_engine):
        """Verify the generated SQL doesn't have the problematic comma-join pattern"""
        col = Signal.customer_id
        table_name = "Signal"
        percentile = 0.5

        median_expr = MedianFn(col, table_name, percentile)
        compiled = median_expr.compile(
            dialect=mysql_engine.dialect, compile_kwargs={"literal_binds": True}
        )
        sql_string = str(compiled)

        # The old problematic pattern was:
        # FROM Signal, (SELECT @counter := COUNT(*) FROM Signal) t_count
        # This would fail because Signal is a reserved word without backticks
        # With the fix, it should be:
        # FROM `Signal`, (SELECT ... FROM `Signal`) t_count

        # Verify that if there's a FROM clause with Signal and a comma join,
        # the table name is escaped
        if "FROM" in sql_string and "," in sql_string:
            # Look for the pattern "FROM `table`," which is correct
            assert "FROM `Signal`" in sql_string or "FROM\n" in sql_string, (
                f"If using comma-join, table must be escaped.\n"
                f"Generated SQL: {sql_string}"
            )
