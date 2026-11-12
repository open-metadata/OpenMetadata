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
from metadata.generated.schema.type.basic import Markdown, Uuid
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.delete import SourceListing
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.microstrategy.client import (
    MicroStrategyApiError,
    MicroStrategyClient,
    strip_engine_steps,
)
from metadata.ingestion.source.dashboard.microstrategy.metadata import MicrostrategySource
from metadata.ingestion.source.dashboard.microstrategy.models import MstrDashboard

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
                "id": "F6C63ED59D41BF792A2C72B65070FE58",
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
            f"{OFFICE_ROYALE['id']}_K53_W63",
            f"{OFFICE_ROYALE['id']}_K53_W64",
            f"{AIRLINE['id']}_K53_W63",
        ]

    def test_charts_name_their_existing_dashboard_and_inherit_legacy_metadata(self, client):
        # A chart update that leaves out its dashboards unlinks them, and the charts that
        # existed under the old `<pageKey><vizKey>` names hold metadata users added by hand.
        source = _source(client)
        legacy = SimpleNamespace(
            description=Markdown("Written by hand"),
            tags=[TagLabel(tagFQN="PII.Sensitive", source="Classification", labelType="Manual", state="Confirmed")],
            owners=EntityReferenceList(root=[EntityReference(id=Uuid(USER_ID), type="user")]),
            domains=EntityReferenceList(
                root=[EntityReference(id=Uuid(USER_ID), type="domain", fullyQualifiedName="Sales")]
            ),
            dataProducts=None,
            extension=None,
            lifeCycle=None,
        )
        existing = SimpleNamespace(
            fullyQualifiedName=SimpleNamespace(root=f"mstr.{OFFICE_ROYALE['id']}"),
            charts=SimpleNamespace(
                root=[SimpleNamespace(name="K53W63", id=USER_ID), SimpleNamespace(name="other_new_name", id=USER_ID)]
            ),
        )
        source.metadata.get_by_name.return_value = existing
        source.metadata.get_by_id.return_value = legacy

        w63, w64 = [either.right for either in source.yield_dashboard_chart(_details(source, OFFICE_ROYALE))]

        assert [d.root for d in w63.dashboards] == [f"mstr.{OFFICE_ROYALE['id']}"]
        assert w63.description.root == "Written by hand"
        assert [t.tagFQN.root for t in w63.tags] == ["PII.Sensitive"]
        assert w63.owners == legacy.owners
        assert [d.root for d in w63.domains] == ["Sales"]
        assert w64.description is None
        assert w64.tags is None

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

    def test_a_failed_legacy_chart_read_only_skips_its_metadata(self, client):
        source = _source(client)
        source.metadata.get_by_name.return_value = SimpleNamespace(
            fullyQualifiedName=SimpleNamespace(root=f"mstr.{OFFICE_ROYALE['id']}"),
            charts=SimpleNamespace(root=[SimpleNamespace(name="K53W63", id=USER_ID)]),
        )
        source.metadata.get_by_id.side_effect = APIError({"code": 500, "message": "boom"})

        charts = [either.right for either in source.yield_dashboard_chart(_details(source, OFFICE_ROYALE))]

        assert len(charts) == 2
        assert all(chart.description is None for chart in charts)
        assert not source.charts_unknown

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
        source.metadata.get_by_id.assert_not_called()

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

    def test_lineage_from_the_cube_sql(self, client):
        source = _source(client)
        source.parse_db_service_prefix = lambda prefix: ("mysql_tutorial", None, None, None)
        source.get_query_parser_type = MagicMock(return_value=None)
        datamodel = SimpleNamespace(id=SimpleNamespace(root="3f2a8a31-1c55-4f0e-9a1c-5f6e8f1f9a01"))
        service = SimpleNamespace(serviceType=SimpleNamespace(value="Mysql"))
        source.metadata.get_by_name.side_effect = lambda entity, fqn: service if "." not in fqn else datamodel

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
