#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""TestsAssert + TestCaseAssert — data-quality test result assertions."""

from __future__ import annotations

from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from tests.cli_e2e_v2.core.fluent.eventually import retry_until


class TestsAssert:
    """Tests namespace — reached via TableAssert.tests.

    Serves as a builder for per-test-case assertions; the actual .passes() /
    .fails() live on TestCaseAssert.
    """

    def __init__(self, om: OpenMetadata, table_fqn: str) -> None:
        self._om = om
        self._table_fqn = table_fqn

    def case(self, name: str) -> "TestCaseAssert":
        return TestCaseAssert(self._om, self._table_fqn, name)


class TestCaseAssert:
    """Assertions on a single TestCase's latest result."""

    def __init__(self, om: OpenMetadata, table_fqn: str, test_case_name: str) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._test_case_name = test_case_name
        self._eventually_timeout: int | None = None

    def eventually(self, timeout: int = 60) -> "TestCaseAssert":
        self._eventually_timeout = timeout
        return self

    def _test_case_fqn(self) -> str:
        return f"{self._table_fqn}.{self._test_case_name}"

    def _latest_result_status(self) -> TestCaseStatus | None:
        fqn = self._test_case_fqn()
        test_case = self._om.get_by_name(entity=TestCase, fqn=fqn, fields=["testCaseResult"])
        if test_case is None:
            return None
        result = getattr(test_case, "testCaseResult", None)
        if result is None:
            return None
        return result.testCaseStatus

    def _run(self, expected: TestCaseStatus) -> None:
        fqn = self._test_case_fqn()

        def _check() -> None:
            actual = self._latest_result_status()
            if actual != expected:
                raise AssertionError(
                    f"Test case {fqn}: expected {expected}, got {actual}"
                )

        if self._eventually_timeout is not None:
            retry_until(_check, timeout=self._eventually_timeout, name=f"test_case({self._test_case_name})")
            self._eventually_timeout = None
        else:
            _check()

    def passes(self) -> None:
        self._run(TestCaseStatus.Success)

    def fails(self) -> None:
        self._run(TestCaseStatus.Failed)
