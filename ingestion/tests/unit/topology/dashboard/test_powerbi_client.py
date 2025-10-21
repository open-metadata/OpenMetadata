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
Test PowerBI client functionality
"""

from unittest import TestCase

from metadata.ingestion.source.dashboard.powerbi.client import (
    get_api_url_from_dashboard_url,
)


class TestPowerBiClient(TestCase):
    """
    Test cases for PowerBI client
    """

    def test_get_api_url_from_dashboard_url_public_cloud(self):
        """Test API URL derivation for public cloud"""
        # Standard public cloud URL
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbi.com"),
            "https://api.powerbi.com",
        )

        # With trailing slash
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbi.com/"),
            "https://api.powerbi.com",
        )

        # With path
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbi.com/home/"),
            "https://api.powerbi.com",
        )

    def test_get_api_url_from_dashboard_url_gcc(self):
        """Test API URL derivation for GCC (Government Community Cloud)"""
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbigov.us"),
            "https://api.powerbigov.us",
        )

        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbigov.us/"),
            "https://api.powerbigov.us",
        )

    def test_get_api_url_from_dashboard_url_gcc_high(self):
        """Test API URL derivation for GCC High"""
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.high.powerbigov.us"),
            "https://api.high.powerbigov.us",
        )

        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.high.powerbigov.us/home/"),
            "https://api.high.powerbigov.us",
        )

    def test_get_api_url_from_dashboard_url_dod(self):
        """Test API URL derivation for DoD (Department of Defense)"""
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.mil.powerbigov.us"),
            "https://api.mil.powerbigov.us",
        )

        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.mil.powerbigov.us/"),
            "https://api.mil.powerbigov.us",
        )

    def test_get_api_url_from_dashboard_url_china(self):
        """Test API URL derivation for China (21Vianet)"""
        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbi.cn"),
            "https://api.powerbi.cn",
        )

        self.assertEqual(
            get_api_url_from_dashboard_url("https://app.powerbi.cn/"),
            "https://api.powerbi.cn",
        )

    def test_get_api_url_from_dashboard_url_http(self):
        """Test API URL derivation with http protocol"""
        self.assertEqual(
            get_api_url_from_dashboard_url("http://app.powerbi.com"),
            "https://api.powerbi.com",
        )

    def test_get_api_url_from_dashboard_url_no_app_prefix(self):
        """Test API URL derivation when URL doesn't have 'app.' prefix"""
        # Should fall back to default
        self.assertEqual(
            get_api_url_from_dashboard_url("https://powerbi.com"),
            "https://api.powerbi.com",
        )

        self.assertEqual(
            get_api_url_from_dashboard_url("https://custom.powerbi.com"),
            "https://api.powerbi.com",
        )

    def test_get_api_url_from_dashboard_url_with_complex_path(self):
        """Test API URL derivation with complex paths"""
        self.assertEqual(
            get_api_url_from_dashboard_url(
                "https://app.high.powerbigov.us/home/workspace/123"
            ),
            "https://api.high.powerbigov.us",
        )
