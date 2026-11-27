"""Runs the seeder against an in-memory fake of the REST API: payloads, resume and failures."""

from __future__ import annotations

import json
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
    """Records every call. A bulk request fails outright when its path is in `failing`, and
    reports a failed row for each asset named in `rejected_names`; creating a user named in
    `existing_users` conflicts; a delete answers `delete_status` when one is set."""

    def __init__(
        self,
        failing: set[str] | None = None,
        rejected_names: set[str] | None = None,
        existing_users: set[str] | None = None,
        delete_status: int | None = None,
    ) -> None:
        self.calls: list[tuple[str, str, Any]] = []
        self.failing = failing or set()
        self.rejected_names = rejected_names or set()
        self.existing_users = existing_users or set()
        self.delete_status = delete_status
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
            rejected = [item for item in body if item.get("name") in self.rejected_names]
            return {
                "numberOfRowsFailed": len(rejected),
                "failedRequest": [{"message": "rejected"}] * len(rejected),
            }
        return {"id": str(uuid.uuid4())}

    def request(self, method: str, path: str, body: Any = None, query: Any = None) -> Any:
        self.calls.append((method, path, body))
        if method == "POST" and path == "/v1/users" and body["name"] in self.existing_users:
            raise ApiError(method, path, 409, "already exists")
        return {}

    def delete(self, path: str, query: dict[str, Any] | None = None) -> Any:
        self.calls.append(("DELETE", path, query))
        if self.delete_status is not None:
            raise ApiError("DELETE", path, self.delete_status, "refused")
        return {}

    def paths(self, method: str = "PUT") -> list[str]:
        return [path for verb, path, _ in self.calls if verb == method]


def run_seed(tmp_path: Path, server: FakeServer, *extra: str, viewer: bool = False) -> dict[str, int]:
    """Seeds and returns the units each phase still lacks."""
    viewer_args = [] if viewer else ["--no-viewer"]
    args = seed.parse_args(
        ["seed", "--assets", str(ASSETS), "--state-dir", str(tmp_path), *viewer_args, *extra]
    )
    catalog = Catalog(args.assets, args.prefix, args.seed)
    state = seed.State(tmp_path / seed.STATE_FILE, seed.identity_of(args, server), args.fresh)
    return seed.Seeder(server, catalog, args, state).run()


def run_main(monkeypatch: pytest.MonkeyPatch, server: FakeServer, *argv: str) -> int:
    monkeypatch.setattr(seed, "OpenMetadataClient", lambda *args, **kwargs: server)
    return seed.main(list(argv))


def run_cleanup(tmp_path: Path, server: FakeServer, *extra: str) -> int:
    args = seed.parse_args(
        ["cleanup", "--assets", str(ASSETS), "--state-dir", str(tmp_path), "--yes", *extra]
    )
    return seed.cleanup(server, Catalog(args.assets, args.prefix, args.seed), args)


def deleted_users(server: FakeServer) -> list[str]:
    return [path for verb, path, _ in server.calls if verb == "DELETE" and path.startswith("/v1/users/")]


def manifest_of(tmp_path: Path) -> dict[str, Any]:
    return json.loads((tmp_path / seed.MANIFEST_FILE).read_text())


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


def test_the_manifest_counts_the_edges_and_column_edges_it_wrote(tmp_path):
    server = FakeServer()

    run_seed(tmp_path, server)

    lineage = [body for verb, path, body in server.calls if verb == "PUT" and path.startswith("/v1/lineage/")]
    benchmark = json.loads((tmp_path / "manifest.json").read_text())["benchmark"]
    assert benchmark["edges"] == len(lineage)
    assert benchmark["columnEdges"] == sum(1 for body in lineage if body.get("columnsLineage"))
    assert 0 < benchmark["columnEdges"] < benchmark["edges"]


def test_the_benchmark_section_carries_exactly_what_seeded_lineage_graph_reads(tmp_path):
    """SeededLineageGraph.read fails on a missing key, so change both sides together."""
    run_seed(tmp_path, FakeServer())

    benchmark = json.loads((tmp_path / "manifest.json").read_text())["benchmark"]

    assert set(benchmark) == {
        "cohortFqnPrefix",
        "services",
        "databases",
        "schemas",
        "tables",
        "edges",
        "columnEdges",
        "focus",
    }
    assert set(benchmark["focus"]) == {
        "serviceFqn",
        "databaseFqn",
        "schemaFqn",
        "hubTableFqn",
        "leafTableFqn",
        "hubColumnFqn",
    }


def test_the_viewer_password_is_neither_printed_nor_written(tmp_path, capsys):
    run_seed(tmp_path, FakeServer(), viewer=True)

    manifest = (tmp_path / "manifest.json").read_text()
    assert json.loads(manifest)["viewer"]["email"] == "acme.lineage.viewer@open-metadata.org"
    assert seed.VIEWER_PASSWORD not in manifest
    assert seed.VIEWER_PASSWORD not in capsys.readouterr().out


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
    incomplete = run_seed(tmp_path, FakeServer(failing={"/v1/dashboards/bulk"}))
    assert incomplete["dashboards"] > 0
    retry = FakeServer()

    assert run_seed(tmp_path, retry) == {}

    assert "/v1/dashboards/bulk" in retry.paths()
    assert "/v1/tables/bulk" not in retry.paths()


def test_a_resume_with_a_larger_batch_size_still_retries_the_assets_that_failed(tmp_path):
    catalog = Catalog(ASSETS, "acme", 32050)
    payloads = Payloads(catalog, {domain.name: "team-id" for domain in catalog.domains})
    rejected = payloads.table(AssetRef("core", 0, 1))["name"]
    run_seed(tmp_path, FakeServer(rejected_names={rejected}), "--batch-size", "1")
    retry = FakeServer()

    run_seed(tmp_path, retry, "--batch-size", "100")

    sent = [item["name"] for verb, path, body in retry.calls if path == "/v1/tables/bulk" for item in body]
    assert rejected in sent


def test_an_incomplete_seed_exits_non_zero_without_a_benchmark_section(tmp_path, monkeypatch):
    argv = ("seed", "--assets", str(ASSETS), "--state-dir", str(tmp_path), "--no-viewer")

    assert run_main(monkeypatch, FakeServer(failing={"/v1/tables/bulk"}), *argv) == 1

    manifest = manifest_of(tmp_path)
    assert "benchmark" not in manifest
    assert manifest["incomplete"]["tables"] > 0


def test_a_retry_that_completes_the_seed_exits_zero_with_a_benchmark_section(tmp_path, monkeypatch):
    argv = ("seed", "--assets", str(ASSETS), "--state-dir", str(tmp_path), "--no-viewer")
    run_main(monkeypatch, FakeServer(failing={"/v1/tables/bulk"}), *argv)

    assert run_main(monkeypatch, FakeServer(), *argv) == 0

    manifest = manifest_of(tmp_path)
    assert manifest["benchmark"]["tables"] > 0
    assert manifest["incomplete"] == {}


def test_a_seed_that_skipped_a_phase_publishes_no_benchmark_section(tmp_path):
    assert run_seed(tmp_path, FakeServer(), "--skip", "lineage") == {}

    assert "benchmark" not in manifest_of(tmp_path)


def test_cleanup_deletes_the_viewer_this_seed_created(tmp_path):
    run_seed(tmp_path, FakeServer(), viewer=True)
    server = FakeServer()

    assert run_cleanup(tmp_path, server) == 0

    assert deleted_users(server) == ["/v1/users/name/acme_lineage_viewer"]


@pytest.mark.parametrize(
    ("viewer", "existing_users"),
    [(False, set()), (True, {"acme_lineage_viewer"})],
    ids=["seeded-without-a-viewer", "viewer-already-existed"],
)
def test_cleanup_keeps_a_viewer_this_seed_did_not_create(tmp_path, viewer, existing_users):
    run_seed(tmp_path, FakeServer(existing_users=existing_users), viewer=viewer)
    server = FakeServer()

    run_cleanup(tmp_path, server)

    assert deleted_users(server) == []


def test_a_fresh_seed_still_knows_it_created_the_viewer(tmp_path):
    run_seed(tmp_path, FakeServer(), viewer=True)
    run_seed(tmp_path, FakeServer(existing_users={"acme_lineage_viewer"}), "--fresh", viewer=True)
    server = FakeServer()

    run_cleanup(tmp_path, server)

    assert deleted_users(server) == ["/v1/users/name/acme_lineage_viewer"]


def test_each_prefix_cleans_up_only_its_own_viewer(tmp_path):
    for prefix in ("graph_a", "graph_b"):
        run_seed(tmp_path / prefix, FakeServer(), "--prefix", prefix, viewer=True)
    server = FakeServer()

    run_cleanup(tmp_path / "graph_b", server, "--prefix", "graph_b")

    assert deleted_users(server) == ["/v1/users/name/graph_b_lineage_viewer"]


def test_cleanup_forgets_the_progress_so_the_next_seed_sends_everything_again(tmp_path):
    run_seed(tmp_path, FakeServer())
    run_cleanup(tmp_path, FakeServer())
    again = FakeServer()

    run_seed(tmp_path, again)

    assert "/v1/tables/bulk" in again.paths()


def test_a_cleanup_with_failed_deletes_keeps_the_progress(tmp_path):
    run_seed(tmp_path, FakeServer())

    assert run_cleanup(tmp_path, FakeServer(delete_status=500)) > 0

    assert (tmp_path / seed.STATE_FILE).exists()


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
