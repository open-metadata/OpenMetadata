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
import pytest

from metadata.pii.models import TagAndConfidence
from metadata.pii.scanners.column_name_scanner import ColumnNameScanner

EXPECTED_SENSITIVE = TagAndConfidence(
    tag_fqn="PII.Sensitive",
    confidence=1,
)


@pytest.fixture
def scanner() -> ColumnNameScanner:
    """Return the scanner"""
    return ColumnNameScanner()


def test_column_names_none(scanner):
    assert scanner.scan("access_channel") is None
    assert scanner.scan("status_reason") is None

    # Credit Card
    assert scanner.scan("credit") is None
    assert scanner.scan("user_credits") is None

    # Users
    assert scanner.scan("id") is None
    assert scanner.scan("user_id") is None

    # Mails
    assert scanner.scan("email_verified") is None


def test_column_names_sensitive(scanner):
    # Bank
    assert scanner.scan("bank_account") == EXPECTED_SENSITIVE

    # Credit Card
    assert scanner.scan("credit_card") == EXPECTED_SENSITIVE
    assert scanner.scan("credit_card_number") == EXPECTED_SENSITIVE
    assert scanner.scan("personal_credit_card") == EXPECTED_SENSITIVE

    # Users
    assert scanner.scan("user_name") == EXPECTED_SENSITIVE
    assert scanner.scan("user_first_name") == EXPECTED_SENSITIVE
    assert scanner.scan("user_last_name") == EXPECTED_SENSITIVE
    assert scanner.scan("client_name") == EXPECTED_SENSITIVE
    assert scanner.scan("person_first_name") == EXPECTED_SENSITIVE
    assert scanner.scan("client_last_name") == EXPECTED_SENSITIVE

    assert scanner.scan("email") == EXPECTED_SENSITIVE
    assert scanner.scan("email_address") == EXPECTED_SENSITIVE
    assert scanner.scan("ssn") == EXPECTED_SENSITIVE
