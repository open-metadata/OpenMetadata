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
import pytest

from metadata.pii.algorithms.preprocessing import convert_to_str, preprocess_values


@pytest.mark.parametrize(
    "input_value,expected",
    [
        ("hello", "hello"),
        (123, "123"),
        (123.45, "123.45"),
        (b"hello", "hello"),
        (None, None),
        ({"key": "value"}, '{"key": "value"}'),
        ({1, 2, 3}, None),  # Sets cannot be converted to JSON
    ],
)
def test_converts_various_types_to_string(input_value, expected):
    assert convert_to_str(input_value) == expected


@pytest.mark.parametrize(
    "input_values,expected",
    [
        (["hello", 123, None, b"world", "", "   "], ["hello", "123", "world"]),
        ([], []),
        ([None, "", "   "], []),
        ([{"key": "value"}, [1, 2, 3]], ['{"key": "value"}', "[1, 2, 3]"]),
    ],
)
def test_preprocesses_sequences_correctly(input_values, expected):
    assert preprocess_values(input_values) == expected
