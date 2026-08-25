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
from unittest.mock import patch

import pytest

from metadata.pii.algorithms.preprocessing import (
    MAX_NLP_TEXT_LENGTH,
    convert_to_str,
    preprocess_values,
)


@pytest.mark.parametrize(
    "input_value,expected",
    [
        ("hello", "hello"),
        (123, "123"),
        (123.45, "123.45"),
        (b"hello", None),
        (None, None),
        ({"key": "value"}, ["value"]),
        ({1, 2, 3}, None),
    ],
)
def test_converts_various_types_to_string(input_value, expected):
    assert convert_to_str(input_value) == expected


@pytest.mark.parametrize(
    "input_values,expected",
    [
        (["hello", 123, None, b"world", "", "   "], ["hello", "123"]),
        ([], []),
        ([None, "", "   "], []),
        ([{"key": "value"}, [1, 2, 3]], ["value", "1", "2", "3"]),
    ],
)
def test_preprocesses_sequences_correctly(input_values, expected):
    assert preprocess_values(input_values) == expected


def test_normal_length_string_processed_correctly():
    normal_string = "a" * 1000
    result = convert_to_str(normal_string)
    assert result == normal_string


def test_max_length_string_processed_correctly():
    max_length_string = "a" * MAX_NLP_TEXT_LENGTH
    result = convert_to_str(max_length_string)
    assert result == max_length_string


@patch("metadata.pii.algorithms.preprocessing.logger")
def test_oversized_string_is_truncated_and_logs_warning(mock_logger):
    oversized_string = "a" * (MAX_NLP_TEXT_LENGTH + 1)
    result = convert_to_str(oversized_string)

    assert result == "a" * MAX_NLP_TEXT_LENGTH
    assert len(result) == MAX_NLP_TEXT_LENGTH
    mock_logger.warning.assert_called_once()


@patch("metadata.pii.algorithms.preprocessing.logger")
def test_very_large_string_is_truncated_and_logs_warning(mock_logger):
    very_large_string = "x" * 2_000_000
    result = convert_to_str(very_large_string)

    assert result == "x" * MAX_NLP_TEXT_LENGTH
    assert len(result) == MAX_NLP_TEXT_LENGTH
    mock_logger.warning.assert_called_once()


@patch("metadata.pii.algorithms.preprocessing.logger")
def test_oversized_string_preserves_content_prefix(mock_logger):
    prefix = "hello_world_"
    oversized_string = prefix + "a" * (MAX_NLP_TEXT_LENGTH + 100)
    result = convert_to_str(oversized_string)

    assert result.startswith(prefix)
    assert len(result) == MAX_NLP_TEXT_LENGTH
    mock_logger.warning.assert_called_once()


@patch("metadata.pii.algorithms.preprocessing.logger")
def test_preprocess_values_with_mixed_size_strings(mock_logger):
    normal_string = "normal"
    oversized_string = "a" * (MAX_NLP_TEXT_LENGTH + 1)
    max_length_string = "b" * MAX_NLP_TEXT_LENGTH

    input_values = [normal_string, oversized_string, max_length_string, "another"]
    result = preprocess_values(input_values)

    assert len(result) == 4
    assert result[0] == normal_string
    assert result[1] == "a" * MAX_NLP_TEXT_LENGTH
    assert result[2] == max_length_string
    assert result[3] == "another"
    mock_logger.warning.assert_called_once()


@patch("metadata.pii.algorithms.preprocessing.logger")
def test_preprocess_values_with_list_containing_oversized_string(mock_logger):
    normal_string = "normal"
    oversized_string = "a" * (MAX_NLP_TEXT_LENGTH + 1)

    input_values = [[normal_string, oversized_string, "valid"]]
    result = preprocess_values(input_values)

    assert len(result) == 3
    assert result[0] == normal_string
    assert result[1] == "a" * MAX_NLP_TEXT_LENGTH
    assert result[2] == "valid"
    mock_logger.warning.assert_called_once()


@patch("metadata.pii.algorithms.preprocessing.logger")
def test_preprocess_values_all_oversized_returns_truncated(mock_logger):
    oversized_1 = "a" * (MAX_NLP_TEXT_LENGTH + 1)
    oversized_2 = "b" * (MAX_NLP_TEXT_LENGTH + 100)

    input_values = [oversized_1, oversized_2]
    result = preprocess_values(input_values)

    assert len(result) == 2
    assert result[0] == "a" * MAX_NLP_TEXT_LENGTH
    assert result[1] == "b" * MAX_NLP_TEXT_LENGTH
    assert mock_logger.warning.call_count == 2
