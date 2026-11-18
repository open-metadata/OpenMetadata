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

import json
from collections import Counter
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
import requests

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

        with patch("metadata.ingestion.source.dashboard.sigma.client.TrackedREST"):
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


def sigma_workbook(workbook_id: str, owner_id: str) -> dict:
    return {
        "workbookId": workbook_id,
        "workbookUrlId": f"url-{workbook_id}",
        "name": f"Sales {workbook_id}",
        "url": f"https://app.sigmacomputing.com/acme/workbook/{workbook_id}",
        "path": "Shared/Finance",
        "latestVersion": 3,
        "ownerId": owner_id,
        "createdBy": owner_id,
        "updatedBy": owner_id,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
    }


def sigma_member(member_id: str, email: str) -> dict:
    return {
        "organizationId": "org-1",
        "memberId": member_id,
        "memberType": "admin",
        "firstName": "Ada",
        "lastName": "Lovelace",
        "email": email,
        "profileImgUrl": None,
        "createdBy": member_id,
        "updatedBy": member_id,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-02T00:00:00Z",
        "homeFolderId": "folder-1",
        "userKind": "internal",
    }


def sigma_routes() -> dict:
    """Sigma responses valid against its OpenAPI spec, keyed by (method, path)"""
    routes = {
        ("POST", "/v2/auth/token"): {"access_token": "token", "token_type": "bearer", "expires_in": 3600},
        ("GET", "/v2/workbooks"): {
            "entries": [sigma_workbook("wb-1", "member-1"), sigma_workbook("wb-2", "member-1")],
            "nextPage": None,
        },
        ("GET", "/v2/members/member-1"): sigma_member("member-1", "ada@example.com"),
        ("GET", "/v2/members/member-2"): sigma_member("member-2", "grace@example.com"),
        ("GET", "/v2/files/T1"): {
            "id": "T1",
            "urlId": "t1-url",
            "name": "ORDERS",
            "type": "table",
            "parentId": "P1",
            "parentUrlId": "p1-url",
            "permission": "view",
            "path": "Connection Root/ANALYTICS.PUBLIC",
            "badge": None,
            "isArchived": False,
            "createdBy": "member-1",
            "updatedBy": "member-1",
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-02T00:00:00Z",
        },
    }
    for workbook_id in ("wb-1", "wb-2"):
        routes["GET", f"/v2/workbooks/{workbook_id}/lineage/elements/el-{workbook_id}"] = {
            "dependencies": {},
            "edges": [{"source": "inode-T1", "target": f"sheet-el-{workbook_id}", "type": "source"}],
        }
    return routes


@pytest.fixture
def sigma_client_over_http():
    """Real SigmaApiClient; HTTP is answered from sigma_routes() and counted per (method, path)"""
    routes = sigma_routes()
    calls = Counter()

    def answer(method, url, **_):
        path = urlparse(str(url)).path
        calls[method, path] += 1
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps(routes[method, path]).encode()
        return response

    client = SigmaApiClient(
        SigmaConnection(
            hostPort="https://api.sigmacomputing.com",
            clientId="test-client",
            clientSecret="test-secret",
        )
    )
    client.client._session.request = answer
    client.token_client._session.request = answer
    return client, calls


def test_workbook_listing_is_requested_once(sigma_client_over_http):
    client, calls = sigma_client_over_http

    assert [workbook.workbookId for workbook in client.get_dashboards()] == ["wb-1", "wb-2"]
    assert calls["GET", "/v2/workbooks"] == 1
    client.test_get_dashboards()
    assert calls["GET", "/v2/workbooks"] == 2


def test_owner_is_read_once_for_workbooks_sharing_it(sigma_client_over_http):
    client, calls = sigma_client_over_http

    assert [client.get_owner_detail("member-1").email for _ in range(2)] == ["ada@example.com", "ada@example.com"]
    assert calls["GET", "/v2/members/member-1"] == 1


def test_each_distinct_owner_is_read(sigma_client_over_http):
    client, calls = sigma_client_over_http

    emails = [client.get_owner_detail(member_id).email for member_id in ("member-1", "member-2")]

    assert emails == ["ada@example.com", "grace@example.com"]
    assert calls["GET", "/v2/members/member-1"] == 1
    assert calls["GET", "/v2/members/member-2"] == 1


def test_table_file_is_read_once_for_elements_sharing_it(sigma_client_over_http):
    client, calls = sigma_client_over_http

    tables = [
        [node.name for node in client.get_lineage_details(workbook_id, f"el-{workbook_id}")[0]]
        for workbook_id in ("wb-1", "wb-2")
    ]

    assert tables == [["ORDERS"], ["ORDERS"]]
    assert calls["GET", "/v2/files/T1"] == 1


@pytest.mark.parametrize("page_token", ["2", "opaque-next-page"])
@pytest.mark.parametrize("listing", ["workbooks", "pages", "queries"])
def test_paginated_listings_keep_entries_from_every_page(page_token, listing):
    client = SigmaApiClient(
        SigmaConnection(
            hostPort="https://api.sigmacomputing.com",
            clientId="test-client",
            clientSecret="test-secret",
        )
    )
    routes = sigma_routes()
    path = "/v2/workbooks" if listing == "workbooks" else f"/v2/workbooks/wb-1/{listing}"
    if listing == "workbooks":
        entries = [sigma_workbook("wb-1", "member-1"), sigma_workbook("wb-2", "member-1")]
    elif listing == "pages":
        entries = [{"pageId": "page-1"}, {"pageId": "page-2"}]
        for index in (1, 2):
            routes["GET", f"{path}/page-{index}/elements"] = {
                "entries": [{"elementId": f"el-{index}"}],
                "nextPage": None,
            }
    else:
        entries = [{"elementId": "el-1", "sql": "SELECT 1"}, {"elementId": "el-2", "sql": "SELECT 2"}]
    routes["GET", path] = {"entries": entries[:1], "nextPage": page_token}
    routes["GET", path, page_token] = {"entries": entries[1:], "nextPage": None}

    def answer(method, url, params=None, **_):
        request_path = urlparse(str(url)).path
        page = (params or {}).get("page")
        key = (method, request_path, str(page)) if page is not None else (method, request_path)
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps(routes[key]).encode()
        return response

    client.client._session.request = answer
    client.token_client._session.request = answer
    if listing == "workbooks":
        assert [workbook.workbookId for workbook in client.get_dashboards()] == ["wb-1", "wb-2"]
    elif listing == "pages":
        assert [element.elementId for element in client.get_chart_details("wb-1")] == ["el-1", "el-2"]
    else:
        result = client.get_workbook_queries("wb-1")
        assert result is not None
        assert [query.sql for query in result.entries] == ["SELECT 1", "SELECT 2"]
