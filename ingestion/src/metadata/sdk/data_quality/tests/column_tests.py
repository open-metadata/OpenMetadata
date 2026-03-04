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

"""Column-level test definitions for DQ as Code API."""
from typing import List, Optional

from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.sdk.data_quality.tests.base_tests import ColumnTest


class ColumnValuesToBeInSet(ColumnTest):
    """Validates that all values in a column belong to a specified set of allowed values.

    This test ensures data integrity by checking that column values are constrained
    to a predefined list. Useful for enum-like columns or categorical data.

    Args:
        column: Name of the column to validate
        allowed_values: List of acceptable values for the column
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToBeInSet(column="status", allowed_values=["active", "inactive", "pending"])
        >>> test = ColumnValuesToBeInSet(column="country_code", allowed_values=["US", "UK", "CA"])
    """

    def __init__(
        self,
        column: str,
        allowed_values: List[str],
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToBeInSet",
            column=column,
            name=name or f"{column}_values_in_set",
            display_name=display_name or f"Column '{column}' Values In Set",
            description=description
            or f"Validates that all values in column '{column}' are within the allowed set: {allowed_values}",
        )
        self.parameters.append(
            TestCaseParameterValue(name="allowedValues", value=str(allowed_values))
        )


class ColumnValuesToBeNotInSet(ColumnTest):
    """Validates that column values do not contain any forbidden values.

    This test detects the presence of blacklisted or invalid values in a column.
    Useful for data quality checks where certain values should never appear.

    Args:
        column: Name of the column to validate
        forbidden_values: List of values that must not appear in the column
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToBeNotInSet(column="email", forbidden_values=["test@test.com", "admin@admin.com"])
        >>> test = ColumnValuesToBeNotInSet(column="status", forbidden_values=["deleted", "archived"])
    """

    def __init__(
        self,
        column: str,
        forbidden_values: List[str],
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToBeNotInSet",
            column=column,
            name=name or f"{column}_values_not_in_set",
            display_name=display_name or f"Column '{column}' Values Not In Set",
            description=description
            or f"Validates that no values in column '{column}' are in the forbidden set: {forbidden_values}",
        )
        self.parameters.append(
            TestCaseParameterValue(name="forbiddenValues", value=str(forbidden_values))
        )


class ColumnValuesToBeNotNull(ColumnTest):
    """Validates that a column contains no null or missing values.

    This test ensures data completeness by checking for NULL values in a column.
    One of the most common data quality tests for required fields.

    Args:
        column: Name of the column to validate
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToBeNotNull(column="user_id")
        >>> test = ColumnValuesToBeNotNull(column="email")
    """

    def __init__(
        self,
        column: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToBeNotNull",
            column=column,
            name=name or f"{column}_not_null",
            display_name=display_name or f"Column '{column}' Not Null",
            description=description
            or f"Validates that column '{column}' contains no null values",
        )


class ColumnValuesToBeUnique(ColumnTest):
    """Validates that all values in a column are unique with no duplicates.

    This test checks for duplicate values in columns that should contain unique identifiers
    or keys. Essential for primary key and unique constraint validation.

    Args:
        column: Name of the column to validate
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToBeUnique(column="user_id")
        >>> test = ColumnValuesToBeUnique(column="email")
    """

    def __init__(
        self,
        column: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToBeUnique",
            column=column,
            name=name or f"{column}_unique",
            display_name=display_name or f"Column '{column}' Unique",
            description=description
            or f"Validates that all values in column '{column}' are unique",
        )


class ColumnValuesToMatchRegex(ColumnTest):
    """Validates that column values match a specified regular expression pattern.

    This test ensures data format consistency by checking that values conform to
    expected patterns. Useful for emails, phone numbers, IDs, and formatted strings.

    Args:
        column: Name of the column to validate
        regex: Regular expression pattern that values must match
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToMatchRegex(column="email", regex=r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")
        >>> test = ColumnValuesToMatchRegex(column="phone", regex=r"^\\+?1?\\d{9,15}$")
    """

    def __init__(
        self,
        column: str,
        regex: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToMatchRegex",
            column=column,
            name=name or f"{column}_matches_regex",
            display_name=display_name or f"Column '{column}' Matches Regex",
            description=description
            or f"Validates that values in column '{column}' match the pattern: {regex}",
        )
        self.parameters.append(TestCaseParameterValue(name="regex", value=regex))


class ColumnValuesToNotMatchRegex(ColumnTest):
    """Validates that column values do not match a forbidden regular expression pattern.

    This test detects values that match unwanted patterns, useful for identifying
    invalid formats, test data, or security risks.

    Args:
        column: Name of the column to validate
        regex: Regular expression pattern that values must NOT match
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToNotMatchRegex(column="email", regex=r".*@test\\.com$")
        >>> test = ColumnValuesToNotMatchRegex(column="name", regex=r"^test.*")
    """

    def __init__(
        self,
        column: str,
        regex: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToNotMatchRegex",
            column=column,
            name=name or f"{column}_not_matches_regex",
            display_name=display_name or f"Column '{column}' Does Not Match Regex",
            description=description
            or f"Validates that values in column '{column}' do not match the pattern: {regex}",
        )
        self.parameters.append(
            TestCaseParameterValue(name="forbiddenRegex", value=regex)
        )


class ColumnValuesToBeBetween(ColumnTest):
    """Validates that all values in a column fall within a specified numeric range.

    This test checks that individual column values are between minimum and maximum bounds.
    Useful for validating numeric constraints, age ranges, prices, quantities, etc.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable value (inclusive)
        max_value: Maximum acceptable value (inclusive)
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToBeBetween(column="age", min_value=0, max_value=120)
        >>> test = ColumnValuesToBeBetween(column="price", min_value=0.01, max_value=9999.99)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToBeBetween",
            column=column,
            name=name or f"{column}_values_between",
            display_name=display_name or f"Column '{column}' Values Between",
            description=description
            or f"Validates that values in column '{column}' are between {min_value or 'any'} and {max_value or 'any'}",
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minValue", value=str(min_value))
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxValue", value=str(max_value))
            )


class ColumnValueMaxToBeBetween(ColumnTest):
    """Validates that the maximum value in a column falls within a specified range.

    This test computes the maximum value across all rows and checks if it's within bounds.
    Useful for monitoring data ranges and detecting outliers in the upper range.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable maximum value
        max_value: Maximum acceptable maximum value
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValueMaxToBeBetween(column="temperature", min_value=-50, max_value=50)
        >>> test = ColumnValueMaxToBeBetween(column="score", min_value=90, max_value=100)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the maximum value in column '{column}' "
            f"is between {min_value or 'any'} and {max_value or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValueMaxToBeBetween",
            column=column,
            name=name or f"{column}_max_between",
            display_name=display_name or f"Column '{column}' Max Between",
            description=description or default_desc,
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minValueForMaxInCol", value=str(min_value))
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxValueForMaxInCol", value=str(max_value))
            )


class ColumnValueMinToBeBetween(ColumnTest):
    """Validates that the minimum value in a column falls within a specified range.

    This test computes the minimum value across all rows and checks if it's within bounds.
    Useful for monitoring data ranges and detecting outliers in the lower range.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable minimum value
        max_value: Maximum acceptable minimum value
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValueMinToBeBetween(column="temperature", min_value=-50, max_value=0)
        >>> test = ColumnValueMinToBeBetween(column="age", min_value=0, max_value=18)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the minimum value in column '{column}' "
            f"is between {min_value or 'any'} and {max_value or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValueMinToBeBetween",
            column=column,
            name=name or f"{column}_min_between",
            display_name=display_name or f"Column '{column}' Min Between",
            description=description or default_desc,
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minValueForMinInCol", value=str(min_value))
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxValueForMinInCol", value=str(max_value))
            )


class ColumnValueMeanToBeBetween(ColumnTest):
    """Validates that the mean (average) value in a column falls within a specified range.

    This test computes the arithmetic mean of all values and checks if it's within bounds.
    Useful for statistical validation and detecting data drift in numeric columns.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable mean value
        max_value: Maximum acceptable mean value
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValueMeanToBeBetween(column="rating", min_value=3.0, max_value=4.5)
        >>> test = ColumnValueMeanToBeBetween(column="response_time_ms", min_value=100, max_value=500)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the mean value in column '{column}' "
            f"is between {min_value or 'any'} and {max_value or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValueMeanToBeBetween",
            column=column,
            name=name or f"{column}_mean_between",
            display_name=display_name or f"Column '{column}' Mean Between",
            description=description or default_desc,
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="minValueForMeanInCol", value=str(min_value)
                )
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="maxValueForMeanInCol", value=str(max_value)
                )
            )


class ColumnValueMedianToBeBetween(ColumnTest):
    """Validates that the median value in a column falls within a specified range.

    This test computes the median (middle value) and checks if it's within bounds.
    More robust than mean for skewed distributions, useful for detecting outliers.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable median value
        max_value: Maximum acceptable median value
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValueMedianToBeBetween(column="salary", min_value=50000, max_value=75000)
        >>> test = ColumnValueMedianToBeBetween(column="age", min_value=25, max_value=45)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the median value in column '{column}' "
            f"is between {min_value or 'any'} and {max_value or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValueMedianToBeBetween",
            column=column,
            name=name or f"{column}_median_between",
            display_name=display_name or f"Column '{column}' Median Between",
            description=description or default_desc,
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="minValueForMedianInCol", value=str(min_value)
                )
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="maxValueForMedianInCol", value=str(max_value)
                )
            )


class ColumnValueStdDevToBeBetween(ColumnTest):
    """Validates that the standard deviation of column values falls within a specified range.

    This test computes the standard deviation (measure of variance) and checks if it's within bounds.
    Useful for detecting unexpected data variability or consistency issues.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable standard deviation
        max_value: Maximum acceptable standard deviation
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValueStdDevToBeBetween(column="response_time", min_value=0, max_value=100)
        >>> test = ColumnValueStdDevToBeBetween(column="score", min_value=5, max_value=15)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the standard deviation in column '{column}' "
            f"is between {min_value or 'any'} and {max_value or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValueStdDevToBeBetween",
            column=column,
            name=name or f"{column}_stddev_between",
            display_name=display_name or f"Column '{column}' StdDev Between",
            description=description or default_desc,
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="minValueForStdDevInCol", value=str(min_value)
                )
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="maxValueForStdDevInCol", value=str(max_value)
                )
            )


class ColumnValuesSumToBeBetween(ColumnTest):
    """Validates that the sum of all values in a column falls within a specified range.

    This test computes the total sum across all rows and checks if it's within bounds.
    Useful for validating totals, aggregates, and detecting unexpected data volumes.

    Args:
        column: Name of the column to validate
        min_value: Minimum acceptable sum
        max_value: Maximum acceptable sum
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesSumToBeBetween(column="revenue", min_value=1000000, max_value=5000000)
        >>> test = ColumnValuesSumToBeBetween(column="quantity", min_value=100, max_value=1000)
    """

    def __init__(
        self,
        column: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that the sum of values in column '{column}' "
            f"is between {min_value or 'any'} and {max_value or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValuesSumToBeBetween",
            column=column,
            name=name or f"{column}_sum_between",
            display_name=display_name or f"Column '{column}' Sum Between",
            description=description or default_desc,
        )
        if min_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minValueForColSum", value=str(min_value))
            )
        if max_value is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxValueForColSum", value=str(max_value))
            )


class ColumnValuesMissingCount(ColumnTest):
    """Validates that the count of missing or null values meets expectations.

    This test counts rows with missing values and validates against expected thresholds.
    Supports custom missing value patterns beyond NULL (e.g., "N/A", "", "NULL").

    Args:
        column: Name of the column to validate
        missing_count_value: Expected number of missing values
        missing_value_match: List of strings to treat as missing values (optional)
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesMissingCount(column="optional_field", missing_count_value=100)
        >>> test = ColumnValuesMissingCount(column="status", missing_value_match=["N/A", "Unknown"])
    """

    def __init__(
        self,
        column: str,
        missing_count_value: Optional[int] = None,
        missing_value_match: Optional[List[str]] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesMissingCount",
            column=column,
            name=name or f"{column}_missing_count",
            display_name=display_name or f"Column '{column}' Missing Count",
            description=description
            or f"Validates the count of missing values in column '{column}'",
        )
        if missing_count_value is not None:
            self.parameters.append(
                TestCaseParameterValue(
                    name="missingCountValue", value=str(missing_count_value)
                )
            )
        if missing_value_match:
            self.parameters.append(
                TestCaseParameterValue(
                    name="missingValueMatch", value=str(missing_value_match)
                )
            )


class ColumnValueLengthsToBeBetween(ColumnTest):
    """Validates that the length of string values in a column falls within a specified range.

    This test checks character count for text columns, useful for validating string
    constraints, preventing truncation, and ensuring data format compliance.

    Args:
        column: Name of the column to validate
        min_length: Minimum acceptable string length
        max_length: Maximum acceptable string length
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValueLengthsToBeBetween(column="username", min_length=3, max_length=20)
        >>> test = ColumnValueLengthsToBeBetween(column="description", min_length=10, max_length=500)
    """

    def __init__(
        self,
        column: str,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        default_desc = (
            f"Validates that value lengths in column '{column}' "
            f"are between {min_length or 'any'} and {max_length or 'any'}"
        )
        super().__init__(
            test_definition_name="columnValueLengthsToBeBetween",
            column=column,
            name=name or f"{column}_length_between",
            display_name=display_name or f"Column '{column}' Length Between",
            description=description or default_desc,
        )
        if min_length is not None:
            self.parameters.append(
                TestCaseParameterValue(name="minLength", value=str(min_length))
            )
        if max_length is not None:
            self.parameters.append(
                TestCaseParameterValue(name="maxLength", value=str(max_length))
            )


class ColumnValuesToBeAtExpectedLocation(ColumnTest):
    """Validates that lat/long values in a column are at the expected location.

    This test checks if the latitude/longitude values match the expected location
    defined by a reference column (city or postal code) within a given radius.

    Args:
        column: Name of the column to validate
        location_reference_type: Type of location reference - "CITY" or "POSTAL_CODE"
        longitude_column_name: Name of the longitude column in the table
        latitude_column_name: Name of the latitude column in the table
        radius: Radius in meters from the expected location
        name: Custom test case name
        display_name: Custom display name for UI
        description: Custom test description

    Examples:
        >>> test = ColumnValuesToBeAtExpectedLocation(
        ...     column="city",
        ...     location_reference_type="CITY",
        ...     longitude_column_name="lon",
        ...     latitude_column_name="lat",
        ...     radius=5000.0,
        ... )
    """

    def __init__(  # pylint: disable=too-many-arguments
        self,
        column: str,
        location_reference_type: str,
        longitude_column_name: str,
        latitude_column_name: str,
        radius: float,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
    ):
        super().__init__(
            test_definition_name="columnValuesToBeAtExpectedLocation",
            column=column,
            name=name or f"{column}_at_expected_location",
            display_name=display_name or f"Column '{column}' At Expected Location",
            description=description
            or f"Validates that lat/long values in column '{column}' are within {radius}m of expected location",
        )
        self.parameters.append(
            TestCaseParameterValue(
                name="locationReferenceType", value=location_reference_type
            )
        )
        self.parameters.append(
            TestCaseParameterValue(
                name="longitudeColumnName", value=longitude_column_name
            )
        )
        self.parameters.append(
            TestCaseParameterValue(
                name="latitudeColumnName", value=latitude_column_name
            )
        )
        self.parameters.append(TestCaseParameterValue(name="radius", value=str(radius)))
