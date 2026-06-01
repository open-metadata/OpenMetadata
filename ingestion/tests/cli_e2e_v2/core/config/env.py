#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Env var accessor with overload-narrowed `.get()` and `.ref()` for YAML embedding.

- `.ref()` returns `${KEY}` for embedding in YAML (never exposes the value).
- `.get()` returns `str` when `required=True`, `str | None` when `required=False`.
- Raises `EnvLoadError` at construction if a required var is unset.
"""

from __future__ import annotations

import os
from typing import Generic, Literal, TypeVar, overload


class EnvLoadError(RuntimeError):
    """Raised when a required env var is unset (or empty)."""


_Req = TypeVar("_Req", Literal[True], Literal[False])


class Env(Generic[_Req]):
    """Capture an env-var key; `.ref()` and `.get()` are the terminals."""

    key: str

    @overload
    def __new__(
        cls,
        key: str,
        default: str | None = None,
        *,
        required: Literal[True] = True,
    ) -> Env[Literal[True]]: ...

    @overload
    def __new__(
        cls,
        key: str,
        default: str | None = None,
        *,
        required: Literal[False],
    ) -> Env[Literal[False]]: ...

    def __new__(
        cls,
        key: str,
        default: str | None = None,
        *,
        required: bool = True,
    ) -> Env:
        return object.__new__(cls)

    def __init__(
        self,
        key: str,
        default: str | None = None,
        *,
        required: bool = True,
    ) -> None:
        self.key = key
        if default is not None:
            os.environ.setdefault(key, default)
        if required and not os.environ.get(key):
            raise EnvLoadError(f"required env var {key} not set. Set it in your shell or GitHub Actions secrets.")

    def ref(self) -> str:
        """Return `${KEY}` for embedding in YAML; the CLI subprocess expands it at load time, keeping secrets out of tmp_path artifacts."""
        return f"${{{self.key}}}"

    @overload
    def get(self: Env[Literal[True]]) -> str: ...

    @overload
    def get(self: Env[Literal[False]]) -> str | None: ...

    def get(self) -> str | None:
        return os.environ.get(self.key)
