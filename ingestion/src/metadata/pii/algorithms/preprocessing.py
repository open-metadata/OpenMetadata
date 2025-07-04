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
Preprocessing functions for the classification tasks.
"""
import datetime
import json
from typing import Any, List, Mapping, Optional, Sequence

from metadata.utils.logger import pii_logger

logger = pii_logger()


# pylint: disable=too-many-return-statements
def convert_to_str(value: Any) -> Optional[str]:
    """
    Convert the given value to a string. This is a conversion
    tailored to our use case, not a generic one.
    """
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, datetime.datetime, datetime.date)):
        # Values we want to convert to string out of the box
        return str(value)
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    if isinstance(value, (Sequence, Mapping)):
        try:
            return json.dumps(value, default=str)
        except (TypeError, ValueError, OverflowError) as e:
            # If the value cannot be serialized to JSON, return None
            logger.warning(f"Failed to convert value to JSON: {e}")
            return None
    if value is None:
        # We want to skip None values, not convert them to "None"
        return None
    return None


def preprocess_values(values: Sequence[Any]) -> List[str]:
    result: List[str] = []
    for value in values:
        converted_value = convert_to_str(value)
        if converted_value is None:
            # Skip None values
            continue
        # skip empty strings
        if not converted_value.strip():
            continue
        # Add the converted value as is, without any further processing
        result.append(converted_value)

    return result
