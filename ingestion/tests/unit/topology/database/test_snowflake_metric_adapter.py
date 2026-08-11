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
"""Snowflake semantic-view adapter: catalog rows → normalized MetricDefinition."""

from __future__ import annotations

from metadata.domain.metrics.records import MetricSourceType
from metadata.generated.schema.entity.data.metric import MetricType, Type
from metadata.ingestion.source.database.snowflake.metric_adapter import (
    build_metric_entity_name,
    infer_metric_type,
    normalize_snowflake_metric,
)


def _row(
    name: str,
    expression: str,
    data_type: str = "NUMBER",
    comment: str = "",
    synonyms: str | None = None,
) -> tuple:
    return ("MY_VIEW", name, data_type, expression, comment, synonyms)


def test_metric_name_is_qualified_with_service_and_stays_single_segment():
    metric_row = _row("total_sales", "SUM(amount)", comment="Total sales")
    definition = normalize_snowflake_metric(
        service_name="snow_svc",
        database="my_catalog",
        schema="my_schema",
        view="my_view",
        metric_row=metric_row,
        dimension_rows=[_row("region", "region", "VARCHAR")],
        fact_rows=[_row("amount", "amount", "NUMBER")],
    )
    assert definition.origin.source_type is MetricSourceType.SNOWFLAKE
    assert definition.origin.external_id == "snow_svc.my_catalog.my_schema.my_view.total_sales"
    assert definition.name == "snow_svc-my_catalog-my_schema-my_view-total_sales"
    assert "." not in definition.name, "server-visible name must be a single FQN segment"
    assert definition.metric_type is MetricType.SUM
    assert definition.expression.code == "SUM(amount)"


def test_assets_link_to_the_semantic_view_only():
    """Base tables are one hop further upstream (base -> view -> metric) and are
    represented as lineage, not flattened into a direct metric-to-table link."""
    metric_row = _row("total_sales", "SUM(amount)")
    definition = normalize_snowflake_metric(
        service_name="snow",
        database="my_catalog",
        schema="my_schema",
        view="my_view",
        metric_row=metric_row,
        dimension_rows=[],
        fact_rows=[],
    )
    assert len(definition.related_assets) == 1
    assert definition.related_assets[0].fullyQualifiedName == "snow.my_catalog.my_schema.my_view"


def test_overflow_name_gets_digest_suffix_to_stay_unique():
    a = build_metric_entity_name("s" * 300, "d", "s", "v", "m1")
    b = build_metric_entity_name("s" * 300, "d", "s", "v", "m2")
    assert a != b, "long distinct names must not collide after truncation"
    assert len(a) <= 256 and len(b) <= 256


def test_dimension_time_type_inferred_from_data_type():
    metric_row = _row("cnt", "COUNT(*)")
    definition = normalize_snowflake_metric(
        service_name="s",
        database="d",
        schema="sch",
        view="v",
        metric_row=metric_row,
        dimension_rows=[
            _row("region", "region", "VARCHAR"),
            _row("event_ts", "event_ts", "TIMESTAMP_NTZ"),
        ],
        fact_rows=[],
    )
    by_name = {d.name: d for d in definition.dimensions}
    assert by_name["region"].type is Type.CATEGORICAL
    assert by_name["event_ts"].type is Type.TIME


def test_measure_carries_aggregation_head_when_inferable():
    metric_row = _row("cnt", "COUNT(*)")
    definition = normalize_snowflake_metric(
        service_name="s",
        database="d",
        schema="sch",
        view="v",
        metric_row=metric_row,
        dimension_rows=[],
        fact_rows=[
            _row("revenue", "SUM(price*qty)"),
            _row("plain", "price"),
        ],
    )
    by_name = {m.name: m for m in definition.measures}
    assert by_name["revenue"].aggregation == "SUM"
    assert by_name["plain"].aggregation is None


def test_synonyms_folded_into_description_alongside_comment():
    metric_row = _row("cnt", "COUNT(*)")
    definition = normalize_snowflake_metric(
        service_name="s",
        database="d",
        schema="sch",
        view="v",
        metric_row=metric_row,
        dimension_rows=[_row("region", "region", "VARCHAR", comment="US regions", synonyms="area,zone")],
        fact_rows=[],
    )
    desc = definition.dimensions[0].description
    assert "US regions" in desc
    assert "Synonyms: area,zone" in desc


def test_quoted_identifier_gets_unquoted_before_sanitization():
    # A Snowflake identifier wrapped in double quotes should unquote first,
    # so a bare `"schema"` becomes `schema`, not `_schema_`.
    name = build_metric_entity_name("svc", "db", '"schema"', "view", "m")
    assert name == "svc-db-schema-view-m"


def test_metric_type_inference():
    assert infer_metric_type("SUM(x)") is MetricType.SUM
    assert infer_metric_type("count(*)") is MetricType.COUNT
    assert infer_metric_type("AVG(x)") is MetricType.AVERAGE
    assert infer_metric_type("MIN(x)") is MetricType.MIN
    assert infer_metric_type("MAX(x)") is MetricType.MAX
    assert infer_metric_type("PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)") is MetricType.OTHER
    assert infer_metric_type(None) is MetricType.OTHER
    assert infer_metric_type("") is MetricType.OTHER
