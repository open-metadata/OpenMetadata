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
Issue #29832: limits on the column children inferred from sampled JSON values.
"""

from itertools import permutations

import pytest
from pydantic import ValidationError

from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.storageServiceMetadataPipeline import (
    StorageServiceMetadataPipeline,
)
from metadata.ingestion.api.status import Status
from metadata.utils.schema_inference import (
    InferenceLimit,
    InferenceLimits,
    InferenceReport,
    InferredStruct,
)

PIPELINES = [DatabaseServiceMetadataPipeline, StorageServiceMetadataPipeline]


class TestInferenceLimitsConfig:
    """Both metadata pipelines accept the same two fields with the same validation."""

    @pytest.mark.parametrize("pipeline", PIPELINES)
    def test_unset_fields_mean_no_limit(self, pipeline):
        assert InferenceLimits.from_source_config(pipeline()) == InferenceLimits(max_depth=None, max_children=None)

    @pytest.mark.parametrize("pipeline", PIPELINES)
    @pytest.mark.parametrize("depth, children", [(0, 0), (3, 25), (0, 50), (12, 0)])
    def test_zero_and_positive_values_are_read(self, pipeline, depth, children):
        config = pipeline(maxSchemaInferenceDepth=depth, maxChildrenPerColumn=children)
        assert InferenceLimits.from_source_config(config) == InferenceLimits(max_depth=depth, max_children=children)

    @pytest.mark.parametrize("pipeline", PIPELINES)
    @pytest.mark.parametrize("field", ["maxSchemaInferenceDepth", "maxChildrenPerColumn"])
    @pytest.mark.parametrize("value", [-1, 2.5, "many"])
    def test_invalid_values_are_rejected(self, pipeline, field, value):
        with pytest.raises(ValidationError):
            pipeline(**{field: value})

    def test_config_without_the_fields_means_no_limit(self):
        assert InferenceLimits.from_source_config(object()) == InferenceLimits()


class TestInferenceLimitsAdmit:
    """A node keeps the smallest key names, in the order they first arrived."""

    @pytest.mark.parametrize("arrival", list(permutations(["d", "a", "e", "b", "c"])))
    def test_kept_names_do_not_depend_on_arrival_order(self, arrival):
        node = InferredStruct()
        for key in arrival:
            if InferenceLimits(max_children=3).admit(node, key):
                node[key] = True

        assert set(node) == {"a", "b", "c"}
        assert list(node) == [key for key in arrival if key in {"a", "b", "c"}]
        assert node.cut_by == InferenceLimit.CHILDREN

    def test_node_within_the_limit_is_not_marked(self):
        node = InferredStruct()
        for key in ["b", "a", "b"]:
            if InferenceLimits(max_children=2).admit(node, key):
                node[key] = True

        assert list(node) == ["b", "a"]
        assert node.cut_by is None

    def test_zero_admits_nothing(self):
        node = InferredStruct()
        assert not InferenceLimits(max_children=0).admit(node, "a")
        assert node.cut_by == InferenceLimit.CHILDREN

    def test_no_limit_admits_everything(self):
        node = InferredStruct({f"k{n}": n for n in range(1000)})
        assert InferenceLimits().admit(node, "a")
        assert node.cut_by is None

    @pytest.mark.parametrize(
        "max_depth, depth, allowed",
        [(None, 50, True), (0, 0, False), (1, 0, True), (1, 1, False), (3, 2, True), (3, 3, False)],
    )
    def test_children_allowed_below_the_depth_limit(self, max_depth, depth, allowed):
        assert InferenceLimits(max_depth=max_depth).allows_children(depth) is allowed


class TestInferenceReport:
    """One warning per asset, naming the limit and a bounded list of column paths."""

    @staticmethod
    def _cut(limit: InferenceLimit) -> InferredStruct:
        node = InferredStruct()
        node.cut_by = limit
        return node

    def test_nothing_cut_means_no_warning(self):
        report = InferenceReport()
        report.record(InferredStruct({"a": 1}), "payload")
        assert report.warning(InferenceLimits(max_depth=2, max_children=2)) is None
        assert not report.is_cut("payload")

    def test_warning_names_each_limit_with_its_paths(self):
        report = InferenceReport()
        report.record(self._cut(InferenceLimit.CHILDREN), "payload")
        report.record(self._cut(InferenceLimit.DEPTH), "deep.l01.l02")
        report.record(self._cut(InferenceLimit.CHILDREN), "items")

        warning = report.warning(InferenceLimits(max_depth=2, max_children=25))

        assert warning == (
            "Schema inference limits dropped nested columns. "
            "maxSchemaInferenceDepth=2 cut the children of 1 column(s): deep.l01.l02. "
            "maxChildrenPerColumn=25 cut the children of 2 column(s): items, payload."
        )
        assert report.is_cut("payload")

    def test_warning_lists_at_most_ten_paths(self):
        report = InferenceReport()
        for idx in range(25):
            report.record(self._cut(InferenceLimit.CHILDREN), f"col{idx:02d}")
        report.record(self._cut(InferenceLimit.CHILDREN), "col00")

        warning = report.warning(InferenceLimits(max_children=1))

        listed = ", ".join(f"col{idx:02d}" for idx in range(10))
        assert warning.endswith(f"cut the children of 25 column(s): {listed} and 15 more.")

    def test_emit_adds_one_status_warning_per_asset(self):
        limits = InferenceLimits(max_children=1)
        status = Status()
        report = InferenceReport()
        report.record(self._cut(InferenceLimit.CHILDREN), "payload")

        report.emit(status, "bucket/events.json", limits)
        InferenceReport().emit(status, "bucket/other.json", limits)

        assert status.warnings == [{"bucket/events.json": report.warning(limits)}]
