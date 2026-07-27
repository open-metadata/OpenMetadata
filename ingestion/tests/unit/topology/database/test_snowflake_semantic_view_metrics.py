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
"""Unit tests for the Snowflake semantic-view metric builders."""

from metadata.generated.schema.entity.data.metric import Language, MetricType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.snowflake.semantic_view_metrics import (
    build_metric_name,
    build_metric_request,
    infer_metric_type,
)

# (TABLE_NAME, NAME, DATA_TYPE, EXPRESSION, COMMENT, SYNONYMS)
TOTAL_REVENUE = ("orders", "total_revenue", "NUMBER", "SUM(orders.line_amount)", "Total revenue", None)
ORDER_COUNT = ("orders", "order_count", "NUMBER", "COUNT(orders.o_orderkey)", None, None)
DIM_REGION = ("customers", "region", "VARCHAR", "customers.c_region", "Customer region", "geo")
FACT_LINE_AMOUNT = ("orders", "line_amount", "NUMBER", "orders.o_totalprice", "Line amount", None)


def test_build_metric_name_is_qualified():
    name = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "sales_analysis", "total_revenue")
    assert "snowflake_svc" in name
    assert "sales_analysis" in name
    assert name.endswith("total_revenue")
    # distinct views must produce distinct names
    other = build_metric_name("snowflake_svc", "TEST_DB", "SALES", "other_view", "total_revenue")
    assert name != other


def test_infer_metric_type_by_prefix():
    assert infer_metric_type("SUM(x)") == MetricType.SUM
    assert infer_metric_type("count(x)") == MetricType.COUNT
    assert infer_metric_type("AVG(x)") == MetricType.AVERAGE
    assert infer_metric_type("MIN(x)") == MetricType.MIN
    assert infer_metric_type("MAX(x)") == MetricType.MAX
    assert infer_metric_type("x / y") == MetricType.OTHER
    assert infer_metric_type(None) == MetricType.OTHER


def test_build_metric_request_maps_all_fields():
    view_ref = EntityReference(id="12345678-1234-1234-1234-123456789012", type="table")
    request = build_metric_request(
        "snowflake_svc",
        "TEST_DB",
        "SALES",
        "sales_analysis",
        metric_row=TOTAL_REVENUE,
        dimension_rows=[DIM_REGION],
        fact_rows=[FACT_LINE_AMOUNT],
        view_ref=view_ref,
    )
    assert request.name.root.endswith("total_revenue")
    assert request.displayName == "total_revenue"
    assert request.description.root == "Total revenue"
    assert request.metricType == MetricType.SUM
    assert request.metricExpression.language == Language.SQL
    assert request.metricExpression.code == "SUM(orders.line_amount)"
    assert [d.name for d in request.dimensions] == ["region"]
    assert request.dimensions[0].expression == "customers.c_region"
    assert [m.name for m in request.measures] == ["line_amount"]
    assert request.measures[0].expression == "orders.o_totalprice"
    assert request.assets.root[0].id.root == view_ref.id.root


def test_build_metric_request_without_comment_or_assets():
    request = build_metric_request(
        "svc",
        "db",
        "sc",
        "v",
        metric_row=ORDER_COUNT,
        dimension_rows=[],
        fact_rows=[],
        view_ref=None,
    )
    assert request.description is None
    assert request.dimensions is None
    assert request.measures is None
    assert request.assets is None
    assert request.metricType == MetricType.COUNT
