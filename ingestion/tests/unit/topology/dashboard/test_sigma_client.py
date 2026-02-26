#  Copyright 2026 Collate
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
Test Sigma API Client
"""

from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
)
from metadata.ingestion.source.dashboard.sigma.client import SigmaApiClient


class TestSigmaApiClient(TestCase):
    """Test cases for Sigma API Client"""

    def setUp(self):
        """Set up test client"""
        config = SigmaConnection(
            hostPort="https://api.sigmacomputing.com",
            clientId="test-client",
            clientSecret="test-secret",
        )

        with patch("metadata.ingestion.source.dashboard.sigma.client.REST"):
            self.client = SigmaApiClient(config)

    def test_get_chart_details_single_page_workbook(self):
        """Test fetching chart details from single-page workbook"""

        def mock_get(path, data=None):
            if "/pages" in path and "/elements" not in path:
                return {"entries": [{"pageId": "page-1"}], "total": 1, "nextPage": None}
            if "/elements" in path:
                return {
                    "entries": [
                        {
                            "elementId": "el-1",
                            "name": "Revenue Chart",
                            "vizualizationType": "bar",
                        },
                        {
                            "elementId": "el-2",
                            "name": "Users Table",
                            "vizualizationType": "table",
                        },
                    ],
                    "total": 2,
                    "nextPage": None,
                }
            return {}

        self.client.client.get = mock_get

        result = self.client.get_chart_details("test-workbook-123")

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].elementId, "el-1")
        self.assertEqual(result[1].elementId, "el-2")

    def test_get_chart_details_multiple_pages(self):
        """Test fetching chart details from multi-page workbook"""

        def mock_get(path, data=None):
            if "/pages" in path and "/elements" not in path:
                if data is None:
                    return {
                        "entries": [{"pageId": "page-1"}],
                        "total": 2,
                        "nextPage": "2",
                    }
                return {"entries": [{"pageId": "page-2"}], "total": 2, "nextPage": None}
            if "/elements" in path:
                if "page-1" in path:
                    return {
                        "entries": [
                            {
                                "elementId": "el-A",
                                "name": "Chart A",
                                "vizualizationType": "bar",
                            }
                        ],
                        "total": 1,
                        "nextPage": None,
                    }
                return {
                    "entries": [
                        {
                            "elementId": "el-B",
                            "name": "Chart B",
                            "vizualizationType": "pie",
                        }
                    ],
                    "total": 1,
                    "nextPage": None,
                }
            return {}

        self.client.client.get = mock_get

        result = self.client.get_chart_details("test-workbook-123")

        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        element_ids = {e.elementId for e in result}
        self.assertIn("el-A", element_ids)
        self.assertIn("el-B", element_ids)

    def test_get_chart_details_no_pages(self):
        """Test handling workbook with no pages"""

        def mock_get(path, data=None):
            return {"entries": [], "total": 0, "nextPage": None}

        self.client.client.get = mock_get

        result = self.client.get_chart_details("test-workbook-123")

        self.assertIsNone(result)
