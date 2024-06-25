#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Simple dictionary implementation for keys with TTL
"""
from datetime import datetime
from typing import Dict


class TTLCache:
    """
    class to handle ttl cache
    """

    def __init__(self, ttl: int):
        self._ttl = ttl
        # The key will be the object, and the value the created time to check the TTL
        self._cache: Dict[str, int] = {}

    @staticmethod
    def _now() -> int:
        return int(datetime.now().timestamp())

    def __contains__(self, item) -> bool:
        if item in self._cache:
            created_at = self._cache[item]
            if self._now() - created_at > self._ttl:
                self.delete(item)
                return False
            return True
        return False

    def add(self, value: str):
        if value not in self._cache:
            self._cache[value] = self._now()

    def delete(self, key):
        self._cache.pop(key, None)
