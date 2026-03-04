#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Base Models to be used when useful.
"""
from typing import Dict, Generic, Optional, TypeVar

from pydantic import RootModel

K = TypeVar("K")
V = TypeVar("V")


class DictModel(RootModel[Dict[K, V]], Generic[K, V]):
    """Base DictModel to be used when a Dict RootModel is needed.
    It implements proxies for useful Dict API methods."""

    # We are not proxying __iter__ as pydantic uses it for internal purposes

    def __getitem__(self, key: K) -> V:
        return self.root[key]

    def get(self, key: K, default: Optional[V] = None) -> Optional[V]:
        return self.root.get(key, default)

    def keys(self):
        return self.root.keys()

    def values(self):
        return self.root.values()

    def items(self):
        return self.root.items()

    def __len__(self):
        return len(self.root)

    def __contains__(self, key: K) -> bool:
        return key in self.root

    def __repr__(self):
        return f"{self.__class__.__name__}({self.root!r})"

    def __str__(self):
        return str(self.root)
