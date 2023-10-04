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

from metadata.pii.scanners.ner_scanner import NERScanner


class NERScannerTest(TestCase):
    """
    Validate various typical column names
    """

    ner_scanner = NERScanner()

    def test_scanner_none(self):
        self.assertIsNone(self.ner_scanner.scan(list(range(100))))
        self.assertIsNone(
            self.ner_scanner.scan(
                " ".split(
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam consequat quam sagittis convallis cursus."
                )
            )
        )

    def test_scanner_sensitive(self):
        self.assertEqual(
            self.ner_scanner.scan(
                [
                    "geraldc@gmail.com",
                    "saratimithi@godesign.com",
                    "heroldsean@google.com",
                ]
            ).tag_fqn,
            "PII.Sensitive",
        )
        self.assertEqual(
            self.ner_scanner.scan(
                ["im ok", "saratimithi@godesign.com", "not sensitive"]
            ).tag_fqn,
            "PII.Sensitive",
        )

    def test_scanner_nonsensitive(self):
        self.assertEqual(
            self.ner_scanner.scan(
                [
                    "Washington",
                    "Alaska",
                    "Netherfield Lea Street",
                ]
            ).tag_fqn,
            "PII.NonSensitive",
        )
