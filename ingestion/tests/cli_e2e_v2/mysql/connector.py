#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Helpers for building MySQL WorkflowConfigs and deriving service names.

Env-backed fields emit ``${E2E_MYSQL_*}`` references via ``Env(key).ref()``
so credentials never enter the rendered YAML. Missing required vars raise
``EnvLoadError`` at build time.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..core.config.builder import WorkflowConfig
from ..core.config.env import Env

if TYPE_CHECKING:
    from ..core.config.server import ServerConfig


def mysql_service_name(session_uuid: str, variant: str = "") -> str:
    """Return ``e2e_mysql_<uuid>`` or ``e2e_mysql_<uuid>_<variant>`` when variant is given."""
    base = f"e2e_mysql_{session_uuid}"
    return f"{base}_{variant}" if variant else base


def build_mysql_config(service_name: str, server: ServerConfig) -> WorkflowConfig:
    """Build a MySQL WorkflowConfig with env-reference credentials.

    E2E_MYSQL_DATABASE is optional; ``databaseSchema`` is omitted when unset.
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
