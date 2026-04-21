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

    @staticmethod
    def set_default(key: str, default: str) -> None:
        """Set os.environ[key] to `default` only if it's currently unset.

        Used to backfill dev-stack defaults (e.g. OM_SERVER_URL, OM_JWT_TOKEN)
        so `${OM_*}` references in rendered YAML always expand cleanly in
        subprocesses, even when the developer hasn't exported the env vars.
        """
        os.environ.setdefault(key, default)

    @staticmethod
    def ref(key: str) -> str:
        """Return `"${KEY}"` as a YAML-embeddable env-var reference.

        Validates the env var is currently set (non-empty). Raises EnvLoadError
        otherwise with a clear message — same fail-fast semantic as required(),
        but the returned string is the shell-style reference, not the real value.

        The metadata CLI's load_config_file applies os.path.expandvars to the
        raw YAML before parsing, so the subprocess sees the real value at load
        time — but the rendered YAML file on disk only ever contains the
        reference. Credentials never leak into tmp_path artifacts.

        Pair with set_default() for values that should fall back to a dev
        default when unset:
            Env.set_default("OM_JWT_TOKEN", _DEFAULT_DEV_JWT)
            ref = Env.ref("OM_JWT_TOKEN")  # always succeeds after set_default
        """
        value = os.environ.get(key)
        if value is None or value == "":
            raise EnvLoadError(
                f"required env var {key} not set. "
                f"Set it in your shell or GitHub Actions secrets."
            )
        return f"${{{key}}}"
