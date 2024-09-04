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
Test Column Name Scanner
"""

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
