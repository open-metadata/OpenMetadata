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
"""Reviewed connector coverage policy, independent of workflow execution."""

from __future__ import annotations

from dataclasses import dataclass, field
from runpy import run_path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Mapping
    from pathlib import Path


@dataclass(frozen=True)
class ContractInventory:
    family: str
    required: frozenset[str]
    unsupported: Mapping[str, str] = field(default_factory=dict)
    capabilities: Mapping[str, bool] = field(default_factory=dict)


def inventory_for(directory: Path) -> ContractInventory:
    """Load INVENTORY from the selected connector's inventory.py."""
    path = directory / "inventory.py"
    if not path.is_file():
        raise ValueError(f"{directory.name}: missing inventory.py; declare a connector-owned INVENTORY")
    inventory = run_path(str(path)).get("INVENTORY")
    if not isinstance(inventory, ContractInventory):
        raise TypeError(f"{directory.name}: inventory.py must export INVENTORY as a ContractInventory")
    return inventory
