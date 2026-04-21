#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Helpers for building MySQL WorkflowConfigs and deriving service names.

Split out from conftest.py because pytest discourages importing from
conftest modules; filter tests need build_mysql_config to construct
variant-named services for isolation.
"""

from __future__ import annotations

from tests.cli_e2e_v2.core.config.builder import WorkflowConfig
from tests.cli_e2e_v2.core.config.env import Env
from tests.cli_e2e_v2.core.config.server import ServerConfig


def mysql_service_name(session_uuid: str, variant: str = "") -> str:
    """Build the MySQL service name for a given pytest session and optional variant.

    Default variant "" returns the session-shared service (used by tests that
    accept shared state across the test module, e.g. vanilla ingest + profiler).

    A non-empty variant (e.g., "filter_inc") produces a sibling service
    (e.g., e2e_mysql_abc123_filter_inc) — filter tests use this for isolation
    so prior-test residue doesn't pollute "extras" assertions.
    """
    base = f"e2e_mysql_{session_uuid}"
    return f"{base}_{variant}" if variant else base


def build_mysql_config(service_name: str, server: ServerConfig) -> WorkflowConfig:
    """Build a base MySQL WorkflowConfig with the given service name.

    Reads E2E_MYSQL_USER / E2E_MYSQL_PASSWORD / E2E_MYSQL_HOST_PORT at call
    time via Env.required — EnvLoadError surfaces with a clear message if
    any is missing. Tests call this once per test-scope service they need
    (e.g., filter tests build a variant-named config per test).

    The returned config is in the "metadata" pipeline mode by default; tests
    chain .as_*() / .with_filter() overlays as needed.
    """
    return WorkflowConfig.build(
        source_type="mysql",
        service_name=service_name,
        service_connection={
            "type": "Mysql",
            "username": Env.required("E2E_MYSQL_USER"),
            "authType": {"password": Env.required("E2E_MYSQL_PASSWORD")},
            "hostPort": Env.required("E2E_MYSQL_HOST_PORT"),
            "databaseSchema": Env.optional("E2E_MYSQL_DATABASE", default=None),
        },
        server=server,
    )
