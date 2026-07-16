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
"""Unit tests for the shared count/cap phrasing."""

import pytest

from metadata.core.connections.test_connection.checks.summary import count, more_suffix


@pytest.mark.parametrize(
    ("number", "noun", "expected"),
    [(0, "table", "0 tables"), (1, "table", "1 table"), (2, "table", "2 tables")],
)
def test_count_pluralizes_to_match_the_number(number, noun, expected):
    assert count(number, noun) == expected


def test_count_pluralizes_a_multi_word_noun_on_the_last_word():
    assert count(1, "policy tag") == "1 policy tag"
    assert count(3, "policy tag") == "3 policy tags"


def test_count_is_exact_when_no_cap_is_given():
    assert count(500, "table") == "500 tables"


def test_count_reports_a_floor_at_the_cap():
    assert count(100, "table", 100) == "100+ tables"


def test_count_is_exact_below_the_cap():
    assert count(99, "table", 100) == "99 tables"


def test_more_suffix_marks_a_capped_listing():
    assert more_suffix(100, True) == " (showing first 100; more exist)"


def test_more_suffix_is_silent_when_nothing_was_dropped():
    assert more_suffix(3, False) == ""
