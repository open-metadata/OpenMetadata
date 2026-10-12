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
Unit tests for ``TestCaseRunner._update_test_cases`` (the ``forceUpdate`` path).

The method patches existing test-case definitions on the server from CLI
overrides and returns the list of test cases the run should execute. These
tests pin down its observable contract: every overridden case is replaced
in-place by its patched version, unmatched cases pass through unchanged, and
a patch that returns ``None`` (e.g. the case was deleted server-side, or the
PATCH failed) keeps the original case as a fallback rather than dropping it.
"""

import uuid
from unittest.mock import MagicMock

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.data_quality.processor.test_case_runner import TestCaseRunner
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.testCase import (
    TestCase,
    TestCaseParameterValue,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.utils import entity_link

TABLE_FQN = "service.db.schema.users"


def _make_test_case(name: str, value: str, column_name: str | None = None) -> TestCase:
    """A server-side existing test case carrying its *old* parameter value."""
    return TestCase(
        id=str(uuid.uuid4()),
        name=name,
        testDefinition=EntityReference(
            id=str(uuid.uuid4()),
            type="testDefinition",
            name="test_def",
        ),
        testSuite=EntityReference(
            id=str(uuid.uuid4()),
            type="testSuite",
            name="test_suite",
        ),
        entityLink=entity_link.get_entity_link(Table, fqn=TABLE_FQN, column_name=column_name),
        parameterValues=[TestCaseParameterValue(name="p1", value=value)],
    )


def _make_definition(
    name: str,
    value: str,
    column_name: str | None = None,
    compute: bool | None = False,
) -> TestCaseDefinition:
    """A CLI-overridden test case definition to patch onto the server."""
    return TestCaseDefinition(
        name=name,
        testDefinitionName="test_def",
        columnName=column_name,
        parameterValues=[TestCaseParameterValue(name="p1", value=value)],
        computePassedFailedRowCount=compute,
    )


def _values(test_cases: list[TestCase]) -> list[str]:
    return [tc.parameterValues[0].value for tc in test_cases]


def _names(test_cases: list[TestCase]) -> list[str]:
    return [tc.name.root for tc in test_cases]


def _make_runner(
    success_names: set[str] | None = None,
) -> tuple[TestCaseRunner, MagicMock]:
    """Build a runner whose ``metadata.patch_test_case_definition`` is stubbed.

    ``success_names`` controls which inputs return a patched ``TestCase``;
    any name not in the set returns ``None`` (simulating a failed/skipped PATCH,
    e.g. the test case was deleted server-side before the PATCH landed). When
    omitted, every patch succeeds.
    """
    runner = TestCaseRunner.__new__(TestCaseRunner)
    runner.metadata = MagicMock()
    success = success_names if success_names is not None else {"*"}

    def _patch(*, test_case, entity_link, test_case_parameter_values, compute_passed_failed_row_count):
        if "*" not in success and test_case.name.root not in success:
            return None
        patched = test_case.model_copy(deep=True)
        patched.parameterValues = test_case_parameter_values
        patched.computePassedFailedRowCount = compute_passed_failed_row_count
        return patched

    runner.metadata.patch_test_case_definition.side_effect = _patch
    return runner, runner.metadata.patch_test_case_definition


def test_all_patches_succeed_returns_updated_in_order():
    """Every overridden case is replaced in-place by its patched version; no
    stale originals survive and no patched case is dropped."""
    test_cases = [_make_test_case(n, f"OLD_{n}") for n in ("A", "B", "C", "D", "E")]
    definitions = [_make_definition(n, f"PATCHED_{n}") for n in ("A", "B", "C", "D", "E")]

    runner, patch_fn = _make_runner()
    result = runner._update_test_cases(definitions, test_cases, TABLE_FQN)

    assert _names(result) == ["A", "B", "C", "D", "E"]
    assert _values(result) == ["PATCHED_A", "PATCHED_B", "PATCHED_C", "PATCHED_D", "PATCHED_E"]
    assert patch_fn.call_count == 5


def test_mixed_match_and_no_match_preserves_order():
    """Only cases with a CLI definition are patched; the rest pass through
    untouched, in their original position."""
    test_cases = [_make_test_case(n, f"OLD_{n}") for n in ("A", "B", "C", "D", "E")]
    definitions = [_make_definition(n, f"PATCHED_{n}") for n in ("A", "C", "E")]

    runner, patch_fn = _make_runner()
    result = runner._update_test_cases(definitions, test_cases, TABLE_FQN)

    assert _names(result) == ["A", "B", "C", "D", "E"]
    assert _values(result) == ["PATCHED_A", "OLD_B", "PATCHED_C", "OLD_D", "PATCHED_E"]
    assert patch_fn.call_count == 3


def test_mixed_success_and_failure_keeps_original_on_none():
    """When a patch returns ``None`` the original test case is kept (not
    dropped), and surrounding successful patches are unaffected."""
    test_cases = [_make_test_case(n, f"OLD_{n}") for n in ("A", "B", "C", "D", "E")]
    definitions = [_make_definition(n, f"PATCHED_{n}") for n in ("A", "B", "C", "D", "E")]

    runner, patch_fn = _make_runner(success_names={"A", "C", "E"})
    result = runner._update_test_cases(definitions, test_cases, TABLE_FQN)

    assert _names(result) == ["A", "B", "C", "D", "E"]
    assert _values(result) == ["PATCHED_A", "OLD_B", "PATCHED_C", "OLD_D", "PATCHED_E"]
    assert patch_fn.call_count == 5


def test_duplicate_cli_names_keep_the_first_definition():
    test_cases = [_make_test_case("A", "OLD_A")]
    definitions = [_make_definition("A", "FIRST_A"), _make_definition("A", "LAST_A")]
    runner, patch_fn = _make_runner()

    result = runner._update_test_cases(definitions, test_cases, TABLE_FQN)

    assert _values(result) == ["FIRST_A"]
    assert _values(test_cases) == ["OLD_A"]
    assert patch_fn.call_count == 1


def test_patch_called_with_correct_arguments_per_definition():
    """Each PATCH receives the definition's params, ``computePassedFailedRowCount``
    and an entity link built from the table FQN plus the definition's column
    name (table-level link when ``columnName`` is unset)."""
    test_cases = [
        _make_test_case("table_case", "OLD_t"),
        _make_test_case("col_case", "OLD_c", column_name="age"),
    ]
    definitions = [
        _make_definition("table_case", "PATCHED_t", compute=True),
        _make_definition("col_case", "PATCHED_c", column_name="age", compute=False),
    ]

    runner, patch_fn = _make_runner()
    runner._update_test_cases(definitions, test_cases, TABLE_FQN)

    calls = {call.kwargs["test_case"].name.root: call for call in patch_fn.call_args_list}
    assert set(calls) == {"table_case", "col_case"}

    assert calls["table_case"].kwargs["test_case_parameter_values"][0].value == "PATCHED_t"
    assert calls["table_case"].kwargs["compute_passed_failed_row_count"] is True
    assert calls["table_case"].kwargs["entity_link"] == "<#E::table::service.db.schema.users>"

    assert calls["col_case"].kwargs["test_case_parameter_values"][0].value == "PATCHED_c"
    assert calls["col_case"].kwargs["compute_passed_failed_row_count"] is False
    assert calls["col_case"].kwargs["entity_link"] == "<#E::table::service.db.schema.users::columns::age>"
