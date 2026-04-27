#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Protocol and base types for source baseline enforcement.

Per Decision #18 of the v2 spec, baseline enforcement follows a three-phase
lifecycle — introspect, compare, apply — that's uniform across source families
(SQL, Dashboard, Pipeline). MVP ships only the SQL family; the Protocol is
defined here so future families plug in without rework.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol


class BaselineSpec:
    """Marker base for family-specific baseline specs (SqlSourceBaseline, etc.).

    Deliberately minimal — subclasses carry the real declarative shape. This
    class exists so the orchestrator can type `expected: BaselineSpec` without
    depending on any specific family module.
    """


class DiffKind(Enum):
    """Why a `Diff` was produced.

    Replaces brittle string sentinels (``expected="present", actual="missing"``)
    with a typed discriminator. Lets downstream code filter diffs by kind
    (``[d for d in diffs if d.kind is DiffKind.MISSING]``) without re-parsing
    the human-readable expected/actual fields, and lets the renderer pick a
    one-liner vs. expected/actual block per kind.
    """

    MISSING = "missing"  # entity declared expected, not found in actual
    UNEXPECTED = "unexpected"  # STRICT mode: actual entity not in expected set
    VALUE_MISMATCH = "value"  # both sides present, a field differs


@dataclass(frozen=True)
class Diff:
    """One path-qualified discrepancy between expected and actual.

    Used for both source-side baseline drift (schema / tables / seeds)
    and OM-side catalog diffing (service / database / schema / table /
    column). Path uses bracket notation — `schema[e2e].table[users].column
    [email].type` — so failure output from either domain is scannable by
    eye and sortable for grouping.

    `expected` / `actual` are the human-readable values for VALUE_MISMATCH
    kinds; for MISSING / UNEXPECTED they are usually omitted (the kind
    itself carries the meaning). `__str__` renders accordingly.
    """

    path: str
    kind: DiffKind = DiffKind.VALUE_MISMATCH
    expected: Any = None
    actual: Any = None

    def __str__(self) -> str:
        if self.kind is DiffKind.MISSING:
            return f"  {self.path}: missing"
        if self.kind is DiffKind.UNEXPECTED:
            extra = f" ({self.actual!r})" if self.actual is not None else ""
            return f"  {self.path}: unexpected{extra}"
        return f"  {self.path}:\n    expected: {self.expected!r}\n    actual:   {self.actual!r}"


@dataclass(frozen=True)
class SourceState:
    """Opaque container for whatever `introspect()` found.

    Shape is family-specific (a SQL enforcer may fill it with dicts of tables
    keyed by (schema, name); a dashboard enforcer might fill it with API
    response dicts). The orchestrator never unpacks `payload` — that's the
    enforcer's private type.
    """

    payload: Any


class SourceBaselineEnforcer(Protocol):
    """Three-phase lifecycle implemented per connector family.

    Enforcers are constructed by the per-connector baseline module (e.g.,
    `<connector>/baseline.py`) and handed to the orchestrator via an
    EnforcementPolicy. The orchestrator calls these in order: introspect,
    compare, and (in apply mode) apply.
    """

    def introspect(self) -> SourceState: ...

    def compare(self, expected: BaselineSpec) -> list[Diff]: ...

    def apply(self, drifts: list[Diff]) -> None: ...
