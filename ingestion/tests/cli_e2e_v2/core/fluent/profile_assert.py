#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""ProfileAssert + ColumnProfileAssert + NumericAssert.

Two assertion surfaces:
  - table-level: row count via `.profile.eventually().row_count().equals(N)`
  - column-level: arbitrary metric subset via
    `.profile.eventually().column(name).has_metrics(min=600, max=750, ...)`

Both share the same poll-and-fetch primitive — when armed with
`.eventually(timeout)`, the profile is polled until present. Column-
metric assertion uses kwargs that map 1:1 to OM's ColumnProfile field
names; an unknown kwarg raises so a typo doesn't silently pass.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str

from .._om_compat import unwrap_root_list
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


class ColumnProfileAssert:
    """Per-column profile assertions reached via
    `.profile.eventually().column(name)`.

    `has_metrics(**expected)` accepts any subset of OM's ColumnProfile
    field names as kwargs (e.g. `min=600, max=750, distinctCount=5,
    nullCount=0, mean=680`). Each kwarg is compared against the
    corresponding profile field; numeric values that come back as
    Decimal/float are normalized for the comparison.
    """

    def __init__(
        self,
        om: OpenMetadata,
        table_fqn: str,
        column_name: str,
        runner: EventuallyRunner,
    ) -> None:
        self._om = om
        self._fqn = table_fqn
        self._column_name = column_name
        self._eventually = runner

    def has_metrics(self, **expected: Any) -> "ColumnProfileAssert":
        """Assert each given metric matches the column's actual profile.

        Unknown kwargs (typos / fields the OM Pydantic model doesn't
        carry) raise immediately so a misspelled metric name fails loud
        rather than silently passing.
        """
        if not expected:
            raise ValueError("has_metrics requires at least one kwarg")
        label = f"column_profile({self._fqn}.{self._column_name})"

        def _check() -> None:
            col = self._fetch_column_profile()
            mismatches: list[str] = []
            for field, want in expected.items():
                if not hasattr(col, field):
                    raise AssertionError(
                        f"{label}: unknown ColumnProfile field {field!r}. "
                        f"Available fields: "
                        f"{sorted(col.model_fields.keys())}"
                    )
                got = getattr(col, field)
                if not _values_match(got, want):
                    mismatches.append(f"{field}: expected {want!r}, got {got!r}")
            if mismatches:
                raise AssertionError(f"{label} metric mismatches:\n  " + "\n  ".join(mismatches))

        self._eventually.run(_check, name=f"has_metrics({sorted(expected)})")
        return self

    def _fetch_column_profile(self) -> Column:
        table = self._om.get_latest_table_profile(self._fqn)
        if table is None:
            raise AssertionError(f"Table not found: {self._fqn}")
        for c in unwrap_root_list(table.columns):
            if model_str(c.name) == self._column_name:
                if c.profile is None:
                    raise AssertionError(f"Column {self._fqn}.{self._column_name} has no profile yet")
                return c.profile
        raise AssertionError(f"Column {self._column_name!r} not found on table {self._fqn}")


class ProfileAssert:
    """Profile namespace — reached via TableAssert.profile.

    Profiler output is eventually-consistent; `.row_count()` and
    `.column(name)` both compose with `.eventually()` by polling until
    the data is available.
    """

    def __init__(self, om: OpenMetadata, table_fqn: str) -> None:
        self._om = om
        self._fqn = table_fqn
        self._eventually = EventuallyRunner()

    def eventually(self, timeout: int = 60) -> "ProfileAssert":
        self._eventually.arm(timeout)
        return self

    def _fetch_profile(self) -> Table:
        table = self._om.get_latest_table_profile(self._fqn)
        if table is None:
            raise AssertionError(f"Table not found: {self._fqn}")
        if table.profile is None:
            raise AssertionError(f"Table {self._fqn} has no profile data")
        return table

    def row_count(self) -> NumericAssert:
        """Extract rowCount from the profile, returning a NumericAssert.

        When armed via `.eventually()`, polls until `profile.rowCount` is
        non-None, then constructs NumericAssert with the polled value.
        """
        label = f"rowCount({self._fqn})"

        def _get() -> int:
            table = self._fetch_profile()
            if table.profile.rowCount is None:
                raise AssertionError(f"{label}: no rowCount yet")
            return int(table.profile.rowCount)

        value = self._eventually.run(_get, name=label)
        return NumericAssert(value, label=label)

    def column(self, name: str) -> ColumnProfileAssert:
        """Reach a ColumnProfileAssert scoped to the given column.

        Inherits the parent ProfileAssert's arm — calling
        `.profile.eventually().column(...)` makes the next column-level
        terminal poll, just like `.row_count()` does.
        """
        return ColumnProfileAssert(self._om, self._fqn, name, runner=self._eventually)


def _values_match(actual: Any, expected: Any) -> bool:
    """Compare profile-metric values tolerating Decimal/float/int crossover.

    OM serializes numeric profile metrics as Decimal in some cases and
    float in others; tests want to write `min=600` without thinking
    about which path the value took. Falls back to == for non-numeric
    types (strings, None, bools).
    """
    if actual is None:
        return False
    if isinstance(actual, (Decimal, float, int)) and isinstance(expected, (Decimal, float, int)):
        return float(actual) == float(expected)
    return actual == expected
