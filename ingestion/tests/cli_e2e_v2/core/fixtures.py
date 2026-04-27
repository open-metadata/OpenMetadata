#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shared helpers for per-connector pytest fixtures.

Per-connector conftests (`<connector>/conftest.py`) wire their own
`<connector>_source_ready` and `<connector>_metadata_ingested` fixtures on
top of these helpers instead of copy-pasting the body.

Design:
  - These are PLAIN FUNCTIONS (not pytest fixtures). The per-connector
    conftest is still where pytest scoping (`scope="session"` /
    `scope="module"`) lives — otherwise pytest couldn't build the
    dependency graph. The helpers carry just the body.
  - `run_source_baseline` takes a zero-arg policy factory so each
    connector's `get_policy` stays lazy (its engine shouldn't be
    constructed at module import time).
  - `metadata_ingest_once` applies an optional filter overlay so the
    vast majority of connectors can pass `schemas_include=[...]`
    without writing a one-off pipeline-chain-and-run code block.
"""

from __future__ import annotations

from typing import Callable

import pytest

from .config.builder import WorkflowConfig
from .config.pipelines import PipelineOptions
from .runner.cli_runner import CliRunner
from .source.orchestrator import EnforcementPolicy, ensure_baseline
from .source.types import BaselineSpec


def run_source_baseline(
    policy_factory: Callable[[], EnforcementPolicy],
    baseline: BaselineSpec,
    *,
    connector_name: str,
) -> None:
    """Thin wrapper around `ensure_baseline` for per-connector `source_ready` fixtures.

    The factory indirection keeps engine construction lazy — `get_policy`
    opens a SQLAlchemy engine, and we don't want that happening at module
    import time (pytest collects conftests eagerly).
    """
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
    """Run one metadata CLI ingest and assert success.

    Registers `service_name` for session-end cleanup so individual tests
    don't need to. `label` controls the tmp-path prefix and failure-
    message wording — pass the connector name for readable artifacts
    (e.g. `mysql_ingest0/`).
    """
    if service_name not in registered_services:
        registered_services.append(service_name)

    pipeline_cfg = cfg.pipeline(pipeline_options)
    if filter_kwargs:
        pipeline_cfg = pipeline_cfg.with_filter(**filter_kwargs)

    runner = CliRunner(tmp_path_factory.mktemp(f"{label}_ingest"))
    status = runner.run(pipeline_cfg)
    assert status.success, (
        f"module-scoped {label} metadata ingest failed: {status.all_failures}"
    )
