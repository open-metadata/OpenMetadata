#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""OM Pydantic compatibility shims for the v2 framework.

OM's generated schema sometimes wraps list-typed fields in `RootModel[list[X]]`
(notably `owners`) and sometimes uses plain `list[X] | None` (today: `tags`,
`columns`). The shape can flip between OM minor versions without warning,
which historically forced sweeping changes through every test that walked
the field.

`unwrap_root_list` centralizes the read so a future RootModel promotion
(or demotion) of any list field touches one helper rather than ~12
callsites scattered across the differ and the fluent layer. It mirrors
the role `model_str` plays for scalar RootModel fields (tagFQN, name,
description) — the asymmetry of having a scalar shim but no list shim
was the smell that motivated this helper.
"""

from __future__ import annotations

from typing import Any


def unwrap_root_list(field: Any) -> list:
    """Return a plain list whether `field` is None, a list, or a RootModel[list].

    The defensive branches make the helper safe to drop in at any list
    access site without checking the field's current Pydantic shape.
    """
    if field is None:
        return []
    if hasattr(field, "root"):
        return field.root
    return field
