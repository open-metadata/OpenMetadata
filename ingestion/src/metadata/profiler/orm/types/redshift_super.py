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
"""
Redshift SUPER column type for profiler and sampler queries
"""

import json
from typing import Any

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator


class RedshiftSuper(TypeDecorator):
    """psycopg2 has no adapter for Redshift's SUPER, so its values arrive as the JSON text
    Redshift serializes them to. They are parsed back into the documents they hold.

    A decorator rather than a JSON subclass: the Redshift dialect adapts every JSON type
    to its own, which would drop a subclass's result processing."""

    impl = Text
    cache_ok = True

    @property
    def python_type(self):
        return dict

    def process_result_value(self, value: Any, dialect) -> Any:
        if not isinstance(value, str):
            return value
        try:
            return json.loads(value)
        except ValueError:
            return value
