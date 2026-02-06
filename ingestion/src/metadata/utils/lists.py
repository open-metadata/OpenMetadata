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
"""Util functions on lists"""

from typing import Any, List, Sequence


def intersperse(sequence: Sequence[Any], item: Any) -> List[Any]:
    """Function that intersperses a sequence with a specific item.

    Usage:
    >>> intersperse([1, 2, 3], 4) == [1, 4, 2, 4, 3]
    >>> intersperse("abcde", "-") == ["a", "-", "b", "-", "c", "-", "d", "-", "e"]

    Reference: https://stackoverflow.com/a/5921708/8868327 (long time no see, huh?)

    Arguments:
        sequence (list): A sequence of T that will be interspersed.
        item (T): The item that will be interspersed.

    Returns:
        list: A sequence of T that will be interspersed.
    """
    if len(sequence) < 2:
        return list(sequence)

    # Create a list with the expected length after inserting `item` between each of `sequence`'s items
    final_list = [item] * (len(sequence) * 2 - 1)

    # Use extended slicing to insert the initial sequence in positions 0, 2, ... len(final_lists)-1
    final_list[::2] = list(sequence)

    return final_list
