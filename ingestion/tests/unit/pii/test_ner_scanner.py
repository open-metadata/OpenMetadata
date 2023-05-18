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

from metadata.pii.models import TagType
from metadata.pii.ner_scanner import NERScanner


class NERScannerTest(TestCase):
    """
    Validate various typical column names
    """

    def test_scanner_none(self):
        self.assertIsNone(NERScanner.scan(list(range(100))))
        self.assertIsNone(
            NERScanner.scan(
                " ".split(
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam consequat quam sagittis convallis cursus."
                )
            )
        )

    def test_scanner_sensitive(self):
        self.assertEqual(
            NERScanner.scan(
                [
                    "geraldc@gmail.com",
                    "saratimithi@godesign.com",
                    "heroldsean@google.com",
                ]
            ).tag,
            TagType.SENSITIVE,
        )
        self.assertEqual(
            NERScanner.scan(["im ok", "saratimithi@godesign.com", "not sensitive"]).tag,
            TagType.SENSITIVE,
        )
