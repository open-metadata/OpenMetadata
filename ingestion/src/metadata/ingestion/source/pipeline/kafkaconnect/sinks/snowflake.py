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
Dataset resolution for the Snowflake Sink connector (managed and self-managed).
"""

import re

# Snowflake unquoted identifiers: letter or underscore first, then alphanumerics, _ or $.
VALID_SNOWFLAKE_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_$]*$")


def java_string_hashcode(value: str) -> int:
    """
    Reimplement Java's String.hashCode().

    The Snowflake Kafka connector appends abs(topic.hashCode()) to tables whose
    topic name is not a legal identifier, so reproducing the exact Java semantics
    -- including 32-bit signed overflow -- is what makes the target table name
    computable instead of guessable.
    """
    result = 0
    for char in value:
        result = (31 * result + ord(char)) & 0xFFFFFFFF
    if result >= 2**31:
        result -= 2**32
    return result


def snowflake_table_name(topic: str) -> str:
    """
    Derive the Snowflake table a topic lands in when no topic2table.map entry applies.
    """
    if VALID_SNOWFLAKE_IDENTIFIER.match(topic):
        return topic.upper()

    sanitized = "".join(char if (char.isascii() and char.isalnum()) or char in "_$" else "_" for char in topic)
    if not re.match(r"^[A-Za-z_]", sanitized):
        sanitized = f"_{sanitized}"
    return f"{sanitized.upper()}_{abs(java_string_hashcode(topic))}"
