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
Tests utils function for the profiler
"""

from unittest import TestCase

from metadata.profiler.metrics.hybrid.histogram import Histogram


class TestHistogramUtils(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.histogram = Histogram()

    def test_histogram_label_formatter_positive(self):
        """test label formatter for histogram"""
        formatted_label = self.histogram._format_bin_labels(18927, 23456)
        assert formatted_label == "18.93K to 23.46K"

        formatted_label = self.histogram._format_bin_labels(18927)
        assert formatted_label == "18.93K and up"

    def test_histogram_label_formatter_negative(self):
        """test label formatter for histogram for negative numbers"""
        formatted_label = self.histogram._format_bin_labels(-18927, -23456)
        assert formatted_label == "-18.93K to -23.46K"

        formatted_label = self.histogram._format_bin_labels(-18927)
        assert formatted_label == "-18.93K and up"

    def test_histogram_label_formatter_none(self):
        """test label formatter for histogram for None"""
        formatted_label = self.histogram._format_bin_labels(None)
        assert formatted_label == "null and up"

    def test_histogram_label_formatter_zero(self):
        """test label formatter for histogram with zero"""
        formatted_label = self.histogram._format_bin_labels(0)
        assert formatted_label == "0 and up"

    def test_histogram_label_formatter_nines(self):
        """test label formatter for histogram for nines"""
        formatted_label = self.histogram._format_bin_labels(99999999)
        assert formatted_label == "100.00M and up"

    def test_histogram_label_formatter_floats(self):
        """test label formatter for histogram for floats"""
        formatted_label = self.histogram._format_bin_labels(167893.98542, 194993.98542)
        assert formatted_label == "167.89K to 194.99K"
