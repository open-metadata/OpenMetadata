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
Test Column Name Scanner
"""
from typing import Any

import pytest

from metadata.pii.scanners.ner_scanner import NERScanner, StringAnalysis


@pytest.fixture
def scanner() -> NERScanner:
    """Return the scanner"""
    return NERScanner()


def test_scanner_none(scanner):
    assert scanner.scan(list(range(100))) is None
    assert (
        scanner.scan(
            " ".split(
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam consequat quam sagittis convallis cursus."
            )
        )
    ) is None


def test_scanner_sensitive(scanner):
    assert (
        scanner.scan(
            [
                "geraldc@gmail.com",
                "saratimithi@godesign.com",
                "heroldsean@google.com",
            ]
        ).tag_fqn
        == "PII.Sensitive"
    )
    assert (
        scanner.scan(["im ok", "saratimithi@godesign.com", "not sensitive"]).tag_fqn
        == "PII.Sensitive"
    )


def test_scanner_nonsensitive(scanner):
    assert (
        scanner.scan(
            [
                "Washington",
                "Alaska",
                "Netherfield Lea Street",
            ]
        ).tag_fqn
        == "PII.NonSensitive"
    )


def test_get_highest_score_label(scanner):
    """Validate that even with score clashes, we only get one result back"""
    assert scanner.get_highest_score_label(
        {
            "PII.Sensitive": StringAnalysis(score=0.9, appearances=1),
            "PII.NonSensitive": StringAnalysis(score=0.8, appearances=1),
        }
    ) == ("PII.Sensitive", 0.9)
    assert scanner.get_highest_score_label(
        {
            "PII.Sensitive": StringAnalysis(score=1.0, appearances=1),
            "PII.NonSensitive": StringAnalysis(score=1.0, appearances=1),
        }
    ) == ("PII.Sensitive", 1.0)


@pytest.mark.parametrize(
    "data,is_json",
    [
        ("potato", (False, None)),
        ("1", (False, None)),
        ('{"key": "value"}', (True, {"key": "value"})),
        (
            '{"key": "value", "key2": "value2"}',
            (True, {"key": "value", "key2": "value2"}),
        ),
        ('["potato"]', (True, ["potato"])),
    ],
)
def test_is_json_data(scanner, data: Any, is_json: bool):
    """Assert we are flagging JSON data correctly"""
    assert scanner.is_json_data(data) == is_json


def test_scanner_with_json(scanner):
    """Test the scanner with JSON data"""

    assert (
        scanner.scan(
            [
                '{"email": "johndoe@example.com", "address": {"street": "123 Main St"}}',
                '{"email": "potato", "age": 30, "preferences": {"newsletter": true, "notifications": "email"}}',
            ]
        ).tag_fqn
        == "PII.Sensitive"
    )

    assert (
        scanner.scan(
            [
                '{"email": "foo", "address": {"street": "bar"}}',
                '{"email": "potato", "age": 30, "preferences": {"newsletter": true, "notifications": "email"}}',
            ]
        )
        is None
    )


def test_scanner_with_lists(scanner):
    """Test the scanner with list data"""

    assert scanner.scan(["foo", "bar", "biz"]) is None

    assert (
        scanner.scan(["foo", "bar", "johndoe@example.com"]).tag_fqn == "PII.Sensitive"
    )

    assert (
        scanner.scan(
            [
                '{"emails": ["johndoe@example.com", "lima@example.com"]}',
                '{"emails": ["foo", "bar", "biz"]}',
            ]
        ).tag_fqn
        == "PII.Sensitive"
    )


def test_scan_entities(scanner):
    """
    We can properly validate certain entities.

    > NOTE: These lists are randomly generated and not valid IDs for any actual use
    """
    pan_numbers = ["AFZPK7190K", "BLQSM2938L", "CWRTJ5821M", "DZXNV9045A", "EHYKG6752P"]
    assert scanner.scan(pan_numbers).tag_fqn == "PII.Sensitive"

    ssn_numbers = [
        "123-45-6789",
        "987-65-4321",
        "543-21-0987",
        "678-90-1234",
        "876-54-3210",
    ]
    assert scanner.scan(ssn_numbers).tag_fqn == "PII.Sensitive"

    nif_numbers = ["12345678A", "87654321B", "23456789C", "98765432D", "34567890E"]
    assert scanner.scan(nif_numbers).tag_fqn == "PII.Sensitive"
