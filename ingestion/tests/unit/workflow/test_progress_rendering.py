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
"""One snapshot -> CLI tree string + nested progressNode payload."""

from unittest.mock import patch

from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressNode,
    ProgressUpdate,
)
from metadata.utils.progress_registry import ProgressNodeSnapshot, ProgressRegistry
from metadata.workflow.progress_render import (
    ProgressReporter,
    format_eta,
    render_progress_tree,
    snapshot_to_progress_payload,
)


def _tree_snapshot():
    reg = ProgressRegistry()
    reg.open([], "Database", None)
    reg.open(["xyz"], "DatabaseSchema", 10)
    reg.open(["xyz", "abc"], "Table", 100)
    for _ in range(20):
        reg.advance(["xyz", "abc"])
    return reg.snapshot()


class TestProgressRendering:
    def test_cli_renders_database_line(self):
        out = render_progress_tree(_tree_snapshot())
        assert "Database" in out

    def test_cli_renders_active_table_line_with_denominator(self):
        out = render_progress_tree(_tree_snapshot())
        assert any("abc" in line and "20/100" in line for line in out.splitlines())

    def test_cli_handles_none(self):
        assert render_progress_tree(None) == ""

    def test_payload_is_nested_and_typed(self):
        payload = snapshot_to_progress_payload(_tree_snapshot())
        node = ProgressNode.model_validate(payload)  # round-trips through the generated model
        assert node.entityType == "Database"
        schema = node.children[0]
        assert schema.label == "xyz"
        assert schema.entityType == "DatabaseSchema"
        table = schema.children[0]
        assert table.label == "abc"
        assert table.expected == 100
        assert table.processed == 20

    def test_payload_is_none_without_progress(self):
        assert snapshot_to_progress_payload(None) is None


def test_label_only_grouping_node_renders_without_count():
    leaf = ProgressNodeSnapshot(
        label="",
        child_type="Table",
        expected=47,
        processed=12,
        active=True,
        overflow=0,
        children=(),
    )
    schema = ProgressNodeSnapshot(
        label="analytics.public",
        child_type=None,
        expected=None,
        processed=0,
        active=True,
        overflow=0,
        children=(leaf,),
    )
    rendered = render_progress_tree(schema)
    assert "analytics.public" in rendered
    assert "analytics.public 0" not in rendered  # no spurious count on the label node
    assert "Table 12/47" in rendered


def _snowflake_like_registry() -> ProgressRegistry:
    registry = ProgressRegistry()
    registry.open([], "Database", None)
    registry.open(["sales"], "DatabaseSchema", None)
    registry.open(["sales", "public"], "Table", 310)
    for _ in range(45):
        registry.advance(["sales", "public"], "Table")
    return registry


class TestProgressReporter:
    def test_cli_header_is_assets_ingested(self):
        registry = _snowflake_like_registry()
        text = ProgressReporter(registry).cli()
        assert text.splitlines()[0] == f"Ingested: {registry.assets_ingested():,} assets"

    def test_cli_still_shows_active_scope(self):
        text = ProgressReporter(_snowflake_like_registry()).cli()
        assert "sales.public" in text
        assert "45/310" in text

    def test_payload_root_carries_asset_total(self):
        registry = _snowflake_like_registry()
        payload = ProgressReporter(registry).payload()
        assert set(payload) == {
            "label",
            "entityType",
            "processed",
            "expected",
            "active",
            "overflow",
            "children",
        }
        assert payload["processed"] == registry.assets_ingested()
        assert payload["expected"] is None

    def test_payload_validates_against_progress_update_model(self):
        update = ProgressUpdate(
            runId="r",
            timestamp=1,
            updateType="PROCESSING",
            progress=ProgressReporter(_snowflake_like_registry()).payload(),
        )
        assert update.progress is not None
        assert update.progress.processed == 45

    def test_payload_is_none_before_anything_starts(self):
        assert ProgressReporter(ProgressRegistry()).payload() is None

    def test_progress_update_carries_global_counters(self):
        reg = ProgressRegistry()
        reg.set_total("Workspaces", 10)
        reg.track("Workspaces")
        reg.track("Workspaces")
        reg.track("Workspaces")
        counters = ProgressReporter(reg).global_counters()
        update = ProgressUpdate(
            runId="r1",
            timestamp=1,
            updateType="PROCESSING",
            globalCounters=[{"entityType": t, "done": d, "total": total} for t, d, total in counters],
        )
        assert update.globalCounters[0].entityType == "Workspaces"
        assert update.globalCounters[0].done == 3
        assert update.globalCounters[0].total == 10


class TestGroupHeader:
    def test_header_shows_counters_then_assets(self):
        reg = ProgressRegistry()
        reg.set_total("Database", 4)
        reg.seed_scope_total("DatabaseSchema", "db1", 45)
        reg.track("Database")
        reg.track("Database")
        for _ in range(12):
            reg.track("DatabaseSchema")
        reg.advance([], "Table")
        lines = ProgressReporter(reg).cli().splitlines()
        assert lines[0] == "Database 2/4"
        assert lines[1] == "DatabaseSchema 12/45"
        assert lines[2] == "Ingested: 1 assets"

    def test_header_unknown_total_renders_bare_count(self):
        reg = ProgressRegistry()
        reg.set_total("Workspaces", None)
        reg.track("Workspaces")
        assert ProgressReporter(reg).cli() == "Workspaces 1\nIngested: 0 assets"

    def test_header_renders_with_empty_tree_when_counter_active(self):
        reg = ProgressRegistry()
        reg.set_total("Workspaces", 4)
        for _ in range(4):
            reg.track("Workspaces")
        assert ProgressReporter(reg).cli() == "Workspaces 4/4\nIngested: 0 assets"

    def test_no_group_keeps_legacy_header(self):
        reg = ProgressRegistry()
        reg.open([], "Database", None)
        reg.open(["x"], "Table", 2)
        reg.advance(["x"], "Table")
        assert ProgressReporter(reg).cli().splitlines()[0] == "Ingested: 1 assets"

    def test_cli_empty_when_no_progress(self):
        reg = ProgressRegistry()
        assert ProgressReporter(reg).cli() == ""


class TestGlobalCountersOnSseUpdate:
    def test_reporter_global_counters_passthrough(self):
        reg = ProgressRegistry()
        reg.set_total("Workspaces", 10)
        reg.track("Workspaces")
        reg.track("Workspaces")
        reg.track("Workspaces")
        assert ProgressReporter(reg).global_counters() == [("Workspaces", 3, 10)]


class TestFormatEta:
    def test_sub_minute(self):
        assert format_eta(59) == "~59s"

    def test_minute_boundary(self):
        assert format_eta(60) == "~1m"

    def test_minutes(self):
        assert format_eta(360) == "~6m"

    def test_hour_boundary(self):
        assert format_eta(3600) == "~1h 0m"

    def test_hours_and_minutes(self):
        assert format_eta(4800) == "~1h 20m"


class TestEtaSeconds:
    def test_warmup_done_zero_is_none(self):
        reg = ProgressRegistry()
        reg.open([], "Database", None)
        reg.set_total("DatabaseSchema", 45)
        assert ProgressReporter(reg).eta_seconds() is None

    def test_no_counter_with_total_is_none(self):
        reg = ProgressRegistry()
        reg.open([], "Database", None)
        reg.set_total("Workspaces", None)
        reg.track("Workspaces")
        assert ProgressReporter(reg).eta_seconds() is None

    def test_complete_is_none(self):
        reg = ProgressRegistry()
        reg.open([], "Database", None)
        reg.set_total("DatabaseSchema", 4)
        for _ in range(4):
            reg.track("DatabaseSchema")
        assert ProgressReporter(reg).eta_seconds() is None

    def test_none_before_first_open(self):
        reg = ProgressRegistry()
        reg.set_total("DatabaseSchema", 45)
        reg.track("DatabaseSchema")
        assert ProgressReporter(reg).eta_seconds() is None

    def test_normal_case_uses_cumulative_rate(self):
        reg = ProgressRegistry()
        with patch("metadata.utils.progress_registry.time.monotonic") as clock:
            clock.return_value = 0.0
            reg.open([], "Database", None)
            reg.set_total("DatabaseSchema", 10)
            for _ in range(2):
                reg.track("DatabaseSchema")
            clock.return_value = 60.0
            assert ProgressReporter(reg).eta_seconds() == 240

    def test_driver_is_last_counter_with_total(self):
        reg = ProgressRegistry()
        with patch("metadata.utils.progress_registry.time.monotonic") as clock:
            clock.return_value = 0.0
            reg.open([], "Database", None)
            reg.set_total("Database", 4)
            reg.set_total("DatabaseSchema", 20)
            reg.track("Database")
            for _ in range(4):
                reg.track("DatabaseSchema")
            clock.return_value = 100.0
            assert ProgressReporter(reg).eta_seconds() == 400


class TestEtaInHeader:
    def test_eta_suffix_on_driver_line_only(self):
        reg = ProgressRegistry()
        with patch("metadata.utils.progress_registry.time.monotonic") as clock:
            clock.return_value = 0.0
            reg.open([], "Database", None)
            reg.set_total("Database", 4)
            reg.set_total("DatabaseSchema", 45)
            reg.track("Database")
            reg.track("Database")
            for _ in range(9):
                reg.track("DatabaseSchema")
            clock.return_value = 120.0
            lines = ProgressReporter(reg).cli().splitlines()
        assert lines[0] == "Database 2/4"
        assert lines[1].startswith("DatabaseSchema 9/45")
        assert "~8m" in lines[1]
        assert "~" not in lines[0]

    def test_no_eta_suffix_when_not_computable(self):
        reg = ProgressRegistry()
        reg.open([], "Database", None)
        reg.set_total("DatabaseSchema", 45)
        assert "~" not in ProgressReporter(reg).cli()
