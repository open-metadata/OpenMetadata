"""Offline guard tests for ClickZetta native test execution."""

import pytest

from metadata.data_quality.interface.sqlalchemy.clickzetta.test_suite_interface import (
    ClickzettaTestSuiteInterface,
)


def test_clickzetta_allows_standard_read_only_test_definitions():
    for name in ("columnValuesToBeNotNull", "columnValuesToBeUnique", "tableRowCountToBeBetween"):
        ClickzettaTestSuiteInterface.validate_test_definition_name(name)


def test_clickzetta_rejects_unbounded_or_mutating_test_definitions():
    for name in ("tableCustomSQLQuery", "tableRuleLibrarySqlExpression", "tableDiff"):
        with pytest.raises(ValueError, match="not supported"):
            ClickzettaTestSuiteInterface.validate_test_definition_name(name)
