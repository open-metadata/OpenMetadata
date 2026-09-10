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
"""Looker must not read back a data model it has only just yielded.

``CreateDashboardDataModelRequest`` records sit in ``MetadataRestSink``'s bulk buffer
until it reaches ``bulk_sink_batch_size``, so a ``get_by_name`` issued straight after
the yield returns ``None``. The source has to emit a ``Barrier`` first and resolve the
data models afterwards.

The fixtures below model that sink semantics directly: ``_build_data_model`` returns
``None`` until a ``Barrier`` has travelled down the stream.
"""

import sys
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from looker_sdk.sdk.api40.models import (
    LookmlModelExplore,
    LookmlModelExploreFieldset,
    LookmlModelExploreJoins,
)

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.source.dashboard.looker.metadata import (
    DATAMODEL_LINEAGE_SENTINEL,
    ExploreRef,
    LookerSource,
)
from metadata.ingestion.source.dashboard.looker.models import LookMlView

MOCK_LOOKER_CONFIG = {
    "source": {
        "type": "looker",
        "serviceName": "test_looker",
        "serviceConnection": {
            "config": {
                "type": "Looker",
                "clientId": "test",
                "clientSecret": "test",
                "hostPort": "https://my-looker.com",
            }
        },
        "sourceConfig": {"config": {"type": "DashboardMetadata"}},
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

EXPECTED_DATA_MODELS = [
    "my_model_joined_view_view",
    "my_model_my_explore",
    "my_model_my_view_view",
    "my_model_orphan_view_view",
]


def _data_model(name: str) -> DashboardDataModel:
    return DashboardDataModel(
        id=uuid.uuid4(),
        name=name,
        displayName=name,
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        dataModelType=DataModelType.LookMlView,
        columns=[],
    )


def _rights(records, of_type):
    return [either.right for either in records if either.right is not None and isinstance(either.right, of_type)]


def _first_index(records, of_type) -> int:
    for index, either in enumerate(records):
        if either.right is not None and isinstance(either.right, of_type):
            return index
    return -1


@pytest.fixture
def looker():
    with patch(
        "metadata.ingestion.source.dashboard.dashboard_service.DashboardServiceSource.test_connection",
        return_value=False,
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_LOOKER_CONFIG)
        source = LookerSource.create(
            MOCK_LOOKER_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
    source.context.get().__dict__["dashboard_service"] = "test_looker"
    return source


@pytest.fixture
def explore():
    return LookmlModelExplore(
        name="my_explore",
        model_name="my_model",
        project_name="my_project",
        view_name="my_view",
        joins=[LookmlModelExploreJoins(name="joined_view")],
        fields=LookmlModelExploreFieldset(dimensions=[], measures=[]),
    )


@pytest.fixture
def bulk_stage(looker, explore):
    """Run the bulk data-model stage the way the workflow does.

    Returns a callable giving back the emitted records in order plus, for every
    ``_build_data_model`` call, the stream index at which it happened.
    """
    views = {
        "my_view": LookMlView(name="my_view", sql_table_name="db.schema.my_table"),
        "joined_view": LookMlView(name="joined_view", sql_table_name="db.schema.joined_table"),
        # Referenced by no explore, so it goes down the standalone path. `extends` gives it
        # an edge that needs no dbServicePrefixes, and its parent is a view resolved by the
        # same flush — which only works because the barrier precedes resolution.
        "orphan_view": LookMlView(name="orphan_view", extends__all=[["my_view"]]),
    }

    def find_view(view_name):
        """`_process_view` calls this by keyword, so `views.get` cannot stand in."""
        return views.get(view_name)

    parser = MagicMock()
    parser._views_cache = views
    parser.parsed_files = {}
    parser.find_view.side_effect = find_view

    looker._repo_credentials = True
    looker._project_parsers = {"my_project": parser}
    looker._all_lookml_models = [SimpleNamespace(name="my_model", explores=[SimpleNamespace(name="my_explore")])]

    def run():
        records = []
        lookups = []
        flushed = False

        def build_data_model(data_model_name):
            lookups.append((len(records), data_model_name))
            return _data_model(data_model_name) if flushed else None

        with (
            patch.object(LookerSource, "register_record_datamodel", return_value=None),
            patch.object(LookerSource, "_get_explore_sql", return_value=None),
            patch.object(LookerSource, "_build_data_model", side_effect=build_data_model),
            patch.object(LookerSource, "get_db_service_prefixes", return_value=[]),
        ):
            for node_entity in (explore, DATAMODEL_LINEAGE_SENTINEL):
                for either in looker.yield_bulk_datamodel(node_entity):
                    records.append(either)
                    # The sink commits the buffer synchronously on a Barrier.
                    if either.right is not None and isinstance(either.right, Barrier):
                        flushed = True

        return records, lookups

    return run


class TestLookerLineageBarrier:
    """Ordering contract between the data-model writes and the lineage reads."""

    def test_no_data_model_lookup_before_the_barrier(self, bulk_stage):
        """Every read-back must happen after the buffer has been flushed."""
        records, lookups = bulk_stage()

        barrier_index = _first_index(records, Barrier)
        assert barrier_index != -1, "The bulk stage must emit a Barrier"
        assert lookups, "The stage should still resolve its data models"

        early = [name for index, name in lookups if index < barrier_index]
        assert early == [], f"Data models resolved before the Barrier: {early}"

    def test_barrier_precedes_every_lineage_record(self, bulk_stage):
        records, _ = bulk_stage()

        lineage_index = _first_index(records, AddLineageRequest)
        assert lineage_index != -1, "The stage should emit lineage"
        assert _first_index(records, Barrier) < lineage_index

    def test_data_models_are_created_before_the_barrier(self, bulk_stage):
        """The whole point of the barrier is that the creates precede it."""
        records, _ = bulk_stage()

        barrier_index = _first_index(records, Barrier)
        creates = [
            index
            for index, either in enumerate(records)
            if either.right is not None and isinstance(either.right, CreateDashboardDataModelRequest)
        ]

        assert creates
        assert all(index < barrier_index for index in creates)

    def test_view_lineage_is_emitted_and_not_reported_as_failure(self, bulk_stage):
        """The regression: 306 'NoneType has no attribute name' errors."""
        records, _ = bulk_stage()

        failures = [either.left.error for either in records if either.left is not None]
        assert failures == [], f"Bulk stage reported failures: {failures}"
        assert _rights(records, AddLineageRequest), "View -> explore lineage should be produced"

    def test_only_one_barrier_per_bulk_stage(self, bulk_stage):
        records, _ = bulk_stage()

        assert len(_rights(records, Barrier)) == 1, "One flush is enough for the whole stage"

    def test_explore_views_are_not_re_emitted_as_standalone_views(self, bulk_stage):
        """`_views_cache` now fills after the flush, so the dedup can't rely on it."""
        records, _ = bulk_stage()

        created = [request.name.root for request in _rights(records, CreateDashboardDataModelRequest)]

        assert sorted(created) == sorted(set(created)), f"Duplicate data models: {created}"
        assert sorted(created) == EXPECTED_DATA_MODELS

    def test_a_failed_lookup_does_not_sink_the_whole_lineage_phase(self, looker):
        """One flaky GET must cost only its own view's lineage."""

        def flaky(data_model_name):
            if data_model_name == "my_model_my_view_view":
                raise RuntimeError("boom")
            return _data_model(data_model_name)

        looker._pending_views = [
            ("my_view", "my_model_my_view_view"),
            ("other_view", "my_model_other_view_view"),
        ]

        with patch.object(LookerSource, "_build_data_model", side_effect=flaky):
            resolved = looker._resolve_pending_datamodels()

        assert resolved["my_model_my_view_view"] is None
        assert resolved["my_model_other_view_view"] is not None
        assert looker._views_cache["other_view"] is not None

    def test_standalone_view_lineage_also_runs_after_the_barrier(self, bulk_stage, looker):
        """The standalone path is the other half of the bug (109 of the 306 failures)."""
        records, _ = bulk_stage()

        assert looker._views_cache["orphan_view"] is not None, "standalone view must resolve"

        # orphan_view extends my_view, so the edge is my_view -> orphan_view.
        parent = looker._views_cache["my_view"]
        child = looker._views_cache["orphan_view"]
        extends_edges = [
            r
            for r in _rights(records, AddLineageRequest)
            if r.edge.fromEntity.id.root == parent.id.root and r.edge.toEntity.id.root == child.id.root
        ]
        assert extends_edges, "standalone view -> extends parent lineage should be produced"

    def test_deferred_lineage_does_not_pin_the_explore_sdk_object(self, looker, bulk_stage):
        """Deferring lineage must not retain LookmlModelExplore for the whole stage.

        The SDK object carries the full fieldset — measured at ~250 KB per explore, so a
        1,000-explore instance would hold ~250 MB it never reads. Only model_name and name
        are used, so the pending entry keeps an ExploreRef instead.
        """
        # The lineage loop clears the list, so snapshot it at the flush while it is populated.
        captured = []
        original = LookerSource._resolve_pending_datamodels

        def snapshot(self):
            captured.extend(self._pending_view_lineage)
            return original(self)

        with patch.object(LookerSource, "_resolve_pending_datamodels", autospec=True, side_effect=snapshot):
            bulk_stage()

        assert captured, "the stage should defer at least one view -> explore lineage"
        for _, held, _ in captured:
            assert not isinstance(held, LookmlModelExplore), (
                f"pending lineage pins the SDK explore ({sys.getsizeof(held)} B shallow); use ExploreRef"
            )
            assert isinstance(held, ExploreRef)
            assert (held.model_name, held.name) == ("my_model", "my_explore")

    def test_barrier_is_not_counted_as_a_scanned_record(self):
        """A flush is a control record, not an ingested asset."""
        status = Status()
        status.scanned(Barrier(reason="looker_datamodel_lineage_flush"))

        assert status.records == []


class TestProducerClosesTheStream:
    """`list_datamodels` must always close with the sentinel.

    Without it `_yield_bulk_datamodel_lineage` never runs and the whole lineage phase
    vanishes silently — no error, no edges. Nothing else in the suite covers this, so
    dropping the yield used to be an undetectable regression.
    """

    def _models(self, looker, explore_side_effect=None):
        looker.client.all_lookml_models = MagicMock(
            return_value=[SimpleNamespace(name="m1", project_name="p", explores=[SimpleNamespace(name="e1")])]
        )
        looker.client.lookml_model_explore = MagicMock(
            side_effect=explore_side_effect or (lambda **_: SimpleNamespace(name="e1", model_name="m1"))
        )

    def test_sentinel_is_yielded_last(self, looker):
        self._models(looker)

        produced = list(looker.list_datamodels())

        assert produced[-1] is DATAMODEL_LINEAGE_SENTINEL
        assert sum(1 for p in produced if p is DATAMODEL_LINEAGE_SENTINEL) == 1

    def test_sentinel_is_yielded_when_a_single_explore_fetch_fails(self, looker):
        """`fetch_lookml_explores` swallows this one, so the stream just ends early."""
        self._models(looker, explore_side_effect=Exception("explore 500"))

        produced = list(looker.list_datamodels())

        assert produced == [DATAMODEL_LINEAGE_SENTINEL]

    def test_sentinel_is_yielded_when_the_model_listing_itself_blows_up(self, looker):
        """The outer handler must not swallow the sentinel with the error.

        Standalone views and the lineage of whatever was already yielded still need
        drawing, so the sentinel lives after the `except`, not inside the `try`.
        """
        looker.client.all_lookml_models = MagicMock(side_effect=Exception("looker api down"))

        produced = list(looker.list_datamodels())

        assert produced == [DATAMODEL_LINEAGE_SENTINEL]

    def test_no_sentinel_when_data_models_are_disabled(self, looker):
        """Nothing was written, so there is nothing to flush or resolve."""
        looker.source_config.includeDataModels = False

        assert list(looker.list_datamodels()) == []

    def test_the_sentinel_is_not_a_barrier(self, looker):
        """Producer yields are the stage's input and never reach the sink.

        A Barrier here would be handed to `yield_bulk_datamodel` as `model` and flush
        nothing; the real Barrier goes out on the Either channel instead.
        """
        assert not isinstance(DATAMODEL_LINEAGE_SENTINEL, Barrier)
        assert repr(DATAMODEL_LINEAGE_SENTINEL) == "<end of explores>"


class TestLookerMissingDataModel:
    """A data model that genuinely fails to create must not crash the stage."""

    def test_add_view_lineage_skips_when_data_model_is_missing(self, looker, explore):
        looker._view_data_model = None
        looker._explores_cache["my_model_my_explore"] = _data_model("my_model_my_explore")

        results = list(looker.add_view_lineage(LookMlView(name="my_view"), explore))

        assert results == [], "A missing data model is a skip, not a stack trace"

    def test_standalone_view_lineage_skips_when_data_model_is_missing(self, looker):
        looker._view_data_model = None

        results = list(
            looker._add_standalone_view_lineage(
                LookMlView(name="my_view", sql_table_name="db.schema.my_table"),
                "my_project",
                "my_model",
            )
        )

        assert results == [], "A missing data model is a skip, not a stack trace"
