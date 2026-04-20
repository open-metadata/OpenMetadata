#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""ProfileAssert + NumericAssert — table-level profile polling with numeric comparators."""

from __future__ import annotations

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from tests.cli_e2e_v2.core.fluent.eventually import retry_until


class NumericAssert:
    """Terminal numeric comparators for a single metric value.

    Instantiated by ProfileAssert.row_count() (and future per-column accessors).
    Each method raises AssertionError when the value doesn't match.
    """

    def __init__(self, value: int | float | None, *, label: str) -> None:
        self._value = value
        self._label = label

    def at_least(self, n: int) -> None:
        if self._value is None or self._value < n:
            raise AssertionError(f"{self._label}: expected ≥ {n}, got {self._value}")

    def equals(self, n: int) -> None:
        if self._value != n:
            raise AssertionError(f"{self._label}: expected {n}, got {self._value}")

    def between(self, lo: int, hi: int) -> None:
        if self._value is None or not (lo <= self._value <= hi):
            raise AssertionError(f"{self._label}: expected in [{lo}, {hi}], got {self._value}")


class ProfileAssert:
    """Profile namespace — reached via TableAssert.profile.

    Profiler output is asynchronous from ingestion (even when the profile
    command succeeds, the post-ingest indexing may not have caught up
    immediately). All profile reads support .eventually(timeout).
    """

    def __init__(self, om: OpenMetadata, table_fqn: str) -> None:
        self._om = om
        self._table_fqn = table_fqn
        self._eventually_timeout: int | None = None

    def eventually(self, timeout: int = 60) -> "ProfileAssert":
        self._eventually_timeout = timeout
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
        """Extract rowCount from the table profile, returning a NumericAssert.

        When .eventually() is set, polls until profile.rowCount is non-None
        (then hands off to the NumericAssert comparators for further assertions).
        """
        label = f"rowCount({self._table_fqn})"

        def _get() -> int | None:
            table = self._fetch_profile()
            return int(table.profile.rowCount) if table.profile.rowCount is not None else None

        if self._eventually_timeout is not None:
            timeout = self._eventually_timeout
            self._eventually_timeout = None

            def _check() -> int:
                v = _get()
                if v is None:
                    raise AssertionError(f"{label}: no rowCount yet")
                return v

            value = retry_until(_check, timeout=timeout, name=label)
            return NumericAssert(value, label=label)

        return NumericAssert(_get(), label=label)
