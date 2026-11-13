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
MicroStrategy client and source, against a fake MicroStrategy Library REST API.

The payloads are trimmed from responses of the public MicroStrategy demo server.
"""

from __future__ import annotations

import json
from collections import OrderedDict
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch
from urllib.parse import urlparse

import pytest
import requests

from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
    MicroStrategyConnection,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.delete import SourceListing
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.microstrategy.client import (
    MicroStrategyApiError,
    MicroStrategyClient,
    strip_engine_steps,
)
from metadata.ingestion.source.dashboard.microstrategy.column_lineage import read_columns, table_matches
from metadata.ingestion.source.dashboard.microstrategy.metadata import MicrostrategySource
from metadata.ingestion.source.dashboard.microstrategy.models import MstrDashboard, MstrDataset

if TYPE_CHECKING:
    from collections.abc import Callable

CLIENT_MODULE = "metadata.ingestion.source.dashboard.microstrategy.client"
API = "/MicroStrategyLibrary/api"

TUTORIAL = {
    "acg": 5,
    "id": "B7CA92F04B9FAE8D941C3E9B7E0CD754",
    "name": "MicroStrategy Tutorial",
    "status": 0,
    "alias": "",
    "description": "MicroStrategy Tutorial project",
    "dateCreated": "2015-06-30T21:55:35.000+0000",
    "dateModified": "2026-10-31T05:22:01.000+0000",
    "owner": {"name": "Administrator", "id": "54F3D26011D2896560009A8E67019608"},
}
# No description key: the API leaves it out when a project has none.
MOBILE = {"id": "EC70648611E7A2F962E90080EFD58751", "name": "MobileDashboards", "status": 0, "acg": 255}

OWNER_ID = "54F3D26011D2896560009A8E67019608"
USER_ID = "3f2a8a31-1c55-4f0e-9a1c-5f6e8f1f9a01"


def _search_row(dossier_id: str, name: str, project_id: str, description: str | None = None) -> dict:
    row = {
        "name": name,
        "id": dossier_id,
        "type": 55,
        "subtype": 14081,
        "dateCreated": "2020-02-19T10:07:01.000+0000",
        "dateModified": "2024-11-06T14:14:42.000+0000",
        "version": "3E367000E84DD4AA9B501EAD892EB2E1",
        "acg": 199,
        "owner": {"name": "Administrator", "id": OWNER_ID, "expired": False},
        "extType": 0,
        "viewMedia": 1879072805,
        "certifiedInfo": {"certified": False},
        "templateInfo": {"template": False, "lastModifiedBy": {}},
        "projectId": project_id,
        "embedded": False,
        "managed": False,
        "mdTenantId": 1,
    }
    if description:
        row["description"] = description
    return row


OFFICE_ROYALE = _search_row(
    "27D332AC6D43352E0928B9A1FCAF4AB0", "Office Royale Sales", TUTORIAL["id"], "Sales of the Office Royale chain"
)
AIRLINE = _search_row("233AE5EF48F48E84B4626D8E0E8806DE", "Airline Flight Analysis", TUTORIAL["id"])
BROKEN = _search_row("3A6A3B1E4A8F46E2B57F4E1C2A9D0B11", "Legacy Layout", TUTORIAL["id"])
# Report Services documents, a document template and a theme: same type and subtype as a
# dossier, told apart only by viewMedia. Their dossier definition answers HTTP 500.
DOCUMENTS = [
    {**_search_row("B6375786480EECC3D2B57CB081AE32E9", "Light Theme Document", TUTORIAL["id"]), "viewMedia": view_media}
    for view_media in (805306485, 134217845, 402653188, 134217728, 268435711)
]

ATTRIBUTE_STORE = {
    "id": "4D03EE044D33671811F9ADA6B84668E9",
    "name": "Store",
    "type": "attribute",
    "forms": [
        {"id": "45C11FA478E745FEA08D781CEA190FE5", "name": "ID", "dataType": "integer", "baseFormType": "number"},
        {"id": "CCFBE2A5EADB4F50941FB879CCF1721C", "name": "Name", "dataType": "nVarChar", "baseFormType": "text"},
        {"id": "A96BB2BD440623B8CBE59299C5F8CF04", "name": "Rating", "dataType": "real", "baseFormType": "number"},
        {"id": "2FCF90264BCCA73839D2489007A90013", "name": "Image", "baseFormType": "url"},
    ],
}
OFFICE_ROYALE_CUBE = "F6C63ED59D41BF792A2C72B65070FE58"
METRIC_REVENUE = {"id": "89C18AB411E63ED105690080EF7548DB", "name": "Revenue", "type": "metric"}

# Both dossiers have a page K53 holding a visualization W63, as on the demo server.
DEFINITIONS = {
    OFFICE_ROYALE["id"]: {
        "id": OFFICE_ROYALE["id"],
        "name": OFFICE_ROYALE["name"],
        "currentChapter": "K1",
        "chapters": [
            {
                "key": "K1",
                "name": "Chapter 1",
                "pages": [
                    {
                        "key": "K53",
                        "name": "Overview",
                        "visualizations": [
                            {"key": "W63", "name": "Revenue by Store", "visualizationType": "vertical_bar"},
                            {"key": "W64", "name": "Revenue Trend", "visualizationType": "line_chart"},
                        ],
                    }
                ],
            }
        ],
        "datasets": [
            {
                "id": OFFICE_ROYALE_CUBE,
                "name": "Store Sales",
                "availableObjects": [ATTRIBUTE_STORE, METRIC_REVENUE],
                "rows": [],
                "columns": [],
                "pageBy": [],
            }
        ],
    },
    AIRLINE["id"]: {
        "id": AIRLINE["id"],
        "name": AIRLINE["name"],
        "currentChapter": "K1",
        "chapters": [
            {
                "key": "K1",
                "name": "Chapter 1",
                "pages": [
                    {
                        "key": "K53",
                        "name": "Flights",
                        "visualizations": [{"key": "W63", "name": "Delays", "visualizationType": "grid"}],
                    }
                ],
            }
        ],
        "datasets": [{"id": "E238CE7C486FB7EBB07452BD5E6CFF03", "name": "Flights", "availableObjects": []}],
    },
}
DEFINITION_ERROR = {
    "code": "ERR001",
    "message": "class com.microstrategy.rest.impl.model.dossier.Chapter cannot be cast to class "
    "com.microstrategy.rest.impl.model.dossier.Page",
    "ticketId": "e441694720c84451b419f529045336c2",
}
CUBE_STATEMENT = """select\t`a16`.`CATEGORY_ID`  `CATEGORY_ID`,
\tmax(`a111`.`CATEGORY_DESC`)  `CATEGORY0`,
\tsum(`a11`.`qty_sold`)  `WJXBFS1`
from\t`order_detail`\t`a11`
\tjoin\t`tutorial_wh`.`lu_item`\t`a16`
\t  on \t(`a11`.`ITEM_ID` = `a16`.`ITEM_ID`)
\tjoin\t`tutorial_wh`.`lu_category`\t`a111`
\t  on \t(`a16`.`CATEGORY_ID` = `a111`.`CATEGORY_ID`)
group by\t`a16`.`CATEGORY_ID`"""
CUBE_SQL = (
    CUBE_STATEMENT
    + """

[Analytical engine calculation steps:
\t1.  Perform cross-tabbing
]"""
)


class FakeMicroStrategy:
    """
    Answers the client's HTTP calls like a MicroStrategy Library server. Search results are
    scoped by the X-MSTR-ProjectID header, as on a real server.
    """

    def __init__(self) -> None:
        self.projects: list[dict] = [TUTORIAL, MOBILE]
        self.dossiers: dict[str, list[dict]] = {TUTORIAL["id"]: [OFFICE_ROYALE, AIRLINE], MOBILE["id"]: []}
        self.definitions: dict[str, dict] = dict(DEFINITIONS)
        self.overrides: dict[str, Callable[[], tuple[int, Any]]] = {}
        self.logins = 0
        self.calls: list[SimpleNamespace] = []
        self.api = API

    def login(self, url: str, json: dict, **_: Any) -> requests.Response:
        self.logins += 1
        self.calls.append(SimpleNamespace(method="POST", path=urlparse(url).path, params={}, headers={}, body=json))
        return _response(
            204, None, {"X-MSTR-AuthToken": f"token-{self.logins}", "Content-Security-Policy": "object-src 'none'"}
        )

    def request(self, session: requests.Session, method: str, url: str, **opts: Any) -> requests.Response:
        path = urlparse(str(url)).path.removeprefix(self.api)
        headers = opts.get("headers") or {}
        params = opts.get("params") or {}
        self.calls.append(SimpleNamespace(method=method, path=path, params=params, headers=headers, body=None))
        if path in self.overrides:
            status, body = self.overrides[path]()
        else:
            status, body = self._route(path, headers, params)
        return _response(status, body)

    def _route(self, path: str, headers: dict, params: dict) -> tuple[int, Any]:
        if path == "/projects":
            return 200, self.projects
        if path.startswith("/projects/"):
            name = requests.utils.unquote(path.removeprefix("/projects/"))
            match = [p for p in self.projects if p["name"] == name]
            return (200, match[0]) if match else (404, {"code": "ERR004", "message": "not found"})
        if path == "/searches/results":
            rows = self.dossiers.get(headers.get("X-MSTR-ProjectID"), [])
            offset, limit = int(params["offset"]), int(params["limit"])
            return 200, {"totalItems": len(rows), "result": rows[offset : offset + limit]}
        if path.startswith("/v2/dossiers/"):
            dossier_id = path.split("/")[3]
            if dossier_id in self.definitions:
                return 200, self.definitions[dossier_id]
            return 500, DEFINITION_ERROR
        if path.startswith("/v2/cubes/"):
            return 200, {"sqlStatement": CUBE_SQL}
        if path == f"/users/{OWNER_ID}/addresses":
            return 200, {
                "addresses": [
                    {"name": "Remote Diagnostics", "deliveryMode": "EMAIL", "value": "diag@example.com"},
                    {"name": "Default", "deliveryMode": "EMAIL", "value": "owner@example.com", "isDefault": True},
                ]
            }
        if path == "/sessions":
            return 200, {"username": "Guest"}
        return 404, {"code": "ERR004", "message": f"unexpected {path}"}

    def requests_to(self, path_prefix: str) -> list[SimpleNamespace]:
        return [call for call in self.calls if call.path.startswith(path_prefix)]


def _response(status: int, body: Any, headers: dict | None = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = "OK" if status < 400 else "Error"
    response.url = "https://mstr.example.com"
    response._content = json.dumps(body).encode() if body is not None else b""
    response.headers.update(headers or {})
    return response


@pytest.fixture
def server():
    fake = FakeMicroStrategy()
    with (
        patch(f"{CLIENT_MODULE}.requests.post", side_effect=fake.login),
        patch.object(requests.Session, "request", autospec=True, side_effect=fake.request),
    ):
        yield fake


def _connection(**overrides) -> MicroStrategyConnection:
    return MicroStrategyConnection(hostPort="https://mstr.example.com", username="u", password="p", **overrides)


@pytest.fixture
def client(server):
    return MicroStrategyClient(_connection())


def _source(client: MicroStrategyClient, **source_config: Any) -> MicrostrategySource:
    """A source over the real client, with the OpenMetadata side mocked"""
    source = MicrostrategySource.__new__(MicrostrategySource)
    source.client = client
    source.metadata = MagicMock()
    source.metadata.get_by_name.return_value = None
    source.service_connection = client.config
    source.source_config = SimpleNamespace(
        includeOwners=True,
        includeDataModels=True,
        projectFilterPattern=None,
        dashboardFilterPattern=None,
        chartFilterPattern=None,
        dataModelFilterPattern=None,
        markDeletedDashboards=True,
        markDeletedCharts=True,
        markDeletedDataModels=True,
        **source_config,
    )
    source.status = MagicMock()
    source.dashboard_listing = SourceListing()
    source.datamodel_listing = SourceListing()
    source.listing_failed = False
    source.definition_failed = False
    source.charts_unknown = False
    source._dialects = {}
    source._service_databases = {}
    source._tables_with_columns = OrderedDict()
    source._source_tables = OrderedDict()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(dashboard_service="mstr", charts=[])
    return source


def _details(source: MicrostrategySource, row: dict) -> Any:
    listed = MstrDashboard.model_validate({**row, "projectName": TUTORIAL["name"]})
    return source.get_dashboard_details(listed)


class TestClient:
    def test_search_is_scoped_by_the_project_header_and_paged(self, server, client):
        server.dossiers[TUTORIAL["id"]] = [OFFICE_ROYALE, AIRLINE, BROKEN]

        listed = list(client.iter_search_results(TUTORIAL["id"], page_size=2))

        assert [d.id for d in listed] == [OFFICE_ROYALE["id"], AIRLINE["id"], BROKEN["id"]]
        searches = server.requests_to("/searches/results")
        assert [s.params["offset"] for s in searches] == [0, 2]
        assert all(s.headers["X-MSTR-ProjectID"] == TUTORIAL["id"] for s in searches)
        assert all("project_id" not in s.params for s in searches)
        assert all(s.params["result.hidden"] is False for s in searches)

    def test_paging_without_total_items_stops_on_a_short_page(self, server, client):
        rows = [OFFICE_ROYALE, AIRLINE, BROKEN]

        def page() -> tuple[int, Any]:
            offset = int(server.calls[-1].params["offset"])
            return 200, {"result": rows[offset : offset + 2]}

        server.overrides["/searches/results"] = page

        assert len(list(client.iter_search_results(TUTORIAL["id"], page_size=2))) == 3

    def test_only_the_auth_token_is_forwarded_from_the_login(self, server, client):
        client.get_projects_list()

        headers = server.requests_to("/projects")[0].headers
        assert headers["X-MSTR-AuthToken"] == "token-1"
        assert "Content-Security-Policy" not in headers

    def test_a_failed_listing_raises_instead_of_returning_nothing(self, server, client):
        server.overrides["/projects"] = lambda: (500, {"code": "ERR001", "message": "Internal error"})

        with pytest.raises(MicroStrategyApiError):
            client.get_projects_list()

    def test_an_expired_session_logs_in_again_once(self, server, client):
        answers = iter([(401, {"code": "ERR009", "message": "The user's session has expired"})])
        server.overrides["/projects"] = lambda: next(answers, (200, [TUTORIAL]))

        projects = client.get_projects_list()

        assert [p.name for p in projects] == [TUTORIAL["name"]]
        assert server.logins == 2
        assert server.requests_to("/projects")[-1].headers["X-MSTR-AuthToken"] == "token-2"

    def test_a_malformed_project_is_skipped_and_counted(self, server, client):
        server.projects = [TUTORIAL, MOBILE, {"name": "No id"}]

        projects = client.get_projects_list()

        assert [p.name for p in projects] == [TUTORIAL["name"], MOBILE["name"]]
        assert client.skipped_objects == 1

    def test_project_name_reads_one_project(self, server):
        client = MicroStrategyClient(_connection(projectName="MicroStrategy Tutorial"))

        assert [p.id for p in client.get_projects_list()] == [TUTORIAL["id"]]
        assert server.requests_to("/projects/MicroStrategy%20Tutorial")

    def test_anonymous_login_sends_no_credentials(self, server):
        MicroStrategyClient(MicroStrategyConnection(hostPort="https://mstr.example.com", loginMode="8"))

        assert server.calls[0].body == {"loginMode": 8, "applicationType": 35}

    @pytest.mark.parametrize(
        "library_path", ["MicroStrategyLibrary2", "/MicroStrategyLibrary2/", " MicroStrategyLibrary2 "]
    )
    def test_a_custom_library_path_replaces_the_default(self, server, library_path):
        server.api = "/MicroStrategyLibrary2/api"
        client = MicroStrategyClient(_connection(libraryPath=library_path))

        assert [project.id for project in client.get_projects_list()] == [TUTORIAL["id"], MOBILE["id"]]
        assert server.calls[0].path == "/MicroStrategyLibrary2/api/auth/login"
        assert client.library_url == "https://mstr.example.com/MicroStrategyLibrary2"

    def test_a_login_404_points_at_the_library_path(self, server):
        with (
            patch(f"{CLIENT_MODULE}.requests.post", return_value=_response(404, {"code": "ERR404"})),
            pytest.raises(MicroStrategyApiError, match=r"HTTP 404.*check the Host and Port and the Library Path"),
        ):
            MicroStrategyClient(_connection())

    @pytest.mark.parametrize("library_path", [None, "", "/", "  "])
    def test_an_empty_library_path_falls_back_to_the_default(self, server, library_path):
        client = MicroStrategyClient(_connection(libraryPath=library_path))

        assert server.calls[0].path == "/MicroStrategyLibrary/api/auth/login"
        assert client.library_url == "https://mstr.example.com/MicroStrategyLibrary"

    def test_cube_sql_is_read_once_per_cube_and_failures_are_cached(self, server, client):
        assert client.get_cube_sql_details(TUTORIAL["id"], "C1") == CUBE_STATEMENT
        assert client.get_cube_sql_details(TUTORIAL["id"], "C1") == CUBE_STATEMENT
        server.overrides["/v2/cubes/C2/sqlView"] = lambda: (400, {"code": "ERR010", "message": "local file"})
        assert client.get_cube_sql_details(TUTORIAL["id"], "C2") is None
        assert client.get_cube_sql_details(TUTORIAL["id"], "C2") is None

        assert len(server.requests_to("/v2/cubes/")) == 2

    def test_an_error_body_without_a_message_raises_the_api_error(self, server, client):
        # The body the demo server answers for a document's dossier definition.
        server.overrides["/v2/dossiers/D1/definition"] = lambda: (
            500,
            {"code": "ERR001", "ticketId": "fdf739c16f914747a33e9040a72bbe88"},
        )

        with pytest.raises(MicroStrategyApiError, match="ERR001"):
            client.get_dashboard_details(TUTORIAL["id"], "D1")

    def test_a_report_used_as_a_dataset_has_no_sql_and_is_not_requested_again(self, server, client, caplog):
        server.overrides["/v2/cubes/R1/sqlView"] = lambda: (
            400,
            {
                "code": "ERR006",
                "message": "Cannot get the SQL view of object 'R1'. Only cube is supported to get SQL view.",
                "ticketId": "7f7c105f64bb4bc9b004791abfbb480f",
            },
        )

        assert client.get_cube_sql_details(TUTORIAL["id"], "R1") is None
        assert client.get_cube_sql_details(TUTORIAL["id"], "R1") is None

        assert len(server.requests_to("/v2/cubes/R1")) == 1
        assert "Dataset R1 is a report, not an Intelligent Cube" in caplog.text

    @pytest.mark.parametrize(
        "sql, expected",
        [
            (CUBE_SQL, CUBE_STATEMENT),
            (CUBE_STATEMENT + "\n\n[Analytical engine calculation steps:\n]", CUBE_STATEMENT),
            (CUBE_STATEMENT, CUBE_STATEMENT),
            (None, None),
            ("", ""),
        ],
    )
    def test_engine_steps_are_stripped_from_the_cube_sql(self, sql, expected):
        assert strip_engine_steps(sql) == expected

    def test_the_engine_steps_block_fails_parsing_until_stripped(self):
        raw = LineageParser(CUBE_SQL, dialect=Dialect.MYSQL)
        stripped = LineageParser(strip_engine_steps(CUBE_SQL), dialect=Dialect.MYSQL)

        assert not raw.query_parsing_success
        assert stripped.query_parsing_success
        assert sorted(str(table) for table in stripped.source_tables) == [
            "<default>.order_detail",
            "tutorial_wh.lu_category",
            "tutorial_wh.lu_item",
        ]

    def test_owner_email_is_the_default_address(self, client):
        assert client.get_owner_email(OWNER_ID) == "owner@example.com"


class TestSource:
    def test_projects_are_filtered_before_their_dossiers_are_searched(self, server, client):
        source = _source(client)
        source.source_config.projectFilterPattern = SimpleNamespace(includes=["Mobile.*"], excludes=None)

        assert list(source.get_dashboards_list()) == []
        assert {s.headers["X-MSTR-ProjectID"] for s in server.requests_to("/searches/results")} == {MOBILE["id"]}

    def test_dossiers_are_labelled_with_the_project_they_were_listed_under(self, client):
        source = _source(client)

        listed = list(source.get_dashboards_list())

        assert [(d.name, d.projectName) for d in listed] == [
            (OFFICE_ROYALE["name"], TUTORIAL["name"]),
            (AIRLINE["name"], TUTORIAL["name"]),
        ]
        assert source.dashboard_listing.is_complete
        assert not source.dashboard_listing.has_failed

    def test_the_listing_confirms_nothing_to_ingest_only_when_everything_was_filtered(self, client):
        source = _source(client)
        assert list(source.get_dashboards_list())
        assert not source.dashboard_listing.confirms_nothing_to_ingest

        source = _source(client)
        source.source_config.dashboardFilterPattern = SimpleNamespace(includes=None, excludes=[".*"])
        assert list(source.get_dashboards_list()) == []
        assert source.dashboard_listing.confirms_nothing_to_ingest

    def test_documents_are_skipped_without_reading_their_definition(self, server, client):
        server.dossiers[TUTORIAL["id"]] = [OFFICE_ROYALE, *DOCUMENTS]
        source = _source(client)

        listed = list(source.get_dashboards_list())

        assert [d.id for d in listed] == [OFFICE_ROYALE["id"]]
        assert server.requests_to("/v2/dossiers/") == []
        assert source.status.filter.call_count == len(DOCUMENTS)
        source.status.warning.assert_called_once()
        assert f"Skipped {len(DOCUMENTS)} " in source.status.warning.call_args.args[1]
        assert source.dashboard_listing.is_complete
        assert not source.listing_failed

    def test_a_project_holding_only_documents_confirms_nothing_to_ingest(self, server, client):
        server.dossiers[TUTORIAL["id"]] = DOCUMENTS
        source = _source(client)

        assert list(source.get_dashboards_list()) == []
        assert source.dashboard_listing.confirms_nothing_to_ingest

    def test_a_result_without_view_media_is_read_as_a_dossier(self, server, client):
        row = {key: value for key, value in AIRLINE.items() if key != "viewMedia"}
        server.dossiers[TUTORIAL["id"]] = [row]

        assert [d.id for d in _source(client).get_dashboards_list()] == [AIRLINE["id"]]

    def test_no_visible_project_is_not_a_confirmation(self, server, client):
        server.projects = []
        source = _source(client)

        assert list(source.get_dashboards_list()) == []
        assert not source.dashboard_listing.confirms_nothing_to_ingest

    def test_a_dossier_that_does_not_parse_keeps_every_stale_dashboard(self, server, client):
        server.dossiers[TUTORIAL["id"]] = [OFFICE_ROYALE, {"name": "No id"}]
        source = _source(client)

        assert [d.id for d in source.get_dashboards_list()] == [OFFICE_ROYALE["id"]]
        assert source.listing_failed
        assert not source.dashboard_listing.is_complete

    def test_a_failed_project_search_keeps_every_stale_entity(self, server, client):
        server.projects = [MOBILE, TUTORIAL]
        server.overrides["/searches/results"] = lambda: (500, {"code": "ERR001", "message": "Search failed"})
        source = _source(client)

        assert list(source.get_dashboards_list()) == []

        assert source.listing_failed
        assert source.dashboard_listing.has_failed
        assert not source.dashboard_listing.is_complete
        assert source.status.failed.call_count == 2
        with patch("metadata.ingestion.source.dashboard.dashboard_service.delete_entity_from_source") as delete:
            assert list(source.mark_dashboards_as_deleted()) == []
            assert list(source.mark_charts_as_deleted()) == []
            assert list(source.mark_datamodels_as_deleted()) == []
        delete.assert_not_called()

    def test_a_complete_run_deletes_stale_entities(self, client):
        source = _source(client)
        source.dashboard_source_state = set()
        list(source.get_dashboards_list())

        with patch(
            "metadata.ingestion.source.dashboard.dashboard_service.delete_entity_from_source", return_value=iter([])
        ) as delete:
            list(source.mark_dashboards_as_deleted())

        delete.assert_called_once()

    def test_charts_of_different_dossiers_do_not_collide(self, client):
        source = _source(client)
        names = []
        for row in (OFFICE_ROYALE, AIRLINE):
            details = _details(source, row)
            names += [either.right.name.root for either in source.yield_dashboard_chart(details)]

        assert names == [
            f"{OFFICE_ROYALE['id']}_K53W63",
            f"{OFFICE_ROYALE['id']}_K53W64",
            f"{AIRLINE['id']}_K53W63",
        ]

    def test_charts_name_their_existing_dashboard(self, client):
        # A chart update that leaves out its dashboards unlinks them from it.
        source = _source(client)
        source.metadata.get_by_name.return_value = SimpleNamespace(
            fullyQualifiedName=SimpleNamespace(root=f"mstr.{OFFICE_ROYALE['id']}"),
        )

        charts = [either.right for either in source.yield_dashboard_chart(_details(source, OFFICE_ROYALE))]

        assert [[d.root for d in chart.dashboards] for chart in charts] == [[f"mstr.{OFFICE_ROYALE['id']}"]] * 2
        assert all(chart.description is None and chart.tags is None for chart in charts)

    def test_a_failed_dashboard_lookup_leaves_the_dossier_and_its_charts_as_they_are(self, client):
        # A failed OpenMetadata read must not turn into an empty chart list, which would unlink
        # the dossier's charts and let stale deletion remove them.
        source = _source(client)
        source.dashboard_source_state = set()
        source.metadata.get_by_name.side_effect = APIError({"code": 503, "message": "unavailable"})
        details = _details(source, OFFICE_ROYALE)

        assert list(source.yield_dashboard_chart(details)) == []
        assert list(source.yield_dashboard(details)) == []

        assert source.charts_unknown
        assert source.dashboard_source_state == {f"mstr.{OFFICE_ROYALE['id']}"}
        with patch("metadata.ingestion.source.dashboard.dashboard_service.delete_entity_from_source") as delete:
            assert list(source.mark_charts_as_deleted()) == []
        delete.assert_not_called()

    def test_a_failed_lookup_for_an_unreadable_dossier_keeps_its_dashboard(self, client):
        source = _source(client)
        source.dashboard_source_state = set()
        source.metadata.get_by_name.side_effect = APIError({"code": 503, "message": "unavailable"})

        assert list(source.yield_dashboard(_details(source, BROKEN))) == []
        assert source.dashboard_source_state == {f"mstr.{BROKEN['id']}"}

    def test_charts_of_a_new_dossier_name_no_dashboard(self, client):
        source = _source(client)

        charts = [either.right for either in source.yield_dashboard_chart(_details(source, OFFICE_ROYALE))]

        assert all(chart.dashboards is None for chart in charts)

    def test_dashboard_carries_description_and_owner(self, client):
        source = _source(client)
        owners = EntityReferenceList(root=[])
        source.metadata.get_reference_by_email.return_value = owners

        dashboard = next(iter(source.yield_dashboard(_details(source, OFFICE_ROYALE)))).right

        assert dashboard.description.root == "Sales of the Office Royale chain"
        assert dashboard.owners is owners
        assert dashboard.project == TUTORIAL["name"]
        assert dashboard.sourceUrl.root == (
            f"https://mstr.example.com/MicroStrategyLibrary/app/{TUTORIAL['id']}/{OFFICE_ROYALE['id']}"
        )
        source.metadata.get_reference_by_email.assert_called_once_with("owner@example.com")

    def test_dashboard_url_uses_the_library_path(self, server):
        server.api = "/MicroStrategyLibrary2/api"
        source = _source(MicroStrategyClient(_connection(libraryPath="MicroStrategyLibrary2")))

        dashboard = next(iter(source.yield_dashboard(_details(source, OFFICE_ROYALE)))).right

        assert dashboard.sourceUrl.root.startswith("https://mstr.example.com/MicroStrategyLibrary2/app/")

    def test_a_dossier_whose_definition_fails_is_still_ingested(self, server, client):
        source = _source(client)
        server.dossiers[TUTORIAL["id"]] = [BROKEN]

        details = _details(source, BROKEN)
        dashboards = [either.right for either in source.yield_dashboard(details)]

        assert source.definition_failed
        assert [d.name.root for d in dashboards] == [BROKEN["id"]]
        assert dashboards[0].charts == []
        assert list(source.yield_dashboard_chart(details)) == []
        assert list(source.yield_datamodel(details)) == []
        with patch("metadata.ingestion.source.dashboard.dashboard_service.delete_entity_from_source") as delete:
            assert list(source.mark_datamodels_as_deleted()) == []
        delete.assert_not_called()

    def test_an_existing_dashboard_keeps_its_charts_when_its_definition_fails(self, client):
        source = _source(client)
        source.dashboard_source_state = set()
        source.chart_source_state = set()
        linked = SimpleNamespace(fullyQualifiedName=f"mstr.{BROKEN['id']}_K1_W1")
        source.metadata.get_by_name.return_value = SimpleNamespace(charts=SimpleNamespace(root=[linked]))

        (dashboard,) = [either.right for either in source.yield_dashboard(_details(source, BROKEN))]

        assert [chart.root for chart in dashboard.charts] == [linked.fullyQualifiedName]
        assert dashboard.owners is not None
        assert source.dashboard_source_state == {f"mstr.{BROKEN['id']}"}
        assert linked.fullyQualifiedName in source.chart_source_state

    def test_datamodel_columns(self, client):
        source = _source(client)

        datamodel = next(iter(source.yield_datamodel(_details(source, OFFICE_ROYALE)))).right

        store, revenue = datamodel.columns
        assert [(c.name.root, c.dataType, c.dataTypeDisplay) for c in store.children] == [
            ("ID", DataType.INT, "integer"),
            ("Name", DataType.VARCHAR, "nVarChar"),
            ("Rating", DataType.FLOAT, "real"),
            ("Image", DataType.UNKNOWN, None),
        ]
        assert (revenue.name.root, revenue.dataTypeDisplay, revenue.children) == ("Revenue", "Metric", None)
        assert datamodel.project == TUTORIAL["name"]

    def test_repeated_columns_get_unique_names(self, server, client):
        long_name = "M" * 256
        objects = [
            METRIC_REVENUE,
            METRIC_REVENUE,
            {**METRIC_REVENUE, "id": "4C05177011D3E877C000B3B2D86C964F"},
            {"id": "A1", "name": long_name, "type": "metric"},
            {"id": "A2", "name": long_name, "type": "metric"},
        ]
        definition = DEFINITIONS[OFFICE_ROYALE["id"]]
        server.definitions[OFFICE_ROYALE["id"]] = {
            **definition,
            "datasets": [{**definition["datasets"][0], "availableObjects": objects}],
        }
        source = _source(client)

        datamodel = next(iter(source.yield_datamodel(_details(source, OFFICE_ROYALE)))).right

        names = [column.name.root for column in datamodel.columns]
        # Suffixes follow the object ids, not the listing order: 4C05… sorts before 89C1….
        assert names == ["Revenue (2)", "Revenue", long_name, "M" * 252 + " (2)"]
        assert [column.displayName for column in datamodel.columns] == ["Revenue", "Revenue", long_name, long_name]

    def test_a_column_keeps_its_name_when_the_objects_are_listed_in_another_order(self, server, client):
        attribute = {"id": "4C05177011D3E877C000B3B2D86C964F", "name": "Revenue", "type": "attribute", "forms": []}
        definition = DEFINITIONS[OFFICE_ROYALE["id"]]
        names_by_id = []
        for objects in ([METRIC_REVENUE, attribute], [attribute, METRIC_REVENUE]):
            server.definitions[OFFICE_ROYALE["id"]] = {
                **definition,
                "datasets": [{**definition["datasets"][0], "availableObjects": objects}],
            }
            source = _source(client)
            datamodel = next(iter(source.yield_datamodel(_details(source, OFFICE_ROYALE)))).right
            names_by_id.append(
                {obj["id"]: column.name.root for obj, column in zip(objects, datamodel.columns, strict=True)}
            )

        assert names_by_id[0] == names_by_id[1] == {attribute["id"]: "Revenue", METRIC_REVENUE["id"]: "Revenue (2)"}

    def test_cube_sql_is_parsed_once_for_every_prefix_and_dossier(self, client):
        source = _source(client)
        source.parse_db_service_prefix = lambda prefix: (prefix, None, None, None)
        source.get_query_parser_type = MagicMock(return_value=None)
        service = SimpleNamespace(serviceType=SimpleNamespace(value="Mysql"))
        source.metadata.get_by_name.side_effect = lambda entity, fqn, **_: service if "." not in fqn else None
        details = _details(source, OFFICE_ROYALE)

        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.LineageParser", wraps=LineageParser
        ) as parser:
            for prefix in ("mysql_dev", "mysql_pro", "mysql_dev"):
                list(source.yield_dashboard_lineage_details(details, prefix))

        assert parser.call_count == 1

    def test_a_table_of_another_database_is_not_searched_in_the_prefix(self, client):
        source = _source(client)
        source.get_query_parser_type = MagicMock(return_value=None)
        searched = []

        def tables_for(table_name: str, **_: Any) -> list:
            searched.append(table_name)
            return []

        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.get_table_entities_from_query",
            side_effect=tables_for,
        ):
            tables = ("project-a.sales.orders", "project-b.sales.stores", "sales.items")
            list(source._source_table_entities(tables, "bq_pro", "project-a", None, None))

        assert searched == ["project-a.sales.orders", "sales.items"]

    def test_a_bigquery_table_is_searched_only_under_the_prefix_naming_its_project(self, server, client):
        server.overrides[f"/v2/cubes/{OFFICE_ROYALE_CUBE}/sqlView"] = lambda: (
            200,
            {
                "sqlStatement": "select a11.ORDER_ID ORDER_ID, sum(a11.AMOUNT) WJXBFS1\n"
                "from `project-x-pro`.`sales`.`orders` a11\n"
                "join `project-y-pro.sales.stores` a12 on (a11.STORE_ID = a12.STORE_ID)\n"
                "group by a11.ORDER_ID"
            },
        )
        source = _source(client)
        source.get_query_parser_type = MagicMock(return_value=None)
        service = SimpleNamespace(serviceType=SimpleNamespace(value="BigQuery"))
        source.metadata.get_by_name.side_effect = lambda entity, fqn, **_: (
            service if "." not in fqn else SimpleNamespace(id=SimpleNamespace(root=USER_ID))
        )
        details = _details(source, OFFICE_ROYALE)
        searched = []

        def tables_for(service_names: str, table_name: str, **_: Any) -> list:
            searched.append((service_names, table_name))
            return []

        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.get_table_entities_from_query",
            side_effect=tables_for,
        ):
            for prefix in ("bq_x.project-x-pro", "bq_y.project-y-pro"):
                list(source.yield_dashboard_lineage_details(details, prefix))

        assert searched == [("bq_x", "project-x-pro.sales.orders"), ("bq_y", "project-y-pro.sales.stores")]

    def test_a_bare_service_prefix_is_searched_only_for_the_projects_it_holds(self, client):
        source = _source(client)
        projects = {"bq_x": ["Project-X-Pro"], "bq_y": ["project-y-pro", "project-y-dev"]}
        source.metadata.list_all_entities.side_effect = lambda entity, params: [
            SimpleNamespace(name=SimpleNamespace(root=name)) for name in projects[params["service"]]
        ]
        searched = []

        def tables_for(service_names: str, table_name: str, **_: Any) -> list:
            searched.append((service_names, table_name))
            return []

        tables = ("project-x-pro.sales.orders", "project-y-pro.sales.stores", "sales.items")
        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.get_table_entities_from_query",
            side_effect=tables_for,
        ):
            for service in ("bq_x", "bq_y", "bq_x"):
                list(source._source_table_entities(tables, service, None, None, None))

        assert searched == [
            ("bq_x", "project-x-pro.sales.orders"),
            ("bq_x", "sales.items"),
            ("bq_y", "project-y-pro.sales.stores"),
            ("bq_y", "sales.items"),
            ("bq_x", "project-x-pro.sales.orders"),
            ("bq_x", "sales.items"),
        ]
        assert source.metadata.list_all_entities.call_count == 2

    def test_a_service_whose_databases_cannot_be_listed_is_searched_for_every_table(self, client):
        source = _source(client)
        source.metadata.list_all_entities.side_effect = APIError({"message": "timeout"})

        assert source._may_hold("project-x-pro.sales.orders", "bq_x", None)
        assert source._service_databases == {}

    def test_a_failed_service_lookup_is_tried_again(self, client):
        source = _source(client)
        service = SimpleNamespace(serviceType=SimpleNamespace(value="BigQuery"))
        source.metadata.get_by_name.side_effect = [APIError({"message": "timeout"}), service]

        assert source._dialect_of("bq_pro") is None
        assert source._dialect_of("bq_pro") is not None
        assert source._dialect_of("bq_pro") is not None
        assert source.metadata.get_by_name.call_count == 2

    def test_lineage_from_the_cube_sql(self, client):
        source = _source(client)
        source.parse_db_service_prefix = lambda prefix: ("mysql_tutorial", None, None, None)
        source.get_query_parser_type = MagicMock(return_value=None)
        datamodel = SimpleNamespace(id=SimpleNamespace(root="3f2a8a31-1c55-4f0e-9a1c-5f6e8f1f9a01"))
        service = SimpleNamespace(serviceType=SimpleNamespace(value="Mysql"))
        source.metadata.get_by_name.side_effect = lambda entity, fqn, **_: service if "." not in fqn else datamodel

        def table(name: str) -> SimpleNamespace:
            return SimpleNamespace(
                id=SimpleNamespace(root="7c1e0e6a-5d3f-4c1b-8d7a-2b9e4f6a1c0" + str(len(name) % 10)),
                name=SimpleNamespace(root=name),
                databaseSchema=SimpleNamespace(name="tutorial_wh"),
                database=SimpleNamespace(name="default"),
            )

        searched = []

        def tables_for(table_name: str, **_: Any) -> list:
            searched.append(table_name)
            return [table(table_name.rsplit(".", maxsplit=1)[-1])]

        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.get_table_entities_from_query",
            side_effect=tables_for,
        ):
            edges = list(source.yield_dashboard_lineage_details(_details(source, OFFICE_ROYALE), "mysql_tutorial"))
            assert list(source.yield_dashboard_lineage_details(_details(source, OFFICE_ROYALE), None)) == []

        assert sorted(searched) == ["<default>.order_detail", "tutorial_wh.lu_category", "tutorial_wh.lu_item"]
        assert len(edges) == 3
        assert all(edge.right.edge.toEntity.type == "dashboardDataModel" for edge in edges)


# The SQL views of a schema-based Intelligent Cube and of a Data Import cube, as a MicroStrategy
# server answers them for BigQuery (project renamed).
SCHEMA_CUBE_SQL = """select\t`a11`.`order_id`  `order_id`,
\t`a11`.`product_id`  `product_id`,
\tmax(`a13`.`product_name`)  `product_name`,
\t`a12`.`status`  `status`,
\tsum(`a11`.`quantity`)  `WJXBFS1`
from\t`project-x`.`sales`.`order_items`\t`a11`
\tjoin\t`project-x`.`sales`.`orders`\t`a12`
\t  on \t(`a11`.`order_id` = `a12`.`order_id`)
\tjoin\t`project-x`.`sales`.`products`\t`a13`
\t  on \t(`a11`.`product_id` = `a13`.`product_id`)
group by\t1,
\t2,
\t4"""
DATA_IMPORT_SQL = """
select\t`orders`.`order_id` `order_id`,
\t`orders`.`status` `status`
from\t`project-x`.`sales`.`orders`\t `orders`


select\t`order_items`.`order_item_id` `order_item_id`,
\t`order_items`.`order_id` `order_id`,
\t`order_items`.`unit_price` `unit_price`
from\t`project-x`.`sales`.`order_items`\t `order_items`
"""
SCHEMA_CUBE = "E4793A9AC5455CFBE8106FA2B22D7AF6"
IMPORT_CUBE = "F87325B1B54ECAF0E42113AD060B2300"
ID_FORM = {"id": "45C11FA478E745FEA08D781CEA190FE5", "name": "ID"}
NAME_FORM = {"id": "CCFBE2A5EADB4F50941FB879CCF1721C", "name": "Name"}
LOGICAL_TABLES = {"T_OI": "order_items", "T_O": "orders", "T_P": "products"}
MODEL_ATTRIBUTES = {
    "A_ORDER": [(ID_FORM, "order_id", ["T_OI", "T_O"])],
    "A_PRODUCT": [(ID_FORM, "product_id", ["T_OI", "T_P"]), (NAME_FORM, "product_name", ["T_P"])],
    "A_STATUS": [(ID_FORM, "status", ["T_O"])],
}


def _model_routes(server: FakeMicroStrategy, cube_subtypes: dict[str, int]) -> None:
    for cube, subtype in cube_subtypes.items():
        server.overrides[f"/objects/{cube}"] = lambda subtype=subtype: (200, {"type": 3, "subtype": subtype})
    for attribute, forms in MODEL_ATTRIBUTES.items():
        body = {
            "forms": [
                {
                    **form,
                    "expressions": [
                        {
                            "expression": {"tree": {"type": "column_reference", "columnName": column}},
                            "tables": [{"objectId": table, "subType": "logical_table"} for table in tables],
                        }
                    ],
                }
                for form, column, tables in forms
            ]
        }
        server.overrides[f"/model/attributes/{attribute}"] = lambda body=body: (200, body)
    for table_id, name in LOGICAL_TABLES.items():
        server.overrides[f"/model/tables/{table_id}"] = lambda name=name: (
            200,
            {"physicalTable": {"namespace": "project-x.sales", "tableName": name}},
        )


def _dataset(cube_id: str, objects: list[dict]) -> MstrDataset:
    return MstrDataset.model_validate({"id": cube_id, "name": "cube", "availableObjects": objects})


def _table(name: str, columns: list[str]) -> SimpleNamespace:
    fqn = f"bq.project-x.sales.{name}"
    return SimpleNamespace(
        id=SimpleNamespace(root="5a1f0e6a-5d3f-4c1b-8d7a-2b9e4f6a1c01"),
        name=SimpleNamespace(root=name),
        fullyQualifiedName=SimpleNamespace(root=fqn),
        databaseSchema=SimpleNamespace(name="sales"),
        database=SimpleNamespace(name="project-x"),
        columns=[
            SimpleNamespace(name=SimpleNamespace(root=c), fullyQualifiedName=SimpleNamespace(root=f"{fqn}.{c}"))
            for c in columns
        ],
    )


def _data_model(source: MicrostrategySource, dataset: MstrDataset) -> SimpleNamespace:
    """The data model the source builds for the dataset, with FQNs as the server assigns them"""
    model_fqn = f"mstr.model.{dataset.id}"

    def column(built: Any) -> SimpleNamespace:
        fqn = f"{model_fqn}.{built.name.root}"
        children = [
            SimpleNamespace(
                name=child.name, fullyQualifiedName=SimpleNamespace(root=f"{fqn}.{child.name.root}"), children=None
            )
            for child in built.children or []
        ]
        return SimpleNamespace(name=built.name, fullyQualifiedName=SimpleNamespace(root=fqn), children=children)

    return SimpleNamespace(
        id=SimpleNamespace(root="3f2a8a31-1c55-4f0e-9a1c-5f6e8f1f9a01"),
        columns=[column(built) for built in source._get_column_info(dataset)],
    )


def _pairs(lineage: list) -> list[tuple[list[str], str]]:
    return sorted(
        ([c.root.rsplit(".", 1)[-1] for c in pair.fromColumns], pair.toColumn.root.split(".model.", 1)[1])
        for pair in lineage
    )


class TestColumnLineage:
    def test_projections_are_matched_on_the_columns_they_read_not_their_aliases(self):
        # CATEGORY0 and WJXBFS1 are aliases MicroStrategy generates.
        reads = read_columns(CUBE_STATEMENT, Dialect.MYSQL)

        assert ("tutorial_wh.lu_category", "category_desc") in reads
        assert ("order_detail", "qty_sold") in reads
        assert not any(column in {"category0", "wjxbfs1"} for _, column in reads)

    def test_every_pass_of_a_multi_pass_sql_is_read(self):
        reads = read_columns(DATA_IMPORT_SQL, Dialect.BIGQUERY)

        assert {table for table, _ in reads} == {"project-x.sales.orders", "project-x.sales.order_items"}
        assert ("project-x.sales.order_items", "unit_price") in reads

    def test_a_note_or_an_unparsable_pass_is_skipped_and_the_other_passes_are_read(self):
        sql = "[We could not obtain the source]\n\nselect a.x x from `p`.`d`.`t` a\n\nselect from ((\n"

        assert read_columns(sql, Dialect.BIGQUERY) == {("p.d.t", "x")}

    def test_a_schema_attribute_form_maps_to_the_column_the_cube_reads(self, server, client):
        _model_routes(server, {SCHEMA_CUBE: 776})
        source = _source(client)
        dataset = _dataset(
            SCHEMA_CUBE,
            [
                {"id": "A_ORDER", "name": "Order", "type": "attribute", "forms": [ID_FORM]},
                {"id": "A_PRODUCT", "name": "Product", "type": "attribute", "forms": [NAME_FORM]},
                {"id": "M_QTY", "name": "Total Quantity", "type": "metric"},
            ],
        )
        reads = read_columns(SCHEMA_CUBE_SQL, Dialect.BIGQUERY)
        model = _data_model(source, dataset)

        order_items = source._column_lineage(
            "P", dataset, reads, _table("order_items", ["order_id", "product_id", "quantity"]), model
        )
        products = source._column_lineage(
            "P", dataset, reads, _table("products", ["product_id", "product_name"]), model
        )

        # product_id is read from order_items, but the dataset holds only Product's Name form;
        # the metric reads quantity, but nothing tells which fact column it aggregates.
        assert _pairs(order_items) == [(["order_id"], f"{SCHEMA_CUBE}.Order.ID")]
        assert _pairs(products) == [(["product_name"], f"{SCHEMA_CUBE}.Product.Name")]

    def test_a_data_import_cube_is_matched_on_the_names_it_derives_from_columns(self, server, client):
        _model_routes(server, {IMPORT_CUBE: 779})
        source = _source(client)
        dataset = _dataset(
            IMPORT_CUBE,
            [
                {"id": "A1", "name": "Order Id", "type": "attribute", "forms": [ID_FORM]},
                {"id": "M1", "name": "Unit Price", "type": "metric"},
                {"id": "M2", "name": "Row Count - order_items", "type": "metric"},
            ],
        )
        reads = read_columns(DATA_IMPORT_SQL, Dialect.BIGQUERY)

        lineage = source._column_lineage(
            "P",
            dataset,
            reads,
            _table("order_items", ["order_item_id", "order_id", "unit_price"]),
            _data_model(source, dataset),
        )

        assert _pairs(lineage) == [
            (["order_id"], f"{IMPORT_CUBE}.Order Id"),
            (["unit_price"], f"{IMPORT_CUBE}.Unit Price"),
        ]
        assert server.requests_to("/model/") == []

    def test_without_modeling_privileges_a_schema_cube_keeps_table_lineage_and_warns_once(self, server, client, caplog):
        server.overrides[f"/objects/{SCHEMA_CUBE}"] = lambda: (200, {"type": 3, "subtype": 776})
        for attribute in MODEL_ATTRIBUTES:
            server.overrides[f"/model/attributes/{attribute}"] = lambda: (
                403,
                {"code": "ERR014", "message": "You do not have Use Architect Editors privilege"},
            )
        source = _source(client)
        dataset = _dataset(
            SCHEMA_CUBE,
            [
                {"id": "A_ORDER", "name": "Order", "type": "attribute", "forms": [ID_FORM]},
                {"id": "A_STATUS", "name": "Status", "type": "attribute", "forms": [ID_FORM]},
            ],
        )
        reads = read_columns(SCHEMA_CUBE_SQL, Dialect.BIGQUERY)
        model = _data_model(source, dataset)

        for name in ("order_items", "orders"):
            assert source._column_lineage("P", dataset, reads, _table(name, ["order_id", "status"]), model) == []

        assert caplog.text.count("column-level lineage needs the service account") == 1
        assert len(server.requests_to("/model/attributes/")) == 1

    def test_a_column_lineage_failure_keeps_the_table_lineage(self, client):
        source = _source(client)
        source.parse_db_service_prefix = lambda prefix: ("bq", None, None, None)
        source.get_query_parser_type = MagicMock(return_value=None)
        service = SimpleNamespace(serviceType=SimpleNamespace(value="Mysql"))
        datamodel = SimpleNamespace(id=SimpleNamespace(root=USER_ID), columns=[])
        source.metadata.get_by_name.side_effect = lambda entity, fqn, **_: service if "." not in fqn else datamodel
        source._column_lineage = MagicMock(side_effect=RuntimeError("boom"))

        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.get_table_entities_from_query",
            side_effect=lambda table_name, **_: [_table(table_name.rsplit(".", 1)[-1], [])],
        ):
            edges = list(source.yield_dashboard_lineage_details(_details(source, OFFICE_ROYALE), "bq"))

        assert len(edges) == 3
        assert all(edge.right and edge.right.edge.lineageDetails.columnsLineage is None for edge in edges)

    def test_a_table_of_another_schema_or_project_is_never_linked(self):
        assert table_matches("db1.public.orders", "orders", "public", "db1")
        assert not table_matches("db2.public.orders", "orders", "public", "db1")
        assert not table_matches("crm.customers", "customers", "sales", "project-x")
        assert table_matches("orders", "orders", "public", "db1")

    def test_a_form_on_a_same_named_table_of_another_namespace_is_not_linked(self, server, client):
        # Lead reads crm.customers.id and Customer reads sales.customers.id; the SQL reads only the latter.
        _model_routes(server, {SCHEMA_CUBE: 776})
        server.overrides["/model/tables/T_CRM"] = lambda: (
            200,
            {"physicalTable": {"namespace": "project-x.crm", "tableName": "customers"}},
        )
        server.overrides["/model/tables/T_SALES"] = lambda: (
            200,
            {"physicalTable": {"namespace": "project-x.sales", "tableName": "customers"}},
        )
        same_named = {"A_LEAD": ("T_CRM",), "A_CUSTOMER": ("T_SALES",)}
        for attribute, (table,) in same_named.items():
            body = {
                "forms": [
                    {
                        **ID_FORM,
                        "expressions": [
                            {
                                "expression": {"tree": {"type": "column_reference", "columnName": "id"}},
                                "tables": [{"objectId": table}],
                            }
                        ],
                    }
                ]
            }
            server.overrides[f"/model/attributes/{attribute}"] = lambda body=body: (200, body)
        source = _source(client)
        dataset = _dataset(
            SCHEMA_CUBE,
            [
                {"id": "A_LEAD", "name": "Lead", "type": "attribute", "forms": [ID_FORM]},
                {"id": "A_CUSTOMER", "name": "Customer", "type": "attribute", "forms": [ID_FORM]},
            ],
        )
        reads = read_columns("select a11.id id from `project-x`.`sales`.`customers` a11", Dialect.BIGQUERY)

        lineage = source._column_lineage("P", dataset, reads, _table("customers", ["id"]), _data_model(source, dataset))

        assert _pairs(lineage) == [(["id"], f"{SCHEMA_CUBE}.Customer.ID")]

    def test_the_table_prefix_names_the_physical_table_as_the_sql_does(self, server, client):
        server.overrides["/model/tables/T_LU"] = lambda: (
            200,
            {"physicalTable": {"namespace": "tutorial", "tablePrefix": "tutorial_wh.", "tableName": "lu_category"}},
        )

        assert client.get_physical_table("P", "T_LU") == "tutorial_wh.lu_category"

    def test_another_modeling_failure_is_not_read_as_a_missing_privilege(self, server, client):
        server.overrides["/model/attributes/A1"] = lambda: (500, {"code": "ERR001", "message": "Internal error"})

        assert client.get_attribute_form_columns("P", "A1") is None
        assert not client.modeling_denied

    def test_the_lineage_edge_carries_the_column_pairs(self, server, client):
        _model_routes(server, {IMPORT_CUBE: 779})
        server.overrides[f"/v2/cubes/{IMPORT_CUBE}/sqlView"] = lambda: (200, {"sqlStatement": DATA_IMPORT_SQL})
        source = _source(client)
        source.parse_db_service_prefix = lambda prefix: ("bq", None, None, None)
        source.get_query_parser_type = MagicMock(return_value=None)
        dataset = _dataset(IMPORT_CUBE, [{"id": "A1", "name": "Order Id", "type": "attribute", "forms": [ID_FORM]}])
        details = _details(source, OFFICE_ROYALE).model_copy(update={"datasets": [dataset]})
        service = SimpleNamespace(serviceType=SimpleNamespace(value="BigQuery"))
        model = _data_model(source, dataset)
        model.id = SimpleNamespace(root=USER_ID)
        # The lineage search returns tables without columns; the source reads them once.
        bare = _table("order_items", [])
        bare.columns = None
        full = _table("order_items", ["order_item_id", "order_id", "unit_price"])

        def get_by_name(entity, fqn, **_):
            return {"bq": service, f"mstr.model.{IMPORT_CUBE}": model, full.fullyQualifiedName.root: full}.get(fqn)

        source.metadata.get_by_name.side_effect = get_by_name
        source.metadata.list_all_entities.return_value = [SimpleNamespace(name=SimpleNamespace(root="project-x"))]
        with patch(
            "metadata.ingestion.source.dashboard.microstrategy.metadata.get_table_entities_from_query",
            side_effect=lambda table_name, **_: [bare] if table_name.endswith("order_items") else [],
        ):
            results = list(source.yield_dashboard_lineage_details(details, "bq"))

        assert [either.left for either in results if either.left] == []
        (edge,) = [either.right for either in results]
        assert _pairs(edge.edge.lineageDetails.columnsLineage) == [(["order_id"], f"{IMPORT_CUBE}.Order Id")]
