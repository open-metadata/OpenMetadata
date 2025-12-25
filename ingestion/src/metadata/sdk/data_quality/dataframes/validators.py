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
"""Registry of pandas validators."""

from metadata.data_quality.validations.column.pandas.columnValueLengthsToBeBetween import (
    ColumnValueLengthsToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValueMaxToBeBetween import (
    ColumnValueMaxToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValueMeanToBeBetween import (
    ColumnValueMeanToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValueMedianToBeBetween import (
    ColumnValueMedianToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValueMinToBeBetween import (
    ColumnValueMinToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesMissingCount import (
    ColumnValuesMissingCountValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesSumToBeBetween import (
    ColumnValuesSumToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValueStdDevToBeBetween import (
    ColumnValueStdDevToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeAtExpectedLocation import (
    ColumnValuesToBeAtExpectedLocationValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeBetween import (
    ColumnValuesToBeBetweenValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeInSet import (
    ColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeNotInSet import (
    ColumnValuesToBeNotInSetValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeNotNull import (
    ColumnValuesToBeNotNullValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeUnique import (
    ColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToMatchRegex import (
    ColumnValuesToMatchRegexValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToNotMatchRegex import (
    ColumnValuesToNotMatchRegexValidator,
)
from metadata.data_quality.validations.table.pandas.tableColumnCountToBeBetween import (
    TableColumnCountToBeBetweenValidator,
)
from metadata.data_quality.validations.table.pandas.tableColumnCountToEqual import (
    TableColumnCountToEqualValidator,
)
from metadata.data_quality.validations.table.pandas.tableColumnNameToExist import (
    TableColumnNameToExistValidator,
)
from metadata.data_quality.validations.table.pandas.tableColumnToMatchSet import (
    TableColumnToMatchSetValidator,
)
from metadata.data_quality.validations.table.pandas.tableRowCountToBeBetween import (
    TableRowCountToBeBetweenValidator,
)
from metadata.data_quality.validations.table.pandas.tableRowCountToEqual import (
    TableRowCountToEqualValidator,
)

VALIDATOR_REGISTRY = {
    "columnValuesToBeNotNull": ColumnValuesToBeNotNullValidator,
    "columnValuesToBeUnique": ColumnValuesToBeUniqueValidator,
    "columnValuesToBeBetween": ColumnValuesToBeBetweenValidator,
    "columnValuesToBeInSet": ColumnValuesToBeInSetValidator,
    "columnValuesToBeNotInSet": ColumnValuesToBeNotInSetValidator,
    "columnValuesToMatchRegex": ColumnValuesToMatchRegexValidator,
    "columnValuesToNotMatchRegex": ColumnValuesToNotMatchRegexValidator,
    "columnValueLengthsToBeBetween": ColumnValueLengthsToBeBetweenValidator,
    "columnValueMaxToBeBetween": ColumnValueMaxToBeBetweenValidator,
    "columnValueMeanToBeBetween": ColumnValueMeanToBeBetweenValidator,
    "columnValueMedianToBeBetween": ColumnValueMedianToBeBetweenValidator,
    "columnValueMinToBeBetween": ColumnValueMinToBeBetweenValidator,
    "columnValueStdDevToBeBetween": ColumnValueStdDevToBeBetweenValidator,
    "columnValuesSumToBeBetween": ColumnValuesSumToBeBetweenValidator,
    "columnValuesMissingCount": ColumnValuesMissingCountValidator,
    "columnValuesToBeAtExpectedLocation": ColumnValuesToBeAtExpectedLocationValidator,
    "tableRowCountToBeBetween": TableRowCountToBeBetweenValidator,
    "tableRowCountToEqual": TableRowCountToEqualValidator,
    "tableColumnCountToBeBetween": TableColumnCountToBeBetweenValidator,
    "tableColumnCountToEqual": TableColumnCountToEqualValidator,
    "tableColumnNameToExist": TableColumnNameToExistValidator,
    "tableColumnToMatchSet": TableColumnToMatchSetValidator,
}


VALIDATORS_THAT_REQUIRE_FULL_TABLE = {
    "columnValuesToBeUnique",
    "columnValueMeanToBeBetween",
    "columnValueMedianToBeBetween",
    "columnValueStdDevToBeBetween",
    "columnValuesSumToBeBetween",
    "columnValuesMissingCount",
    "tableRowCountToBeBetween",
    "tableRowCountToEqual",
}


def requires_whole_table(validator_name: str) -> bool:
    """Whether the validator requires a whole table to return appropriate results

    Examples:
        - `columnValuesToBeUnique` needs to see the whole column to make sure uniqueness is met
        - `tableRowCountToEqual` needs to see the whole table to make sure the expected row count is met

    These tests could return false positives when operating on batches

    Args:
        validator_name: The name of the validator to check

    Returns:
        Whether the validator requires a whole table to return appropriate results
    """
    return validator_name in VALIDATORS_THAT_REQUIRE_FULL_TABLE
