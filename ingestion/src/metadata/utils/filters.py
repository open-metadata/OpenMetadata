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
Helper that implements table and filter pattern logic
"""
import re
from typing import List, Optional

from metadata.generated.schema.type.filterPattern import FilterPatternModel


class InvalidPatternException(Exception):
    """
    Raised when an invalid pattern is configured in the workflow
    """


def validate_regex(regex_list: List[str]) -> None:
    """
    Check that the given include/exclude regexes
    are well formatted
    """
    for regex in regex_list:
        try:
            re.compile(regex)
        except re.error:
            raise InvalidPatternException(f"Invalid regex {regex}.")


def _filter(filter_pattern: Optional[FilterPatternModel], name: str) -> bool:
    """
    Return True if the name needs to be filtered, False otherwise

    Include takes precedence over exclude

    :param filter_pattern: Model defining filtering logic
    :param name: table or schema name
    :return: True for filtering, False otherwise
    """
    if not filter_pattern:
        # No filter pattern, nothing to filter
        return False

    if filter_pattern.includes:
        validate_regex(filter_pattern.includes)
        return not any(
            [
                matched
                for regex in filter_pattern.includes
                if (matched := re.match(regex, name))
            ]
        )

    if filter_pattern.excludes:
        validate_regex(filter_pattern.excludes)
        return any(
            [
                matched
                for regex in filter_pattern.excludes
                if (matched := re.match(regex, name))
            ]
        )

    return False


def filter_by_schema(
    schema_filter_pattern: Optional[FilterPatternModel], schema_name: str
) -> bool:
    """
    Return True if the schema needs to be filtered, False otherwise

    Include takes precedence over exclude

    :param schema_filter_pattern: Model defining schema filtering logic
    :param schema_name: table schema name
    :return: True for filtering, False otherwise
    """
    return _filter(schema_filter_pattern, schema_name)


def filter_by_table(
    table_filter_pattern: Optional[FilterPatternModel], table_name: str
) -> bool:
    """
    Return True if the table needs to be filtered, False otherwise

    Include takes precedence over exclude

    :param table_filter_pattern: Model defining schema filtering logic
    :param table_name: table name
    :return: True for filtering, False otherwise
    """
    return _filter(table_filter_pattern, table_name)
