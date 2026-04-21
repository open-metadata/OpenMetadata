#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Env var accessor — class-based, with typing that narrows by `required`.

Single abstraction for every env-var read in the v2 framework. Construction
captures (key, default, required); terminals are `.ref()` for YAML
embedding and `.get()` for the raw value. Construction validates once —
fail-fast at the nearest call site when a required var is unset.

The class is Generic over the `required` flag:

    Env("X").get()                      -> str           (required=True default)
    Env("X", required=False).get()      -> str | None

`typing.overload` on both `__new__` and `.get()` makes the type narrow
automatically — call sites see the right return type without casts,
and mypy / basedpyright enforces the distinction statically.

Runtime is identical to a plain class; the Generic machinery is type-only.

Usage:

    Env("E2E_MYSQL_USER").ref()                             # "${E2E_MYSQL_USER}"
    Env("OM_SERVER_URL", default=DEFAULT).get()             # str

    db = Env("E2E_MYSQL_DATABASE", required=False)
    if db.get() is not None:
        cfg["databaseSchema"] = db.ref()
"""

from __future__ import annotations

import os
from typing import Generic, Literal, TypeVar, overload


class EnvLoadError(RuntimeError):
    """Raised when a required env var is unset (or empty)."""


# Constrained — callers can only parameterize Env with True or False, matching
# the two concrete `required` states. Anything else is a type error.
_Req = TypeVar("_Req", Literal[True], Literal[False])


class Env(Generic[_Req]):
    """Capture an env-var access pattern; ref() and get() are the terminals.

    Generic over the `required` flag so `.get()` returns `str` when
    required=True and `str | None` when required=False. The required value
    is kwarg-only to keep the `__new__` overloads unambiguous.
    """

    key: str

    # Two __new__ overloads — one per Literal[required] value — let the type
    # checker pick the right `Env[Literal[...]]` specialization at the call
    # site. The runtime __new__ is just object.__new__; Generic is erased.
    @overload
    def __new__(
        cls,
        key: str,
        default: str | None = None,
        *,
        required: Literal[True] = True,
    ) -> "Env[Literal[True]]": ...

    @overload
    def __new__(
        cls,
        key: str,
        default: str | None = None,
        *,
        required: Literal[False],
    ) -> "Env[Literal[False]]": ...

    def __new__(
        cls,
        key: str,
        default: str | None = None,
        *,
        required: bool = True,
    ) -> "Env":
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
            raise EnvLoadError(
                f"required env var {key} not set. "
                f"Set it in your shell or GitHub Actions secrets."
            )

    def ref(self) -> str:
        """Return '${KEY}' for embedding in YAML.

        The metadata CLI's load_config_file applies os.path.expandvars to
        the raw YAML before parsing, so the subprocess resolves the reference
        at load time — the rendered YAML on disk only ever contains the
        literal reference, keeping secrets out of tmp_path artifacts.
        """
        return f"${{{self.key}}}"

    # Two .get() overloads narrow by the specialization of Env:
    #   Env[Literal[True]].get()  -> str          (construction validated)
    #   Env[Literal[False]].get() -> str | None   (caller must handle None)
    @overload
    def get(self: "Env[Literal[True]]") -> str: ...

    @overload
    def get(self: "Env[Literal[False]]") -> str | None: ...

    def get(self) -> str | None:
        return os.environ.get(self.key)
