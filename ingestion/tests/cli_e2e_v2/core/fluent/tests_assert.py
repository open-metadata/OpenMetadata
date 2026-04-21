#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""TestsAssert + TestCaseAssert — data-quality test result assertions."""

from __future__ import annotations

from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .eventually import EventuallyRunner


class TestsAssert:
    """Tests namespace — reached via TableAssert.tests.

    Builder for per-test-case assertions; the actual `.passes()` / `.fails()`
    live on TestCaseAssert.
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
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60) -> "TestCaseAssert":
        self._eventually.arm(timeout)
        return self

    def _test_case_fqn(self) -> str:
        return f"{self._table_fqn}.{self._test_case_name}"

    def _latest_result_status(self) -> TestCaseStatus | None:
        test_case = self._om.get_by_name(
            entity=TestCase, fqn=self._test_case_fqn(), fields=["testCaseResult"]
        )
        if test_case is None or test_case.testCaseResult is None:
            return None
        return test_case.testCaseResult.testCaseStatus

    def _run(self, expected: TestCaseStatus) -> None:
        fqn = self._test_case_fqn()

        def _check() -> None:
            actual = self._latest_result_status()
            if actual != expected:
                raise AssertionError(
                    f"Test case {fqn}: expected {expected}, got {actual}"
                )

        self._eventually.run(_check, name=f"test_case({self._test_case_name})")

    def passes(self) -> None:
        self._run(TestCaseStatus.Success)

    def fails(self) -> None:
        self._run(TestCaseStatus.Failed)
