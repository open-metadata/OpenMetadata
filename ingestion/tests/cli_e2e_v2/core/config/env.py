#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Env var accessor with a class-based API for YAML refs and raw values.

Single abstraction for every env-var read in the v2 framework. Construction
captures (key, default, required); terminal methods extract either the
YAML-embeddable reference or the raw value. Validation happens at construction
so callers never see an "unexpectedly missing" error deep in downstream code.

Usage:

    # Required, YAML reference (most common — connector config building)
    Env("E2E_MYSQL_USER").ref()                         # -> "${E2E_MYSQL_USER}"

    # Required, raw value (with default backfill)
    Env("OM_SERVER_URL", default=DEFAULT_URL).get()     # -> "http://..."

    # Optional — no raise when unset; caller checks via .get()
    env = Env("E2E_MYSQL_DATABASE", required=False)
    if env.get():
        cfg["databaseSchema"] = env.ref()

Why a class, not free functions:
  - Per-connector code stays flat (one API for both ref and raw value).
  - Construction is the natural place to fail-fast on a required-but-unset var.
  - Default backfill via os.environ.setdefault is a side effect at construction,
    not scattered across a required()/optional() pair.
"""

from __future__ import annotations

import os


class EnvLoadError(RuntimeError):
    """Raised when a required env var is unset (or empty)."""


class Env:
    """Capture an env var access pattern; extract ref or raw value on demand."""

    def __init__(
        self,
        key: str,
        default: str | None = None,
        required: bool = True,
    ) -> None:
        self.key = key
        if default is not None:
            os.environ.setdefault(key, default)
        if required and not os.environ.get(key):
            raise EnvLoadError(
                f"required env var {key} not set. "
                f"Set it in your shell or GitHub Actions secrets."
            )

    def ref(self) -> str:
        """Return '${KEY}' for embedding in YAML.

        The metadata CLI's load_config_file applies os.path.expandvars to
        the raw YAML before parsing, so the subprocess resolves the reference
        to the real value at load time — but the rendered YAML on disk only
        ever contains the literal reference. Secrets stay out of tmp_path
        artifacts.
        """
        return f"${{{self.key}}}"

    def get(self) -> str | None:
        """Return raw env var value, or None if unset.

        Use for non-YAML contexts (SQLAlchemy URL, HTTP client auth) where
        a '${KEY}' reference wouldn't resolve. For required Env instances,
        construction already validated the var is set, so .get() is guaranteed
        non-None at runtime — the type annotation keeps `None` for
        `required=False` callers.
        """
        return os.environ.get(self.key)
