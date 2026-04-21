#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Helpers for building MySQL WorkflowConfigs and deriving service names.

Split out from conftest.py because pytest discourages importing from
conftest modules; filter tests need build_mysql_config to construct
variant-named services for isolation.

Secrets handling: every env-backed field in the rendered YAML is a
${E2E_MYSQL_*} reference built via Env.ref(), which validates presence
and emits the shell-style reference string in one step. The metadata
CLI's load_config_file expands references at subprocess invocation.
Rendered cfg_*.yaml artifacts never embed raw credentials.
"""

from __future__ import annotations

from ..core.config.builder import WorkflowConfig
from ..core.config.env import Env
from ..core.config.server import ServerConfig


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

    Each env-backed field emits a ${E2E_MYSQL_*} reference via Env.ref().
    Presence validation happens inside ref() — missing vars raise EnvLoadError
    with a clear message at build time. The real values never enter the dict.

    E2E_MYSQL_DATABASE is optional: included only when set.
    """
    service_connection: dict = {
        "type": "Mysql",
        "username": Env.ref("E2E_MYSQL_USER"),
        "authType": {"password": Env.ref("E2E_MYSQL_PASSWORD")},
        "hostPort": Env.ref("E2E_MYSQL_HOST_PORT"),
    }
    if Env.optional("E2E_MYSQL_DATABASE"):
        service_connection["databaseSchema"] = Env.ref("E2E_MYSQL_DATABASE")

    return WorkflowConfig.build(
        source_type="mysql",
        service_name=service_name,
        service_connection=service_connection,
        server=server,
    )
