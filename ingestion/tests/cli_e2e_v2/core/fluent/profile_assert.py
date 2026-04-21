#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""ProfileAssert + NumericAssert — table profile polling and numeric comparators."""

from __future__ import annotations

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .eventually import EventuallyRunner


class NumericAssert:
    """Terminal numeric comparators for a single metric value."""

    def __init__(self, value: int | float | None, *, label: str) -> None:
        self._value = value
        self._label = label

    def at_least(self, n: int) -> None:
        if self._value is None or self._value < n:
            raise AssertionError(f"{self._label}: expected >= {n}, got {self._value}")

    def equals(self, n: int) -> None:
        if self._value != n:
            raise AssertionError(f"{self._label}: expected {n}, got {self._value}")

    def between(self, lo: int, hi: int) -> None:
        if self._value is None or not (lo <= self._value <= hi):
            raise AssertionError(f"{self._label}: expected in [{lo}, {hi}], got {self._value}")


class ProfileAssert:
    """Profile namespace — reached via TableAssert.profile.

    Profiler output is eventually-consistent; `.row_count()` composes with
    `.eventually()` by polling until a non-None value appears, then handing
    off to NumericAssert for the comparison terminal.
    """

    def __init__(self, om: OpenMetadata, table_fqn: str) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60) -> "ProfileAssert":
        self._eventually.arm(timeout)
        return self

    def _fetch_profile(self) -> Table:
        table = self._om.get_by_name(
            entity=Table,
            fqn=self._table_fqn,
            fields=["profile"],
        )
        if table is None:
            raise AssertionError(f"Table not found: {self._table_fqn}")
        if table.profile is None:
            raise AssertionError(f"Table {self._table_fqn} has no profile data")
        return table

    def row_count(self) -> NumericAssert:
        """Extract rowCount from the profile, returning a NumericAssert.

        When armed via `.eventually()`, polls until `profile.rowCount` is
        non-None, then constructs NumericAssert with the polled value.
        """
        label = f"rowCount({self._table_fqn})"

        def _get() -> int:
            table = self._fetch_profile()
            if table.profile.rowCount is None:
                raise AssertionError(f"{label}: no rowCount yet")
            return int(table.profile.rowCount)

        value = self._eventually.run(_get, name=label)
        return NumericAssert(value, label=label)
