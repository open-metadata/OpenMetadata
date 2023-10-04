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
from unittest import TestCase

from metadata.pii.models import TagAndConfidence
from metadata.pii.scanners.column_name_scanner import ColumnNameScanner

EXPECTED_SENSITIVE = TagAndConfidence(
    tag_fqn="PII.Sensitive",
    confidence=1,
)


class ColumnNameScannerTest(TestCase):
    """
    Validate various typical column names
    """

    def test_column_names_none(self):
        self.assertIsNone(ColumnNameScanner.scan("access_channel"))
        self.assertIsNone(ColumnNameScanner.scan("status_reason"))

        # Credit Card
        self.assertIsNone(ColumnNameScanner.scan("credit"))
        self.assertIsNone(ColumnNameScanner.scan("user_credits"))

        # Users
        self.assertIsNone(ColumnNameScanner.scan("id"))
        self.assertIsNone(ColumnNameScanner.scan("user_id"))

    def test_column_names_sensitive(self):

        # Bank
        self.assertEqual(ColumnNameScanner.scan("bank_account"), EXPECTED_SENSITIVE)

        # Credit Card
        self.assertEqual(ColumnNameScanner.scan("credit_card"), EXPECTED_SENSITIVE)
        self.assertEqual(
            ColumnNameScanner.scan("credit_card_number"), EXPECTED_SENSITIVE
        )
        self.assertEqual(
            ColumnNameScanner.scan("personal_credit_card"), EXPECTED_SENSITIVE
        )

        # Users
        self.assertEqual(ColumnNameScanner.scan("user_name"), EXPECTED_SENSITIVE)
        self.assertEqual(ColumnNameScanner.scan("user_first_name"), EXPECTED_SENSITIVE)
        self.assertEqual(ColumnNameScanner.scan("user_last_name"), EXPECTED_SENSITIVE)
        self.assertEqual(ColumnNameScanner.scan("client_name"), EXPECTED_SENSITIVE)
        self.assertEqual(
            ColumnNameScanner.scan("person_first_name"), EXPECTED_SENSITIVE
        )
        self.assertEqual(ColumnNameScanner.scan("client_last_name"), EXPECTED_SENSITIVE)

        self.assertEqual(ColumnNameScanner.scan("email"), EXPECTED_SENSITIVE)
