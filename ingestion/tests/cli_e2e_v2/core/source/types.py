#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Protocol and base types for source baseline enforcement.

Per Decision #18 of the v2 spec, baseline enforcement is a compare-then-apply
lifecycle that's uniform across source families (SQL, Dashboard, Pipeline).
MVP ships only the SQL family; the Protocol is defined here so future families
plug in without rework.
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
    """Typed discriminator for why a `Diff` was produced."""

    MISSING = "missing"  # entity declared expected, not found in actual
    UNEXPECTED = "unexpected"  # STRICT mode: actual entity not in expected set
    VALUE_MISMATCH = "value"  # both sides present, a field differs


@dataclass(frozen=True)
class Diff:
    """One path-qualified discrepancy between expected and actual state.

    Path uses bracket notation (`schema[e2e].table[users].column[email].type`).
    `expected` / `actual` are populated for VALUE_MISMATCH; omitted for
    MISSING / UNEXPECTED (the kind itself carries the meaning).
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


class SourceBaselineEnforcer(Protocol):
    """Compare-then-apply lifecycle implemented per connector family.

    Enforcers are constructed by the per-connector baseline module (e.g.,
    `<connector>/baseline.py`) and handed to the orchestrator via an
    EnforcementPolicy. The orchestrator calls `compare` first; if drifts
    are returned and the policy mode is APPLY, it then calls `apply`.

    Implementations are free to do their own internal snapshotting — the
    framework doesn't prescribe a separate "introspect" phase. Engine-
    specific state caching belongs inside the enforcer.
    """

    def compare(self, expected: BaselineSpec) -> list[Diff]: ...

    def apply(self, drifts: list[Diff]) -> None: ...
