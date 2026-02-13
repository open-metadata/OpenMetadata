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

"""Table-level test definitions for DQ as Code API."""
from typing import List, Optional

from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.sdk.data_quality.tests.base_tests import TableTest


class TableColumnCountToBeBetween(TableTest):
    """Validates that the number of columns in a table falls within a specified range.

    This test checks if the column count is between the minimum and maximum values.
    Useful for schema validation and detecting unexpected column additions or removals.

    Args:
        min_count: Minimum acceptable number of columns (inclusive)
        max_count: Maximum acceptable number of columns (inclusive)
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableColumnCountToBeBetween(min_count=5, max_count=10)
        >>> test = TableColumnCountToBeBetween(min_count=5)  # Only minimum
    """

    def __init__(
        self,
        min_count: Optional[int] = None,
        max_count: Optional[int] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the number of columns in the table is between "
            f"{min_count or 'any'} and {max_count or 'any'}"
        )
        super().__init__(
            test_definition_name="tableColumnCountToBeBetween",
            name=name or "table_column_count_between",
            display_name=display_name or "Table Column Count Between",
            description=description or default_desc,
        )
        if min_count is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minColValue", value=str(min_count))
            )
        if max_count is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxColValue", value=str(max_count))
            )


class TableColumnCountToEqual(TableTest):
    """Validates that the table has an exact number of columns.

    This test ensures the column count matches a specific expected value.
    Useful for strict schema validation.

    Args:
        column_count: Expected number of columns in the table
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableColumnCountToEqual(column_count=10)
    """

    def __init__(
        self,
        column_count: int,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="tableColumnCountToEqual",
            name=name or "table_column_count_equals",
            display_name=display_name or "Table Column Count Equals",
            description=description
            or f"Validates that the table has exactly {column_count} columns",
        )
        self.parameters.append(
            TestCaseParameterValue(name="columnCount", value=str(column_count))
        )


class TableRowCountToBeBetween(TableTest):
    """Validates that the number of rows in a table falls within a specified range.

    This test checks if the row count is between the minimum and maximum values.
    Useful for monitoring data volume and detecting data loss or unexpected growth.

    Args:
        min_count: Minimum acceptable number of rows (inclusive)
        max_count: Maximum acceptable number of rows (inclusive)
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableRowCountToBeBetween(min_count=1000, max_count=5000)
        >>> test = TableRowCountToBeBetween(min_count=100)  # Only minimum
    """

    def __init__(
        self,
        min_count: Optional[int] = None,
        max_count: Optional[int] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the number of rows in the table is between "
            f"{min_count or 'any'} and {max_count or 'any'}"
        )
        super().__init__(
            test_definition_name="tableRowCountToBeBetween",
            name=name or "table_row_count_between",
            display_name=display_name or "Table Row Count Between",
            description=description or default_desc,
        )
        if min_count is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minValue", value=str(min_count))
            )
        if max_count is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxValue", value=str(max_count))
            )


class TableRowCountToEqual(TableTest):
    """Validates that the table has an exact number of rows.

    This test ensures the row count matches a specific expected value.
    Useful for validating fixed-size reference tables or dimension tables.

    Args:
        row_count: Expected number of rows in the table
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableRowCountToEqual(row_count=50)
    """

    def __init__(
        self,
        row_count: int,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="tableRowCountToEqual",
            name=name or "table_row_count_equals",
            display_name=display_name or "Table Row Count Equals",
            description=description
            or f"Validates that the table has exactly {row_count} rows",
        )
        self.parameters.append(
            TestCaseParameterValue(name="value", value=str(row_count))
        )


class TableRowInsertedCountToBeBetween(TableTest):
    """Validates that the number of rows inserted within a time range is within bounds.

    This test monitors data ingestion rates by checking if newly inserted rows
    fall within expected thresholds over a specified time period. Requires a timestamp
    column to track insertions.

    Args:
        column_name: Name of the timestamp/date/datetime column to check insertions
        min_count: Minimum acceptable number of inserted rows (inclusive)
        max_count: Maximum acceptable number of inserted rows (inclusive)
        range_type: Time unit for the range ("HOUR", "DAY", "MONTH", "YEAR")
        range_interval: Number of time units to look back
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableRowInsertedCountToBeBetween(column_name="created_at",
            min_count=100, max_count=1000, range_type="DAY", range_interval=1)
        >>> test = TableRowInsertedCountToBeBetween(column_name="inserted_at",
            min_count=50, range_type="HOUR", range_interval=6)
    """

    def __init__(  # pylint: disable=too-many-arguments
        self,
        column_name: str,
        min_count: Optional[int] = None,
        max_count: Optional[int] = None,
        range_type: str = "DAY",
        range_interval: int = 1,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that rows inserted in the last {range_interval} "
            f"{range_type.lower()}(s) is between {min_count or 'any'} "
            f"and {max_count or 'any'}"
        )
        super().__init__(
            test_definition_name="tableRowInsertedCountToBeBetween",
            name=name or "table_row_inserted_count_between",
            display_name=display_name or "Table Row Inserted Count Between",
            description=description or default_desc,
        )
        if min_count is not None:
            self.parameters.append(
                TestCaseParameterValue(name="min", value=str(min_count))
            )
        if max_count is not None:
            self.parameters.append(
                TestCaseParameterValue(name="max", value=str(max_count))
            )
        self.parameters.append(
            TestCaseParameterValue(name="columnName", value=column_name)
        )
        self.parameters.append(
            TestCaseParameterValue(name="rangeType", value=range_type)
        )
        self.parameters.append(
            TestCaseParameterValue(name="rangeInterval", value=str(range_interval))
        )


class TableColumnToMatchSet(TableTest):
    """Validates that table columns match an expected set of column names.

    This test ensures the table schema contains exactly the specified columns.
    Optionally can enforce column order matching.

    Args:
        column_names: List of expected column names
        ordered: If True, column order must match exactly
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableColumnToMatchSet(column_names=["id", "name", "email"])
        >>> test = TableColumnToMatchSet(column_names=["col1", "col2"], ordered=True)
    """

    def __init__(
        self,
        column_names: List[str],
        ordered: bool = False,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="tableColumnToMatchSet",
            name=name or "table_columns_match_set",
            display_name=display_name or "Table Columns Match Set",
            description=description
            or f"Validates that table columns {'exactly ' if ordered else ''}match the set: {column_names}",
        )
        self.parameters.append(
            TestCaseParameterValue(name="columnNames", value=str(column_names))
        )
        self.parameters.append(
            TestCaseParameterValue(name="ordered", value=str(ordered))
        )


class TableColumnNameToExist(TableTest):
    """Validates that a specific column exists in the table schema.

    This test checks for the presence of a required column by name.
    Useful for ensuring critical columns are not dropped from the schema.

    Args:
        column_name: Name of the column that must exist
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableColumnNameToExist(column_name="user_id")
    """

    def __init__(
        self,
        column_name: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="tableColumnNameToExist",
            name=name or f"table_column_{column_name}_exists",
            display_name=display_name or f"Column '{column_name}' Exists",
            description=description
            or f"Validates that column '{column_name}' exists in the table",
        )
        self.parameters.append(
            TestCaseParameterValue(name="columnName", value=column_name)
        )


class TableCustomSQLQuery(TableTest):
    """Validates data using a custom SQL query expression.

    This test allows you to define custom data quality logic using SQL.
    The query should return rows that fail the validation criteria.

    Args:
        sql_expression: SQL query to execute (returns failing rows)
        strategy: Validation strategy - "ROWS" counts failing rows, "COUNT" expects a count
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableCustomSQLQuery(
        ...     sql_expression="SELECT * FROM {table} WHERE price < 0",
        ...     strategy="ROWS"
        ... )
    """

    def __init__(
        self,
        sql_expression: str,
        strategy: str = "ROWS",
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="tableCustomSQLQuery",
            name=name or "custom_sql_query",
            display_name=display_name or "Custom SQL Query",
            description=description or "Validates data using a custom SQL query",
        )
        self.parameters.append(
            TestCaseParameterValue(name="sqlExpression", value=sql_expression)
        )
        self.parameters.append(TestCaseParameterValue(name="strategy", value=strategy))


class TableDiff(TableTest):
    """Compares two tables and identifies differences in their data.

    This test performs a row-by-row comparison between two tables to detect
    discrepancies. Useful for validating data migrations, replication, or transformations.

    Args:
        table2: Fully qualified name of the table to compare against
        key_columns: Columns to use as join keys for comparison
        table2_key_columns: Columns from table 2 to use as join keys for comparison
        use_columns: Specific columns to compare (compares all if not specified)
        threshold: Number of allowed diff rows before failing (defaults to 0)
        where: SQL WHERE clause to filter rows to compare
        case_sensitive_columns: Use case sensitivity when comparing columns
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = TableDiff(
        ...     table2="service.database.schema.reference_table",
        ...     key_columns=["id"],
        ...     use_columns=["name", "value"]
        ... )
    """

    def __init__(  # pylint: disable=too-many-arguments
        self,
        table2: str,
        key_columns: Optional[List[str]] = None,
        table2_key_columns: Optional[List[str]] = None,
        use_columns: Optional[List[str]] = None,
        threshold: Optional[int] = None,
        where: Optional[str] = None,
        case_sensitive_columns: Optional[bool] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="tableDiff",
            name=name or "table_diff",
            display_name=display_name or "Table Diff",
            description=description
            or f"Compares current table with {table2} to identify differences",
        )
        self.parameters.append(TestCaseParameterValue(name="table2", value=table2))
        if key_columns:
            self.parameters.append(
                TestCaseParameterValue(name="keyColumns", value=str(key_columns))
            )
        if table2_key_columns:
            self.parameters.append(
                TestCaseParameterValue(
                    name="table2.keyColumns", value=str(table2_key_columns)
                )
            )
        if use_columns:
            self.parameters.append(
                TestCaseParameterValue(name="useColumns", value=str(use_columns))
            )
        if threshold is not None:
            self.parameters.append(
                TestCaseParameterValue(name="threshold", value=str(threshold))
            )
        if where:
            self.parameters.append(TestCaseParameterValue(name="where", value=where))
        if case_sensitive_columns is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="caseSensitiveColumns", value=str(case_sensitive_columns)
                )
            )
