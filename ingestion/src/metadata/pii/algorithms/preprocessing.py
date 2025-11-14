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
from typing import Any, List, Mapping, Optional, Sequence, Union, cast

from metadata.utils.logger import pii_logger

logger = pii_logger()


# pylint: disable=too-many-return-statements
def convert_to_str(value: Any) -> Optional[Union[List[str], str]]:
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
        # Don't classify binary columns, which might contain misleading or outright invalid strings
        return None
    if isinstance(value, (Sequence, Mapping)):
        if isinstance(value, Mapping):
            value = list(value.values())
        converted = [convert_to_str(el) for el in cast(List[Any], value)]
        return [
            item
            for sublist in converted
            for item in (sublist if isinstance(sublist, list) else [sublist])
            if item is not None
        ]
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

        if not isinstance(converted_value, list):
            converted_value = [converted_value]

        # skip empty strings
        converted_value = [el.strip() for el in converted_value if el.strip()]
        # Add the converted value as is, without any further processing
        result.extend(converted_value)

    return result
