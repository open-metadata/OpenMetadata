#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Helpers for building MySQL WorkflowConfigs and deriving service names.

Split out from conftest.py because pytest discourages importing from
conftest modules; filter tests need build_mysql_config to construct
variant-named services for isolation.

Secrets handling: every env-backed YAML field uses Env(key).ref() — the
rendered cfg_*.yaml carries ${E2E_MYSQL_*} literal references, not real
credentials. Env's construction validates presence (raises EnvLoadError
at build time if a required var is unset). The metadata CLI expands the
references at subprocess load time via os.path.expandvars.
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

    All env-backed fields emit ${E2E_MYSQL_*} references. Presence validation
    happens in Env's constructor; missing required vars raise EnvLoadError at
    build time with a clear message. Real values never enter the dict.

    E2E_MYSQL_DATABASE is optional — instance constructs without raising;
    the field is added to the config only when the env var is actually set.
    """
    service_connection: dict = {
        "type": "Mysql",
        "username": Env("E2E_MYSQL_USER").ref(),
        "authType": {"password": Env("E2E_MYSQL_PASSWORD").ref()},
        "hostPort": Env("E2E_MYSQL_HOST_PORT").ref(),
    }
    db = Env("E2E_MYSQL_DATABASE", required=False)
    if db.get():
        service_connection["databaseSchema"] = db.ref()

    return WorkflowConfig.build(
        source_type="mysql",
        service_name=service_name,
        service_connection=service_connection,
        server=server,
    )
