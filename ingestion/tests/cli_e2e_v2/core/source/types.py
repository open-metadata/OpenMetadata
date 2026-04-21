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
from typing import Any, Protocol


class BaselineSpec:
    """Marker base for family-specific baseline specs (SqlSourceBaseline, etc.).

    Deliberately minimal — subclasses carry the real declarative shape. This
    class exists so the orchestrator can type `expected: BaselineSpec` without
    depending on any specific family module.
    """


@dataclass(frozen=True)
class Drift:
    """One discrepancy between declared baseline and observed source state.

    Path uses bracket notation mirroring the structural-diff Diff class:
    `schema[e2e].table[users].column[email].type` etc.
    """

    path: str
    expected: Any
    actual: Any


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

    def compare(self, expected: BaselineSpec) -> list[Drift]: ...

    def apply(self, drifts: list[Drift]) -> None: ...
