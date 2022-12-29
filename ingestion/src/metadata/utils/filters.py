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
Helper that implements table and filter pattern logic.
Most of these methods are applying the same logic,
but assigning specific names helps better follow the
code.
"""
from functools import singledispatch
import re
from typing import List, Optional

from metadata.generated.schema.type.filterPattern import FilterPattern


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
        except re.error as err:
            msg = f"Invalid regex [{regex}]: {err}"
            raise InvalidPatternException(msg) from err


def filter_func(filter_pattern: Optional[FilterPattern], name: str) -> bool:
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
        return not any(  # pylint: disable=use-a-generator
            [
                name
                for regex in filter_pattern.includes
                if (re.match(regex, name, re.IGNORECASE))
            ]
        )

    if filter_pattern.excludes:
        validate_regex(filter_pattern.excludes)
        return any(  # pylint: disable=use-a-generator
            [
                name
                for regex in filter_pattern.excludes
                if (re.match(regex, name, re.IGNORECASE))
            ]
        )

    return False

