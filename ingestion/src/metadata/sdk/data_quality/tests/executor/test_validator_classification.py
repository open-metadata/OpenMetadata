"""Unit tests for validator classification system."""

import pytest

from metadata.sdk.data_quality.executor.validator_classification import (
    VALIDATOR_EXECUTION_MODE,
    ValidatorExecutionMode,
    get_validator_execution_mode,
)


@pytest.mark.parametrize(
    "validator",
    [
        "columnValuesToBeNotNull",
        "columnValuesToBeBetween",
        "columnValuesToMatchRegex",
        "columnValuesToNotMatchRegex",
        "columnValueLengthsToBeBetween",
        "columnValuesMissingCount",
        "columnValuesToBeInSet",
        "columnValuesToBeNotInSet",
        "columnValuesToBeAtExpectedLocation",
    ],
)
def test_chunked_validators(validator):
    """Test that row-level validators are classified as CHUNKED."""
    assert (
        get_validator_execution_mode(validator) == ValidatorExecutionMode.CHUNKED
    ), f"{validator} should be CHUNKED"


@pytest.mark.parametrize(
    "validator",
    [
        "tableRowCountToBeBetween",
        "tableRowCountToEqual",
        "tableColumnCountToBeBetween",
        "tableColumnCountToEqual",
        "tableColumnNameToExist",
        "tableColumnToMatchSet",
    ],
)
def test_table_chunked_validators(validator):
    """Test that table-level row count validators are classified as CHUNKED."""
    assert (
        get_validator_execution_mode(validator) == ValidatorExecutionMode.CHUNKED
    ), f"{validator} should be CHUNKED"


@pytest.mark.parametrize(
    "validator",
    [
        "columnValuesToBeUnique",
        "columnValueMeanToBeBetween",
        "columnValueMedianToBeBetween",
        "columnValueStdDevToBeBetween",
        "columnValueMinToBeBetween",
        "columnValueMaxToBeBetween",
        "columnValuesSumToBeBetween",
        "tableDiff",
        "tableCustomSQLQuery",
        "tableRowInsertedCountToBeBetween",
    ],
)
def test_full_table_validators(validator):
    """Test that statistical validators are classified as FULL_TABLE."""
    assert (
        get_validator_execution_mode(validator) == ValidatorExecutionMode.FULL_TABLE
    ), f"{validator} should be FULL_TABLE"


@pytest.mark.parametrize(
    "validator",
    [
        "unknownValidator",
        "newCustomValidator",
        "futureValidator",
    ],
)
def test_unknown_validator_defaults_to_full_table(validator):
    """Test that unknown validators default to FULL_TABLE for safety."""
    assert (
        get_validator_execution_mode(validator) == ValidatorExecutionMode.FULL_TABLE
    ), f"Unknown validator {validator} should default to FULL_TABLE"


def test_all_validators_have_execution_mode():
    """Test that all validators in the mapping have a valid execution mode."""
    for validator_name, mode in VALIDATOR_EXECUTION_MODE.items():
        assert isinstance(
            mode, ValidatorExecutionMode
        ), f"{validator_name} should have ValidatorExecutionMode"


def test_enum_values():
    """Test that enum values are correct."""
    assert ValidatorExecutionMode.CHUNKED.value == "chunked"
    assert ValidatorExecutionMode.FULL_TABLE.value == "full_table"


def test_validator_count():
    """Test that we have classified a reasonable number of validators."""
    assert (
        len(VALIDATOR_EXECUTION_MODE) > 20
    ), "Should have at least 20 validators classified"
