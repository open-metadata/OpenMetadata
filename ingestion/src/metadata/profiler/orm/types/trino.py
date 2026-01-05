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
Type adapter for Trino to handle NamedRowTuple serialization
"""
from typing import Any

from sqlalchemy import ARRAY
from sqlalchemy.engine import Dialect
from sqlalchemy.sql.sqltypes import String, TypeDecorator

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TrinoTypesMixin:
    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        # pylint: disable=import-outside-toplevel
        from trino.types import NamedRowTuple

        def _convert_value(obj: Any) -> Any:
            if isinstance(obj, NamedRowTuple):
                return {
                    k: _convert_value(getattr(obj, k))
                    for k in obj.__annotations__["names"]
                }
            elif isinstance(obj, (list, tuple)):
                return type(obj)(_convert_value(v) for v in obj)
            elif isinstance(obj, dict):
                return {k: _convert_value(v) for k, v in obj.items()}
            return obj

        return _convert_value(value)


class TrinoArray(TrinoTypesMixin, TypeDecorator):
    impl = ARRAY
    cache_ok = True

    @property
    def python_type(self):
        return list


class TrinoMap(TrinoTypesMixin, TypeDecorator):
    impl = String
    cache_ok = True

    @property
    def python_type(self):
        return dict


class TrinoStruct(TrinoTypesMixin, TypeDecorator):
    impl = String
    cache_ok = True

    @property
    def python_type(self):
        return dict
