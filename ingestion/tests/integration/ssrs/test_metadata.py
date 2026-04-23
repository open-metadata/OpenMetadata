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
Ssrs integration tests using a mock HTTP server
"""
import pytest

from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
)
from metadata.ingestion.source.dashboard.ssrs.client import SsrsClient


@pytest.mark.integration
class TestSsrsMetadata:
    def test_client_get_reports(self, ssrs_service):
        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        reports = list(client.get_reports())
        assert len(reports) == 4
        assert reports[0].name == "Report 1"
        assert reports[0].path == "/TestFolder/Report 1"

    def test_client_get_folders(self, ssrs_service):
        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        folders = list(client.get_folders())
        assert len(folders) == 1
        assert folders[0].name == "TestFolder"

    def test_client_test_access(self, ssrs_service):
        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        client.test_access()

    def test_hidden_reports_present_in_raw(self, ssrs_service):
        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        reports = list(client.get_reports())
        assert any(r.hidden for r in reports)
        visible = [r for r in reports if not r.hidden]
        assert len(visible) == 3

    def test_client_get_report_definition_returns_bytes(self, ssrs_service):
        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        rdl = client.get_report_definition("report-1")
        assert rdl is not None
        assert b"<DataSets>" in rdl
        assert b"SELECT OrderId FROM dbo.Orders" in rdl

    def test_client_get_report_definition_404_returns_none(self, ssrs_service):
        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        assert client.get_report_definition("does-not-exist") is None

    def test_end_to_end_rdl_parse_via_mock_server(self, ssrs_service):
        from metadata.ingestion.source.dashboard.ssrs.rdl_parser import parse_rdl

        connection = SsrsConnection(
            hostPort=ssrs_service, username="test_user", password="test_pass"
        )
        client = SsrsClient(connection)
        rdl = client.get_report_definition("report-1")
        parsed = parse_rdl(rdl)
        assert len(parsed.data_sets) == 1
        assert parsed.data_sets[0].command_text == "SELECT OrderId FROM dbo.Orders"
        assert parsed.data_sources[0].database == "SalesDB"
