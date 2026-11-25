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
Every service source owns its topology context, queue and seen-entity state
"""

import threading

import pytest

from metadata.ingestion.api.topology_runner import PerSourceState
from metadata.ingestion.source.api.api_service import ApiServiceSource
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.dbt.dbt_service import DbtServiceSource
from metadata.ingestion.source.drive.drive_service import DriveServiceSource
from metadata.ingestion.source.messaging.messaging_service import MessagingServiceSource
from metadata.ingestion.source.mlmodel.mlmodel_service import MlModelServiceSource
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.ingestion.source.search.search_service import SearchServiceSource
from metadata.ingestion.source.security.security_service import SecurityServiceSource
from metadata.ingestion.source.storage.storage_service import StorageServiceSource

SERVICE_SOURCES = [
    ApiServiceSource,
    DashboardServiceSource,
    DatabaseServiceSource,
    DbtServiceSource,
    DriveServiceSource,
    MessagingServiceSource,
    MlModelServiceSource,
    PipelineServiceSource,
    SearchServiceSource,
    SecurityServiceSource,
    StorageServiceSource,
]


def _bare_source(source_class: type) -> object:
    """An instance that skips __init__, which would connect to the service."""
    probe = type(f"Probe{source_class.__name__}", (source_class,), {})
    probe.__abstractmethods__ = frozenset()
    return object.__new__(probe)


def _source_state_names(source: object) -> list[str]:
    return [
        name
        for klass in type(source).__mro__
        for name, attribute in vars(klass).items()
        if name.endswith("_source_state") and isinstance(attribute, PerSourceState)
    ]


@pytest.mark.parametrize("source_class", SERVICE_SOURCES, ids=lambda klass: klass.__name__)
def test_sources_of_one_type_share_no_state(source_class):
    first, second = _bare_source(source_class), _bare_source(source_class)

    assert first.context is not second.context
    first.context.get().__dict__["service"] = "first_service"
    assert second.context.get().__dict__.get("service") != "first_service"

    assert first.queue is not second.queue

    for name in _source_state_names(first):
        getattr(first, name).add("first_service.entity")
        assert getattr(second, name) == set(), name


@pytest.mark.parametrize(
    "source_class", [klass for klass in SERVICE_SOURCES if klass is not DbtServiceSource], ids=lambda k: k.__name__
)
def test_every_seen_entity_set_is_per_source(source_class):
    source = _bare_source(source_class)
    declared = [name for klass in source_class.__mro__ for name in vars(klass) if name.endswith("_source_state")]

    assert declared
    assert sorted(_source_state_names(source)) == sorted(declared)


def test_assigned_state_replaces_the_default_for_that_source_only():
    first, second = _bare_source(DatabaseServiceSource), _bare_source(DatabaseServiceSource)

    first.database_source_state = {"service.db.schema.table"}

    assert first.database_source_state == {"service.db.schema.table"}
    assert second.database_source_state == set()


def test_threads_racing_on_first_access_get_the_same_object():
    both_creating = threading.Barrier(2, timeout=5)

    def create() -> set[str]:
        both_creating.wait()
        return set()

    class Holder:
        seen = PerSourceState(create)

    holder = Holder()
    results: list[set[str]] = []
    threads = [threading.Thread(target=lambda: results.append(holder.seen)) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)

    assert len(results) == 2
    assert results[0] is results[1]
