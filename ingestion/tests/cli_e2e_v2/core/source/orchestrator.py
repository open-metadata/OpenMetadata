#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Source baseline orchestrator: ensure_baseline + EnforcementPolicy + trust mode.

`ensure_baseline` is the uniform orchestrator for every source family. Each
per-connector baseline fixture calls it once per session; the policy decides
whether drifts apply (local Docker) or raise (shared cloud sources).

Trust mode (policy=None and expected=None) short-circuits with a WARNING,
letting a connector migrate to v2 before its baseline is fully modeled
(Decision #18).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

from ..runner.errors import SourceBaselineDrift
from .types import BaselineSpec, Diff, SourceBaselineEnforcer

logger = logging.getLogger(__name__)


class EnforcementMode(Enum):
    """How a policy reconciles detected source-baseline drift.

    Matches the style of `MatchMode` (also an enum) so the two
    comparison-lifecycle modes in the framework share one idiom.
    """

    APPLY = "apply"            # drifts trigger enforcer.apply (mutates the source)
    CHECK_ONLY = "check_only"  # drifts raise SourceBaselineDrift


@dataclass(frozen=True)
class EnforcementPolicy:
    """Binds an enforcer to a mode.

    APPLY:      drifts trigger enforcer.apply (mutates the source).
                Default for local Docker-backed connectors.
    CHECK_ONLY: drifts raise SourceBaselineDrift.
                Default for shared cloud sources — never mutate.
    """

    enforcer: SourceBaselineEnforcer
    mode: EnforcementMode = EnforcementMode.APPLY


def ensure_baseline(
    policy: EnforcementPolicy | None,
    expected: BaselineSpec | None,
    *,
    connector_name: str,
) -> None:
    """Three-phase lifecycle with trust-mode short-circuit.

    Trust mode: policy or expected is None → log a warning, do nothing.
    Lets a connector migrate to v2 before its baseline is declared.

    Otherwise: introspect → compare → apply or raise:
      - no drifts → log and return
      - drifts + CHECK_ONLY → raise SourceBaselineDrift listing each drift.
        The exception message tells the operator to re-run locally with
        APPLY against a dedicated database — the standalone apply CLI
        considered in the v2 design was deferred to the first cloud
        connector (see `project-cloud-baseline-recovery-deferred.md`).
      - drifts + APPLY → call enforcer.apply(drifts)
    """
    if policy is None or expected is None:
        logger.warning(
            "[%s] running in TRUST MODE — no source baseline enforced. "
            "Source state is assumed correct.",
            connector_name,
        )
        return

    drifts = policy.enforcer.compare(expected)

    if not drifts:
        logger.info("[%s] source baseline in sync", connector_name)
        return

    if policy.mode is EnforcementMode.CHECK_ONLY:
        raise SourceBaselineDrift(
            f"[{connector_name}] baseline drift detected ({len(drifts)} items):\n"
            f"{_render_drift_list(drifts)}\n\n"
            f"This connector runs in check_only mode — baselines must be applied "
            f"out-of-band (e.g., re-run the test suite locally against this source "
            f"with EnforcementMode.APPLY on a dedicated DB). Contact the connector owner if unsure."
        )

    logger.info(
        "[%s] applying %d baseline drift fixes", connector_name, len(drifts)
    )
    policy.enforcer.apply(drifts)


def _render_drift_list(drifts: list[Diff]) -> str:
    """Inline renderer for a drift list inside the check-only error message.

    Uses Diff's own `__str__` so source-side and OM-side error output share
    the same `  path:\\n    expected: X\\n    actual: Y` shape — consistent
    reading across both failure surfaces.
    """
    return "\n".join(str(d) for d in drifts)
