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
Test Sigma dashboard owners: the workbook owner's Sigma email is looked up as an OpenMetadata user
"""

import json
from unittest.mock import patch
from urllib.parse import urlparse

import pytest
import requests

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.sigma.client import SigmaApiClient
from metadata.ingestion.source.dashboard.sigma.metadata import SigmaSource

CONFIG = {
    "source": {
        "type": "sigma",
        "serviceName": "mock_sigma",
        "serviceConnection": {
            "config": {
                "type": "Sigma",
                "clientId": "client_id",
                "clientSecret": "client_secret",
                "hostPort": "https://api.sigmacomputing.com",
                "apiVersion": "v2",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata", "includeOwners": True}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

ADA = EntityReferenceList(
    root=[EntityReference(id="550e8400-e29b-41d4-a716-446655440000", type="user", name="ada.lovelace")]
)


def sigma_routes(owner_email: str) -> dict:
    """Responses valid against Sigma's OpenAPI spec for one workbook and its owner, keyed by (method, path)"""
    return {
        ("POST", "/v2/auth/token"): {"access_token": "token", "token_type": "bearer", "expires_in": 3600},
        ("GET", "/v2/workbooks/wb-1"): {
            "workbookId": "wb-1",
            "workbookUrlId": "url-wb-1",
            "name": "Sales",
            "url": "https://app.sigmacomputing.com/acme/workbook/wb-1",
            "path": "Shared/Finance",
            "latestVersion": 3,
            "ownerId": "member-1",
            "createdBy": "member-1",
            "updatedBy": "member-1",
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-02T00:00:00Z",
            "isArchived": False,
        },
        ("GET", "/v2/members/member-1"): {
            "organizationId": "org-1",
            "memberId": "member-1",
            "memberType": "admin",
            "firstName": "Ada",
            "lastName": "Lovelace",
            "email": owner_email,
            "profileImgUrl": None,
            "createdBy": "member-1",
            "updatedBy": "member-1",
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-02T00:00:00Z",
            "homeFolderId": "folder-1",
            "userKind": "internal",
        },
    }


@pytest.fixture
def sigma_source():
    """SigmaSource with owners on; OpenMetadata knows one user, by the lowercased email it stores"""
    with (
        patch("metadata.ingestion.source.dashboard.dashboard_service.run_test_connection"),
        patch("metadata.ingestion.source.dashboard.dashboard_service.create_connection"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(CONFIG)
        source = SigmaSource.create(CONFIG["source"], OpenMetadata(config.workflowConfig.openMetadataServerConfig))
    source.context.get().__dict__["dashboard_service"] = "mock_sigma"
    # The server lowercases user emails on create and get_reference_by_email matches email.keyword exactly
    source.metadata.get_reference_by_email = {"ada.lovelace@example.com": ADA}.get
    return source


def dashboard_owners(source, owner_email: str, member_status: int = 200) -> EntityReferenceList | None:
    """Owners of the dashboard built from wb-1, with Sigma answering over HTTP and returning owner_email,
    or member_status for the owner's /members read"""
    routes = sigma_routes(owner_email)

    def answer(method, url, **_):
        path = urlparse(str(url)).path
        response = requests.Response()
        response.status_code = member_status if path == "/v2/members/member-1" else 200
        response._content = json.dumps(routes[method, path] if response.status_code == 200 else {}).encode()
        return response

    source.client = SigmaApiClient(source.service_connection)
    source.client.client._session.request = answer
    source.client.token_client._session.request = answer
    (dashboard,) = [either.right for either in source.yield_dashboard(source.client.get_dashboard_detail("wb-1"))]
    return dashboard.owners


@pytest.mark.parametrize(
    "owner_email",
    ["ada.lovelace@example.com", "Ada.Lovelace@Example.com"],
    ids=["lowercase", "mixed-case"],
)
def test_dashboard_owner_is_found_whatever_the_case_of_the_sigma_email(sigma_source, owner_email):
    assert dashboard_owners(sigma_source, owner_email) == ADA


def test_failed_owner_read_gives_no_owner_and_logs_only_the_failed_read(sigma_source, caplog):
    caplog.set_level("WARNING", logger="metadata.Ingestion")

    assert dashboard_owners(sigma_source, "ada.lovelace@example.com", member_status=500) is None
    assert "Failed to fetch owner details for owner member-1" in caplog.text
    assert "Could not fetch owner data" not in caplog.text
