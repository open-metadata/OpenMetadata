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
"""Custom SQLAlchemy types for the Pinot connector."""
# pylint: disable=abstract-method
import json
from typing import Any, Optional

from sqlalchemy.sql.sqltypes import String, TypeDecorator

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PinotJSONType(TypeDecorator):
    """
    Custom type for Pinot JSON columns.

    Uses String as the implementation type so that SQLAlchemy's JSON
    bytes-processor is never invoked. The pinotdb driver always delivers
    JSON values as Python str (multistage engine) or already-deserialized
    containers (single-stage engine). We normalize both shapes here.
    """

    impl = String
    cache_ok = True

    @property
    def python_type(self):
        return Any

    def process_result_value(self, value: Optional[Any], dialect) -> Optional[Any]:
        if value is None or value is False or value == "":
            return None

        if isinstance(value, (dict, list)):
            return value

        if isinstance(value, (bytes, bytearray)):
            value = value.decode("utf-8")

        if isinstance(value, str):
            try:
                return json.loads(value)
            except (TypeError, ValueError) as exc:
                logger.warning(
                    "Failed to deserialize Pinot JSON value. "
                    "Returning raw value instead: %s",
                    exc,
                )
                return value

        return value
