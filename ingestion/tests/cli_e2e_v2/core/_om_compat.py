#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Shims for OM-version differences in generated Pydantic schema shapes.

Bridges list fields that may be `list[X] | None` or `RootModel[list[X]]`
depending on the OM minor version (e.g. `owners` vs `tags`/`columns`).
"""

from __future__ import annotations

from typing import Any


def unwrap_root_list(field: Any) -> list:
    """Return a plain list from `field` regardless of whether it is `None`, `list`, or `RootModel[list]`."""
    if field is None:
        return []
    if hasattr(field, "root"):
        return field.root
    return field
