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
"""Custom Pinot SQLAlchemy types."""
import json
from typing import Any

from sqlalchemy import types

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PinotJSONType(types.JSON):
    """
    Replace SQLAlchemy's default JSON result processor to normalize Pinot's
    engine-dependent payloads.

    The single-stage engine can return already-deserialized Python containers,
    while the multistage engine returns raw JSON strings. This custom type
    accepts both shapes while preserving JSON semantics for OpenMetadata.
    """

    def result_processor(self, dialect, coltype):
        def process(value: Any) -> Any:
            if value is None or isinstance(value, (dict, list)):
                return value

            if isinstance(value, (str, bytes, bytearray)):
                try:
                    return json.loads(value)
                except (TypeError, ValueError) as exc:
                    logger.warning(
                        "Failed to deserialize Pinot JSON value. Returning raw value instead: %s",
                        exc,
                    )
                    return value

            return value

        return process
