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
"""Outcome-based tests for MetricIngestionFeature."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest

from metadata.domain.metrics import (
    DEFAULT_MAX_DEFINITIONS,
    MetricDefinition,
    MetricFeatureOverflowError,
    MetricIngestionFeature,
    MetricKey,
    MetricOrigin,
    MetricSourceType,
)
from metadata.generated.schema.api.data.createMetric import CreateMetricRequest
from metadata.generated.schema.type.entityReferenceInput import EntityReferenceInput

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.metric import MetricType


def _origin(
    source: MetricSourceType = MetricSourceType.DBT,
    service: str = "svc",
    external: str = "m1",
) -> MetricOrigin:
    return MetricOrigin(source_type=source, service_name=service, external_id=external)


def _defn(
    origin: MetricOrigin,
    *,
    name: str | None = None,
    description: str | None = None,
    depends_on: tuple[MetricKey, ...] = (),
    related_assets: tuple[EntityReferenceInput, ...] = (),
    metric_type: MetricType | None = None,
) -> MetricDefinition:
    return MetricDefinition(
        key=MetricKey.from_origin(origin),
        origin=origin,
        name=name or origin.external_id,
        description=description,
        depends_on=depends_on,
        related_assets=related_assets,
        metric_type=metric_type,
    )


def _table_ref(fqn: str) -> EntityReferenceInput:
    return EntityReferenceInput(type="table", fullyQualifiedName=fqn)


def _rights(feature: MetricIngestionFeature) -> list[Any]:
    return [e.right for e in feature.drain() if e.right is not None]


def _lefts(feature: MetricIngestionFeature) -> list[Any]:
    return [e.left for e in feature.drain() if e.left is not None]


def test_identical_duplicates_collapse():
    feature = MetricIngestionFeature()
    origin = _origin()
    feature.accept(_defn(origin, description="d"))
    feature.accept(_defn(origin, description="d"))
    requests = [r for r in _rights(feature) if isinstance(r, CreateMetricRequest)]
    assert len(requests) == 1


def test_conflicting_definitions_fail_visibly():
    feature = MetricIngestionFeature()
    origin = _origin()
    feature.accept(_defn(origin, description="first"))
    with pytest.raises(ValueError, match="Conflicting definitions"):
        feature.accept(_defn(origin, description="second"))


def test_same_names_from_distinct_origins_do_not_merge():
    feature = MetricIngestionFeature()
    a = MetricOrigin(source_type=MetricSourceType.DBT, service_name="svc", external_id="ext-a")
    b = MetricOrigin(source_type=MetricSourceType.SNOWFLAKE, service_name="svc", external_id="ext-b")
    feature.accept(_defn(a, name="revenue"))
    feature.accept(_defn(b, name="revenue"))
    requests = [r for r in _rights(feature) if isinstance(r, CreateMetricRequest)]
    assert len(requests) == 2


def test_dependency_ordering_is_stable():
    feature = MetricIngestionFeature()
    parent = _origin(external="parent")
    child = _origin(external="child")
    feature.accept(_defn(child, depends_on=(MetricKey.from_origin(parent),)))
    feature.accept(_defn(parent))
    order = [r.name.root for r in _rights(feature) if isinstance(r, CreateMetricRequest)]
    assert order.index("parent") < order.index("child")


def test_cycle_is_reported():
    feature = MetricIngestionFeature()
    a = _origin(external="a")
    b = _origin(external="b")
    feature.accept(_defn(a, depends_on=(MetricKey.from_origin(b),)))
    feature.accept(_defn(b, depends_on=(MetricKey.from_origin(a),)))
    assert any("cycle" in err.error for err in _lefts(feature))


def test_unresolved_dependency_is_reported():
    feature = MetricIngestionFeature()
    missing = MetricKey(source_type=MetricSourceType.DBT, service_name="svc", external_id="ghost")
    feature.accept(_defn(_origin(external="orphan"), depends_on=(missing,)))
    assert any("unresolved dependency" in err.error for err in _lefts(feature))


def test_bounded_capacity_and_overflow_is_explicit():
    feature = MetricIngestionFeature(max_definitions=2)
    feature.accept(_defn(_origin(external="a")))
    feature.accept(_defn(_origin(external="b")))
    with pytest.raises(MetricFeatureOverflowError):
        feature.accept(_defn(_origin(external="c")))


def test_capacity_default_is_bounded():
    assert 0 < DEFAULT_MAX_DEFINITIONS < 10**9


def test_assets_ride_inline_as_fqn_only_entity_reference_input():
    """assets go out on CreateMetricRequest with fqn set + id absent — server
    resolves via MetricMapper.resolveAssets."""
    feature = MetricIngestionFeature()
    feature.accept(_defn(_origin(), related_assets=(_table_ref("svc.db.sch.t"),)))
    requests = [r for r in _rights(feature) if isinstance(r, CreateMetricRequest)]
    assert requests[0].assets is not None
    assets = requests[0].assets.root
    assert len(assets) == 1
    assert assets[0].type == "table"
    assert assets[0].fullyQualifiedName == "svc.db.sch.t"
    assert assets[0].id is None


def test_definitions_without_assets_leave_assets_field_none():
    feature = MetricIngestionFeature()
    feature.accept(_defn(_origin()))
    requests = [r for r in _rights(feature) if isinstance(r, CreateMetricRequest)]
    assert requests[0].assets is None


def test_related_metric_fqns_flow_to_create_request():
    feature = MetricIngestionFeature()
    parent = _origin(external="parent")
    child = _origin(external="child")
    feature.accept(_defn(parent, name="parent"))
    feature.accept(_defn(child, name="child", depends_on=(MetricKey.from_origin(parent),)))
    requests = [r for r in _rights(feature) if isinstance(r, CreateMetricRequest)]
    child_req = next(r for r in requests if r.name.root == "child")
    assert child_req.relatedMetrics is not None
    assert [r.root for r in child_req.relatedMetrics] == ["parent"]


def test_connectors_without_metrics_are_unchanged():
    feature = MetricIngestionFeature()
    assert list(feature.drain()) == []


def test_output_deterministic_regardless_of_registration_order():
    inputs = [_defn(_origin(external=x)) for x in ("z", "a", "m", "b", "y")]

    def run(order):
        feature = MetricIngestionFeature()
        for d in order:
            feature.accept(d)
        return [r.name.root for r in _rights(feature) if isinstance(r, CreateMetricRequest)]

    forward = run(inputs)
    reverse = run(list(reversed(inputs)))
    assert forward == reverse
    assert forward == sorted(forward)
