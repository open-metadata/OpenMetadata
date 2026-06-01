#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Plain-function bodies for per-connector pytest fixtures.

Per-connector conftests call these instead of copy-pasting the body.
Scoping (`scope="session"` / `scope="module"`) stays in the conftest so
pytest can build the dependency graph.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .runner.cli_runner import CliRunner
from .source.orchestrator import EnforcementPolicy, ensure_baseline

if TYPE_CHECKING:
    from collections.abc import Callable

    import pytest

    from .config.builder import WorkflowConfig
    from .config.pipelines import PipelineOptions
    from .source.types import BaselineSpec


def run_source_baseline(
    policy_factory: Callable[[], EnforcementPolicy],
    baseline: BaselineSpec,
    *,
    connector_name: str,
) -> None:
    """Call `ensure_baseline` via a lazy policy factory to defer engine construction past import time."""
    ensure_baseline(policy_factory(), baseline, connector_name=connector_name)


def metadata_ingest_once(
    tmp_path_factory: pytest.TempPathFactory,
    cfg: WorkflowConfig,
    registered_services: list[str],
    *,
    service_name: str,
    pipeline_options: PipelineOptions,
    filter_kwargs: dict | None = None,
    label: str = "metadata",
) -> None:
    """Run one metadata CLI ingest, assert success, and register `service_name` for cleanup."""
    if service_name not in registered_services:
        registered_services.append(service_name)

    pipeline_cfg = cfg.pipeline(pipeline_options)
    if filter_kwargs:
        pipeline_cfg = pipeline_cfg.with_filter(**filter_kwargs)

    runner = CliRunner(tmp_path_factory.mktemp(f"{label}_ingest"))
    status = runner.run(pipeline_cfg)
    assert status.success, f"module-scoped {label} metadata ingest failed: {status.all_failures}"
