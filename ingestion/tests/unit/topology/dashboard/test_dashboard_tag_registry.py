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

from contextlib import closing
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from tenacity import wait_none

from metadata.domain.tags import TagAssignment, TagCanonicalizer
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


@pytest.mark.parametrize("interrupt", [False, True])
def test_failed_assignment_reports_error_and_cleans_up_without_discarding_other_labels(
    catalog_source, monkeypatch, interrupt
):
    from contextlib import closing

    from tenacity import wait_none

    from metadata.domain.tags import TagCanonicalizer

    monkeypatch.setattr(TagCanonicalizer._es_search.retry, "wait", wait_none())
    redash, catalog = catalog_source
    source = object.__new__(GrafanaSource)
    vars(source).update(vars(redash))
    catalog.update({"GrafanaTags.Present", "GrafanaTags.Unavailable"})

    def search(**kwargs):
        if kwargs["fqn_search_string"] == "GrafanaTags.Unavailable":
            raise ConnectionError("Search unavailable")
        return []

    source.metadata.es_search_from_fqn.side_effect = search
    details = SimpleNamespace(
        dashboard=SimpleNamespace(
            uid="my_dashboard", title="My dashboard", description=None, tags=["Present", "Unavailable"]
        ),
        meta=SimpleNamespace(url="/d/my_dashboard", createdBy=None),
    )
    with closing(source.yield_dashboard(details)) as records:
        error = next(records)
        assert error.right is None
        assert "GrafanaTags.Unavailable" in error.left.error
        assert "Search unavailable" in error.left.error
        if not interrupt:
            [record] = list(records)
            assert record.left is None
            assert labels(record.right) == ["GrafanaTags.Present"]
    assert source.tags_registry.stats()["live_entities"] == 0
    assert source.tags_registry.stats()["pending"] == 0


@pytest.mark.parametrize("enabled,tags", [(False, ["Shared"]), (True, None), (True, []), (True, iter(()))])
@pytest.mark.parametrize("existing_assignments", [False, True])
def test_empty_or_disabled_preparation_preserves_existing_scopes_and_skips_identity(
    catalog_source, enabled, tags, existing_assignments
):
    source, catalog = catalog_source
    if existing_assignments:
        catalog.add("RedashTags.Shared")
        for target in ("my_service.my_dashboard", "my_service.other_dashboard"):
            assert source.tags_registry.attach(TagAssignment("RedashTags", "Shared", target)) is None
    source.metadata.es_search_from_fqn.reset_mock()
    source.source_config.includeTags = enabled

    def native_tags():
        assert enabled
        return tags

    def forbidden_identity():
        raise AssertionError("Empty or disabled tags must not evaluate entity identity")

    stream = source.prepare_tag_labels(
        classification_name="RedashTags", get_tags=native_tags, get_entity_fqn=forbidden_identity
    )
    with pytest.raises(StopIteration) as result:
        next(stream)
    assert result.value.value is None
    source.metadata.es_search_from_fqn.assert_not_called()
    source.metadata.get_by_name.assert_not_called()
    if existing_assignments:
        for target in ("my_service.my_dashboard", "my_service.other_dashboard"):
            assert [tag.tagFQN.root for tag in source.tags_registry.labels_for(target)] == ["RedashTags.Shared"]
    else:
        assert "tags_registry" not in vars(source)


@pytest.mark.parametrize("mode", ["finish", "close", "throw"])
def test_preparation_preserves_error_yield_order_and_releases_scope(catalog_source, monkeypatch, mode):
    source, catalog = catalog_source
    monkeypatch.setattr(TagCanonicalizer._es_search.retry, "wait", wait_none())
    catalog.update({"RedashTags.First", "RedashTags.Last"})
    assert source.tags_registry.attach(TagAssignment("RedashTags", "First", "my_service.other_dashboard")) is None

    def search(**kwargs):
        if kwargs["fqn_search_string"] == "RedashTags.Unavailable":
            raise ConnectionError("Search unavailable")
        return []

    source.metadata.es_search_from_fqn.side_effect = search
    visited = []

    def native_tags():
        for name in ("First", "Unavailable", "Last"):
            visited.append(name)
            yield name

    with closing(
        source.prepare_tag_labels(
            classification_name="RedashTags",
            get_tags=native_tags,
            get_entity_fqn=lambda: "my_service.my_dashboard",
        )
    ) as stream:
        error = next(stream)
        assert error.right is None
        assert "RedashTags.Unavailable" in error.left.error
        assert visited == ["First", "Unavailable"]
        assert source.tags_registry.stats()["live_entities"] == 2
        source.metadata.get_by_name.assert_not_called()
        if mode == "finish":
            with pytest.raises(StopIteration) as result:
                next(stream)
            assert [tag.tagFQN.root for tag in result.value.value] == ["RedashTags.First", "RedashTags.Last"]
        elif mode == "throw":
            with pytest.raises(RuntimeError, match="Source interrupted"):
                stream.throw(RuntimeError("Source interrupted"))
    assert source.tags_registry.labels_for("my_service.my_dashboard") == []
    assert [tag.tagFQN.root for tag in source.tags_registry.labels_for("my_service.other_dashboard")] == [
        "RedashTags.First"
    ]
    assert source.tags_registry.stats()["pending"] == 0
    assert visited == (["First", "Unavailable", "Last"] if mode == "finish" else ["First", "Unavailable"])


@pytest.mark.parametrize("names,expected", [(["Shared"], ["RedashTags.Shared"]), (["", "bad>name", "Missing"], [])])
@pytest.mark.parametrize("lookup_unavailable", [False, True])
def test_preparation_returns_labels_without_errors_and_always_clears_scope(
    catalog_source, names, expected, lookup_unavailable
):
    source, catalog = catalog_source
    catalog.add("RedashTags.Shared")
    if lookup_unavailable:
        source.metadata.get_by_name.side_effect = ConnectionError("Catalog unavailable")
    stream = source.prepare_tag_labels(
        classification_name="RedashTags", get_tags=lambda: iter(names), get_entity_fqn=lambda: "my_service.my_dashboard"
    )
    with pytest.raises(StopIteration) as result:
        next(stream)
    assert [tag.tagFQN.root for tag in result.value.value or []] == ([] if lookup_unavailable else expected)
    assert source.tags_registry.stats()["live_entities"] == 0
    assert source.tags_registry.stats()["pending"] == 0
