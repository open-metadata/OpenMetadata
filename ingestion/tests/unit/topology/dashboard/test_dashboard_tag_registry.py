#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Native dashboard definition publication and per-asset labels."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.ingestion.api.steps import Source
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.grafana.metadata import GrafanaSource
from metadata.ingestion.source.dashboard.redash.metadata import RedashSource


@pytest.fixture
def catalog_source():
    catalog = set()
    source = object.__new__(RedashSource)
    Source.__init__(source)
    source.metadata = MagicMock(spec=OpenMetadata)
    source.metadata.get_by_name.side_effect = lambda **kwargs: object() if kwargs["fqn"] in catalog else None
    source.source_config = DashboardServiceMetadataPipeline(includeTags=True, includeOwners=False)
    source.service_connection = SimpleNamespace(hostPort="http://localhost:5000", redashVersion="10.0.0")
    source.context = TopologyContextManager(source.topology)
    source.context.get().upsert("dashboard_service", "my_service")
    source.context.get().upsert("charts", [])
    source.dashboard_source_state = set()
    return source, catalog


def dashboard(name, tags):
    return {"id": name, "name": name, "tags": tags}


def labels(request):
    return [label.tagFQN.root for label in request.tags or []]


def publish(source, catalog):
    records = list(source.yield_bulk_tags())
    assert all(record.left is None for record in records)
    for record in records:
        catalog.add(f"RedashTags.{record.right.tag_request.name.root}")
    return [record.right.tag_request.name.root for record in records]


def test_bulk_definitions_are_deduplicated_and_dashboard_labels_stay_separate(catalog_source):
    source, catalog = catalog_source
    first = dashboard("first", ["Shared", "OnlyA"])
    second = dashboard("second", ["Shared", "OnlyB"])
    source.client = SimpleNamespace(dashboards=object(), paginate=lambda _: [first, second])
    source.prepare()
    assert publish(source, catalog) == ["Shared", "OnlyA", "OnlyB"]
    first_request = next(source.yield_dashboard(first)).right
    second_request = next(source.yield_dashboard(second)).right
    assert labels(first_request) == ["RedashTags.Shared", "RedashTags.OnlyA"]
    assert labels(second_request) == ["RedashTags.Shared", "RedashTags.OnlyB"]
    assert list(source.yield_bulk_tags()) == []
    assert source.tags_registry.stats()["live_entities"] == 0


def test_unpublished_definitions_do_not_prevent_dashboard_creation(catalog_source):
    source, _ = catalog_source
    details = dashboard("my_dashboard", ["Missing"])
    source.dashboard_list = [details]
    assert len(list(source.yield_bulk_tags())) == 1
    record = next(source.yield_dashboard(details))
    assert record.left is None
    assert record.right.name.root == "my_dashboard"
    assert labels(record.right) == []
    assert source.tags_registry.stats()["live_entities"] == 0


def test_interrupted_definition_stream_can_resume_publication(catalog_source):
    source, catalog = catalog_source
    source.dashboard_list = [dashboard("my_dashboard", ["First", "Second"])]
    stream = source.yield_bulk_tags()
    assert next(stream).right.tag_request.name.root == "First"
    stream.close()
    assert publish(source, catalog) == ["First", "Second"]
    assert labels(next(source.yield_dashboard(source.dashboard_list[0])).right) == [
        "RedashTags.First",
        "RedashTags.Second",
    ]


def test_invalid_tags_do_not_discard_valid_dashboard_labels(catalog_source):
    source, catalog = catalog_source
    details = dashboard("my_dashboard", ["", " ", "bad>name", "Valid"])
    source.dashboard_list = [details]
    assert publish(source, catalog) == ["Valid"]
    assert labels(next(source.yield_dashboard(details)).right) == ["RedashTags.Valid"]


@pytest.mark.parametrize("enabled,tags", [(False, ["Disabled"]), (True, []), (True, [" ", "bad>name"])])
def test_ignored_tags_do_not_publish_definitions_or_query_the_catalog(catalog_source, enabled, tags):
    source, _ = catalog_source
    source.source_config.includeTags = enabled
    source.dashboard_list = [dashboard("my_dashboard", tags)]
    assert list(source.yield_bulk_tags()) == []
    assert labels(next(source.yield_dashboard(source.dashboard_list[0])).right) == []
    source.metadata.get_by_name.assert_not_called()


def test_grafana_only_attaches_existing_native_tags(catalog_source):
    redash, catalog = catalog_source
    source = object.__new__(GrafanaSource)
    vars(source).update(vars(redash))
    catalog.add("GrafanaTags.Existing")
    details = SimpleNamespace(
        dashboard=SimpleNamespace(
            uid="my_dashboard", title="My dashboard", description=None, tags=["Existing", "Missing"]
        ),
        meta=SimpleNamespace(url="/d/my_dashboard", createdBy=None),
    )
    assert list(source.yield_tags(details) or []) == []
    record = next(source.yield_dashboard(details))
    assert record.left is None
    assert labels(record.right) == ["GrafanaTags.Existing"]
    assert catalog == {"GrafanaTags.Existing"}
    assert source.tags_registry.stats()["pending"] == 0
