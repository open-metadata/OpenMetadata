"""Validator classification system for StreamingRunner.

This module determines which validators can work on DataFrame chunks vs requiring
the entire DataFrame. Chunked validators can aggregate results across chunks,
while full-table validators need to see all data at once.
"""

from enum import Enum
from typing import Dict


class ValidatorExecutionMode(Enum):
    """Execution mode for validators."""

    CHUNKED = "chunked"
    FULL_TABLE = "full_table"


VALIDATOR_EXECUTION_MODE: Dict[str, ValidatorExecutionMode] = {
    # Chunked validators: Can aggregate results across chunks
    # These validators work on row-by-row or simple count/presence checks
    "columnValuesToBeNotNull": ValidatorExecutionMode.CHUNKED,
    "columnValuesToBeBetween": ValidatorExecutionMode.CHUNKED,
    "columnValuesToMatchRegex": ValidatorExecutionMode.CHUNKED,
    "columnValuesToNotMatchRegex": ValidatorExecutionMode.CHUNKED,
    "columnValueLengthsToBeBetween": ValidatorExecutionMode.CHUNKED,
    "columnValuesMissingCount": ValidatorExecutionMode.CHUNKED,
    "columnValuesToBeInSet": ValidatorExecutionMode.CHUNKED,
    "columnValuesToBeNotInSet": ValidatorExecutionMode.CHUNKED,
    "tableRowCountToBeBetween": ValidatorExecutionMode.CHUNKED,
    "tableRowCountToEqual": ValidatorExecutionMode.CHUNKED,
    "tableColumnCountToBeBetween": ValidatorExecutionMode.CHUNKED,
    "tableColumnCountToEqual": ValidatorExecutionMode.CHUNKED,
    "tableColumnNameToExist": ValidatorExecutionMode.CHUNKED,
    "tableColumnToMatchSet": ValidatorExecutionMode.CHUNKED,
    "columnValuesToBeAtExpectedLocation": ValidatorExecutionMode.CHUNKED,
    # Full-table validators: Need entire DataFrame
    # These validators require global statistics or uniqueness checks
    "columnValuesToBeUnique": ValidatorExecutionMode.FULL_TABLE,
    "columnValueMeanToBeBetween": ValidatorExecutionMode.FULL_TABLE,
    "columnValueMedianToBeBetween": ValidatorExecutionMode.FULL_TABLE,
    "columnValueStdDevToBeBetween": ValidatorExecutionMode.FULL_TABLE,
    "columnValueMinToBeBetween": ValidatorExecutionMode.FULL_TABLE,
    "columnValueMaxToBeBetween": ValidatorExecutionMode.FULL_TABLE,
    "columnValuesSumToBeBetween": ValidatorExecutionMode.FULL_TABLE,
    "tableDiff": ValidatorExecutionMode.FULL_TABLE,
    "tableCustomSQLQuery": ValidatorExecutionMode.FULL_TABLE,
    "tableRowInsertedCountToBeBetween": ValidatorExecutionMode.FULL_TABLE,
}


def get_validator_execution_mode(test_definition_name: str) -> ValidatorExecutionMode:
    """Get execution mode for a validator.

    Args:
        test_definition_name: Validator name (e.g., "columnValuesToBeNotNull")

    Returns:
        ValidatorExecutionMode (defaults to FULL_TABLE if unknown)
    """
    return VALIDATOR_EXECUTION_MODE.get(
        test_definition_name,
        ValidatorExecutionMode.FULL_TABLE,
    )
