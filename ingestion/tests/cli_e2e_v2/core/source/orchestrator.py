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
from typing import Literal

from tests.cli_e2e_v2.core.runner.errors import SourceBaselineDrift
from tests.cli_e2e_v2.core.source.types import BaselineSpec, SourceBaselineEnforcer

logger = logging.getLogger(__name__)


@dataclass
class EnforcementPolicy:
    """Binds an enforcer to a mode.

    mode="apply":      drifts trigger enforcer.apply (mutates the source).
                       Default for local Docker-backed connectors.
    mode="check_only": drifts raise SourceBaselineDrift.
                       Default for shared cloud sources — never mutate.
    """

    enforcer: SourceBaselineEnforcer
    mode: Literal["apply", "check_only"] = "apply"


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
      - drifts + mode="check_only" → raise SourceBaselineDrift with drift list
        and operator instructions (run `python -m ...source.apply --connector X`)
      - drifts + mode="apply" → call enforcer.apply(drifts)
    """
    if policy is None or expected is None:
        logger.warning(
            "[%s] running in TRUST MODE — no source baseline enforced. "
            "Source state is assumed correct.",
            connector_name,
        )
        return

    # introspect is called for side effects (e.g., warming a connection cache)
    # and structure — compare() uses introspect() internally.
    policy.enforcer.introspect()
    drifts = policy.enforcer.compare(expected)

    if not drifts:
        logger.info("[%s] source baseline in sync", connector_name)
        return

    if policy.mode == "check_only":
        lines = "\n".join(
            f"  {d.path}: expected={d.expected!r}, actual={d.actual!r}" for d in drifts
        )
        raise SourceBaselineDrift(
            f"[{connector_name}] baseline drift detected ({len(drifts)} items):\n"
            f"{lines}\n\n"
            f"Run to restore (LOCAL ONLY): "
            f"python -m tests.cli_e2e_v2.core.source.apply --connector {connector_name}"
        )

    logger.info(
        "[%s] applying %d baseline drift fixes", connector_name, len(drifts)
    )
    policy.enforcer.apply(drifts)
