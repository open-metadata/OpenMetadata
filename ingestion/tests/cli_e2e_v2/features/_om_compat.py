#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Feature-local shims for OM-version differences in generated schema shapes.

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
