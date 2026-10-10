"""Runs the seeder against an in-memory fake of the REST API: payloads, resume and failures."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import seed_lineage_graph as seed  # noqa: E402
from catalog import AssetRef, Catalog  # noqa: E402
from client import ApiError, Credentials, OpenMetadataClient, encode_fqn  # noqa: E402
from payloads import Payloads  # noqa: E402

ASSETS = 1000


class FakeServer:
    """Records every call; bulk endpoints succeed unless the path is listed in `failing`."""

    def __init__(self, failing: set[str] | None = None) -> None:
        self.calls: list[tuple[str, str, Any]] = []
        self.failing = failing or set()
        self.ui_root = "http://fake:8585"
        self.pipelines: dict[str, str] = {}

    def ensure_authenticated(self) -> None:
        pass

    def get(self, path: str, query: dict[str, Any] | None = None) -> Any:
        self.calls.append(("GET", path, query))
        if path == "/v1/system/version":
            return {"version": "test"}
        if path == "/v1/pipelines":
            prefix = f"{query['service']}."
            data = [
                {"fullyQualifiedName": fqn, "id": pid}
                for fqn, pid in self.pipelines.items()
                if fqn.startswith(prefix)
            ]
            return {"data": data, "paging": {}}
        return {}

    def put(self, path: str, body: Any, query: dict[str, Any] | None = None) -> Any:
        self.calls.append(("PUT", path, body))
        if path in self.failing:
            raise ApiError("PUT", path, 400, "rejected")
        if path == "/v1/pipelines/bulk":
            for pipeline in body:
                self.pipelines[f"{pipeline['service']}.{pipeline['name']}"] = str(uuid.uuid4())
        if path.endswith("/bulk"):
            return {"numberOfRowsFailed": 0}
        return {"id": str(uuid.uuid4())}

    def request(self, method: str, path: str, body: Any = None, query: Any = None) -> Any:
        self.calls.append((method, path, body))
        return {}

    def paths(self, method: str = "PUT") -> list[str]:
        return [path for verb, path, _ in self.calls if verb == method]


def run_seed(tmp_path: Path, server: FakeServer, *extra: str) -> seed.State:
    args = seed.parse_args(
        ["seed", "--assets", str(ASSETS), "--state-dir", str(tmp_path), "--no-viewer", *extra]
    )
    catalog = Catalog(args.assets, args.prefix, args.seed)
    identity = {"assets": args.assets, "prefix": args.prefix, "seed": args.seed, "server": server.ui_root}
    state = seed.State(tmp_path / "state.json", identity, args.fresh)
    seed.Seeder(server, catalog, args, state).run()
    return state


def test_a_full_seed_writes_every_kind_of_entity_and_lineage(tmp_path):
    server = FakeServer()

    run_seed(tmp_path, server)

    paths = set(server.paths())
    for expected in (
        "/v1/teams",
        "/v1/domains",
        "/v1/dataProducts",
        "/v1/databases/bulk",
        "/v1/databaseSchemas/bulk",
        "/v1/pipelines/bulk",
        "/v1/tables/bulk",
        "/v1/topics",
        "/v1/dashboard/datamodels/bulk",
        "/v1/dashboards/bulk",
    ):
        assert expected in paths
    assert any(path.startswith("/v1/lineage/table/name/") for path in paths)
    assert (tmp_path / "manifest.json").exists()


def test_a_second_run_resumes_instead_of_resending(tmp_path):
    run_seed(tmp_path, FakeServer())
    again = FakeServer()

    run_seed(tmp_path, again)

    assert not [path for path in again.paths() if path.endswith("/bulk") or path.startswith("/v1/lineage/")]


def test_fresh_ignores_saved_progress(tmp_path):
    run_seed(tmp_path, FakeServer())
    again = FakeServer()

    run_seed(tmp_path, again, "--fresh")

    assert "/v1/tables/bulk" in again.paths()


def test_a_failed_unit_stays_pending_and_is_retried_next_run(tmp_path):
    state = run_seed(tmp_path, FakeServer(failing={"/v1/dashboards/bulk"}))
    assert state.failures["dashboards"] > 0
    retry = FakeServer()

    run_seed(tmp_path, retry)

    assert "/v1/dashboards/bulk" in retry.paths()
    assert "/v1/tables/bulk" not in retry.paths()


def test_state_from_a_different_seed_is_refused(tmp_path):
    run_seed(tmp_path, FakeServer())

    with pytest.raises(SystemExit):
        run_seed(tmp_path, FakeServer(), "--seed", "1")


def test_fivetran_edges_reference_their_pipeline_by_id(tmp_path):
    server = FakeServer()
    run_seed(tmp_path, server)

    annotated = [
        body for verb, path, body in server.calls if path.startswith("/v1/lineage/") and "pipeline" in body
    ]

    assert annotated
    assert all(body["pipeline"]["type"] == "pipeline" and body["pipeline"]["id"] for body in annotated)


def test_interleaving_round_robins_slices_of_different_groups():
    spans = [("core", 0, 0, 1), ("core", 0, 1, 2), ("core", 1, 0, 1), ("mart", 0, 0, 1)]

    assert seed._interleaved(iter(spans)) == [
        ("core", 0, 0, 1),
        ("core", 1, 0, 1),
        ("mart", 0, 0, 1),
        ("core", 0, 1, 2),
    ]


def test_table_payload_carries_descriptions_tags_owners_and_domain():
    catalog = Catalog(ASSETS, "acme", 32050)
    payloads = Payloads(catalog, {domain.name: "team-id" for domain in catalog.domains})

    body = payloads.table(AssetRef("core", 0, 0))

    assert body["databaseSchema"].count(".") == 2
    assert body["description"]
    assert all(column["description"] for column in body["columns"])
    assert body["tags"] == [payloads_tag("Tier.Tier1")]
    assert body["owners"] == [{"id": "team-id", "type": "team"}]
    assert body["domains"] == ["acme_sales"]


def payloads_tag(fqn: str) -> dict[str, str]:
    return {"tagFQN": fqn, "source": "Classification", "labelType": "Manual", "state": "Confirmed"}


def test_plan_counts_without_a_server():
    summary = seed.plan(Catalog(ASSETS, "acme", 32050), sample_every=1)

    assert summary["assets"] == pytest.approx(ASSETS, rel=0.05)
    assert summary["edgesEstimate"] > summary["assets"]


@pytest.mark.parametrize(
    ("server", "api_root", "ui_root"),
    [
        ("http://localhost:8585", "/api", "http://localhost:8585"),
        ("http://localhost:8585/api/", "/api", "http://localhost:8585"),
        ("https://om.example.com/openmetadata", "/openmetadata/api", "https://om.example.com/openmetadata"),
    ],
)
def test_client_accepts_the_server_with_or_without_api(server, api_root, ui_root):
    client = OpenMetadataClient(server, Credentials(token="t"))

    assert (client.api_root, client.ui_root) == (api_root, ui_root)


def test_fqns_are_encoded_as_one_path_segment():
    assert encode_fqn('svc.db."my/schema".t') == "svc.db.%22my%2Fschema%22.t"
