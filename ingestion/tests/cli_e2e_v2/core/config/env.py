#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Fail-fast environment variable loader.

Replaces v1's `$E2E_*` shell expansion in YAML with Python-level reads that
raise EnvLoadError at fixture time when a required variable is missing,
instead of producing opaque Pydantic errors deep inside the `metadata` CLI.
"""

from __future__ import annotations

import os


class EnvLoadError(RuntimeError):
    """Raised when a required environment variable is missing or empty."""


class Env:
    """Reads env vars explicitly, raising EnvLoadError for required keys.

    Usage:
        password = Env.required("E2E_MYSQL_PASSWORD")
        db = Env.optional("E2E_MYSQL_DATABASE", default="openmetadata_db")
    """

    @staticmethod
    def required(key: str) -> str:
        value = os.environ.get(key)
        if value is None or value == "":
            raise EnvLoadError(
                f"required env var {key} not set. "
                f"Set it in your shell or GitHub Actions secrets."
            )
        return value

    @staticmethod
    def optional(key: str, default: str | None = None) -> str | None:
        return os.environ.get(key, default)
