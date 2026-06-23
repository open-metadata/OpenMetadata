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

from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressNode,
)
from metadata.utils.progress_registry import ProgressNodeSnapshot, ProgressRegistry
from metadata.workflow.progress_render import (
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
