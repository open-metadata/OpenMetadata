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
Test list utility functions
"""

from metadata.utils.lists import intersperse


def test_intersperse_with_integers():
    """Test intersperse with integer list"""
    result = intersperse([1, 2, 3], 4)
    assert result == [1, 4, 2, 4, 3]


def test_intersperse_with_strings():
    """Test intersperse with string list"""
    result = intersperse(["a", "b", "c"], "-")
    assert result == ["a", "-", "b", "-", "c"]


def test_intersperse_with_string_sequence():
    """Test intersperse with string as sequence"""
    result = intersperse("abcde", "-")
    assert result == ["a", "-", "b", "-", "c", "-", "d", "-", "e"]


def test_intersperse_single_element():
    """Test intersperse with single element"""
    result = intersperse([1], 0)
    assert result == [1]


def test_intersperse_two_elements():
    """Test intersperse with two elements"""
    result = intersperse([1, 2], 0)
    assert result == [1, 0, 2]


def test_intersperse_empty_list():
    """Test intersperse with empty list returns empty list"""
    result = intersperse([], 0)
    assert result == []


def test_intersperse_preserves_types():
    """Test that intersperse preserves element types"""
    result = intersperse([1.5, 2.5, 3.5], 0.0)
    assert result == [1.5, 0.0, 2.5, 0.0, 3.5]
    assert all(isinstance(x, float) for x in result)


def test_intersperse_with_none():
    """Test intersperse with None as separator"""
    result = intersperse([1, 2, 3], None)
    assert result == [1, None, 2, None, 3]


def test_intersperse_with_mixed_types():
    """Test intersperse with mixed type list"""
    result = intersperse([1, "a", 2.5], "|")
    assert result == [1, "|", "a", "|", 2.5]


def test_intersperse_with_objects():
    """Test intersperse with object instances"""
    obj1, obj2, obj3 = object(), object(), object()
    separator = object()
    result = intersperse([obj1, obj2, obj3], separator)
    assert result[0] is obj1
    assert result[1] is separator
    assert result[2] is obj2
    assert result[3] is separator
    assert result[4] is obj3


def test_intersperse_large_list():
    """Test intersperse with large list"""
    large_list = list(range(100))
    result = intersperse(large_list, -1)
    assert len(result) == 199
    assert result[0] == 0
    assert result[1] == -1
    assert result[2] == 1
    assert result[-1] == 99
