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
Mapping tests for LookML measures -> OpenMetadata Metric entities.

These assert on the produced ``CreateMetricRequest`` (an observable outcome), not on how the
connector calls itself. The topology-level wiring is covered by ``test_looker_standalone_views``
and ``test_looker_lineage_barrier``.
"""

import lkml
import pytest
from looker_sdk.sdk.api40.models import (
    LookmlModelExplore,
    LookmlModelExploreField,
    LookmlModelExploreFieldMeasureFilters,
    LookmlModelExploreFieldset,
)

from metadata.generated.schema.entity.data.metric import (
    Language,
    MetricType,
    Type,
    UnitOfMeasurement,
)
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.looker.measures import (
    MeasureCandidate,
    build_metric_request,
    candidates_from_explore,
    candidates_from_view,
    looker_metric_name,
    measure_references,
    merge_candidates,
    order_parents_first,
    table_column_references,
)
from metadata.ingestion.source.dashboard.looker.models import LkmlFile

SERVICE = "looker_svc"
PROJECT = "ecommerce"

VIEW_LKML = """
view: orders {
  sql_table_name: public.orders ;;
  dimension: id { primary_key: yes  type: number  sql: ${TABLE}.id ;; }
  dimension: status { type: string  sql: ${TABLE}.status ;; }
  dimension_group: created {
    type: time
    timeframes: [date, month]
    sql: ${TABLE}.created_at ;;
  }
  measure: count { type: count }
  measure: total_revenue {
    label: "Total Revenue"
    description: "Sum of order amounts"
    type: sum
    sql: ${TABLE}.amount ;;
    value_format_name: usd
    filters: [status: "complete"]
  }
  measure: completed_count {
    type: count
    filters: {
      field: status
      value: "complete"
    }
  }
  measure: avg_order_value {
    type: number
    sql: ${total_revenue} / NULLIF(${count},0) ;;
  }
}
"""


@pytest.fixture(name="view")
def view_fixture():
    return LkmlFile.model_validate(lkml.load(VIEW_LKML)).views[0]


@pytest.fixture(name="candidates")
def candidates_fixture(view):
    return {candidate.key: candidate for candidate in candidates_from_view(view, PROJECT)}


def explore_field(**kwargs) -> LookmlModelExploreField:
    defaults = {"measure": True, "project_name": PROJECT}
    return LookmlModelExploreField(**{**defaults, **kwargs})


def explore(*fields: LookmlModelExploreField, name: str = "orders_explore") -> LookmlModelExplore:
    return LookmlModelExplore(
        name=name,
        model_name="ecommerce_model",
        project_name=PROJECT,
        fields=LookmlModelExploreFieldset(
            dimensions=[field for field in fields if not field.measure],
            measures=[field for field in fields if field.measure],
        ),
    )


# --------------------------------------------------------------------------------------
# Identity
# --------------------------------------------------------------------------------------


def test_metric_name_is_stable_for_the_same_identity():
    assert looker_metric_name(SERVICE, PROJECT, "orders", "total_revenue") == looker_metric_name(
        SERVICE, PROJECT, "orders", "total_revenue"
    )


def test_metric_name_is_a_single_fqn_segment():
    name = looker_metric_name("prod.looker eu::1", PROJECT, "orders", "total_revenue")

    assert "." not in name
    assert "::" not in name
    assert " " not in name


@pytest.mark.parametrize(
    "identity",
    [
        ("other_service", PROJECT, "orders", "total_revenue"),
        (SERVICE, "other_project", "orders", "total_revenue"),
        (SERVICE, PROJECT, "other_view", "total_revenue"),
        (SERVICE, PROJECT, "orders", "other_measure"),
    ],
)
def test_metric_name_is_unique_per_identity_element(identity):
    assert looker_metric_name(*identity) != looker_metric_name(SERVICE, PROJECT, "orders", "total_revenue")


def test_renaming_a_measure_produces_a_new_name():
    """A rename is a new Metric; the old one is left behind.

    Cleanup of stale metrics is deliberately out of scope -- `Metric` has no service field, so
    there is nothing to scope a delete sweep by. This test pins the behaviour so it stays a
    decision rather than becoming an accident.
    """
    assert looker_metric_name(SERVICE, PROJECT, "orders", "revenue") != looker_metric_name(
        SERVICE, PROJECT, "orders", "total_revenue"
    )


# --------------------------------------------------------------------------------------
# Deduplication across explores and sources
# --------------------------------------------------------------------------------------


def test_one_measure_joined_into_several_explores_yields_one_candidate():
    field = explore_field(name="orders.total_revenue", view="orders", type="sum", sql="${TABLE}.amount")
    merged = merge_candidates(
        {},
        [
            *candidates_from_explore(explore(field, name="explore_a"), PROJECT),
            *candidates_from_explore(explore(field, name="explore_b"), PROJECT),
            *candidates_from_explore(explore(field, name="explore_c"), PROJECT),
        ],
    )

    assert len(merged) == 1


def test_a_joined_alias_attributes_to_the_defining_view():
    """`view` is the join alias; `original_view` is where the measure is declared."""
    field = explore_field(
        name="returned_orders.total_revenue",
        view="returned_orders",
        original_view="orders",
        type="sum",
    )

    (candidate,) = candidates_from_explore(explore(field), PROJECT)

    assert candidate.view == "orders"
    assert candidate.name == "total_revenue"


def test_lookml_candidate_overwrites_the_api_candidate(view):
    """LookML is strictly richer, so it wins for the same identity."""
    api_field = explore_field(name="orders.total_revenue", view="orders", type="sum")
    merged = merge_candidates({}, candidates_from_explore(explore(api_field), PROJECT))
    merged = merge_candidates(merged, candidates_from_view(view, PROJECT))

    assert merged[("ecommerce", "orders", "total_revenue")].filters == ["status: complete"]


def test_an_explore_dimension_is_not_a_metric():
    dimension = explore_field(name="orders.status", view="orders", type="string", measure=False)

    assert candidates_from_explore(explore(dimension), PROJECT) == []


# --------------------------------------------------------------------------------------
# Emission order
# --------------------------------------------------------------------------------------


def measure_candidate(name: str, sql: str | None = None, view: str = "orders") -> MeasureCandidate:
    return MeasureCandidate(
        project=PROJECT,
        view=view,
        name=name,
        label=None,
        description=None,
        measure_type="number",
        sql=sql,
        filters=[],
        value_format_name=None,
        tags=[],
        dimensions=[],
        from_lookml=True,
    )


def ordered_names(candidates: list[MeasureCandidate]) -> list[str]:
    known = {candidate.key: candidate for candidate in candidates}
    return [candidate.name for candidate in order_parents_first(known)]


def test_a_derived_measure_is_ordered_after_the_measures_it_references(candidates):
    """The API hands us fields alphabetically, so `avg_order_value` arrives first."""
    alphabetical = sorted(candidates.values(), key=lambda candidate: candidate.name)
    names = ordered_names(alphabetical)

    assert names.index("total_revenue") < names.index("avg_order_value")
    assert names.index("count") < names.index("avg_order_value")


def test_ordering_keeps_every_candidate_exactly_once(candidates):
    names = ordered_names(list(candidates.values()))

    assert sorted(names) == sorted(candidate.name for candidate in candidates.values())


def test_a_reference_to_another_views_measure_is_not_a_parent():
    """`${field}` is view-scoped, so a same-named measure on another view does not reorder."""
    names = ordered_names(
        [
            measure_candidate("revenue_ratio", sql="${total_revenue} / 2", view="orders"),
            measure_candidate("total_revenue", view="returns"),
        ]
    )

    assert names == ["revenue_ratio", "total_revenue"]


def test_a_reference_cycle_terminates_and_keeps_both_measures():
    """LookML rejects a cycle, but a malformed view must not hang the run."""
    names = ordered_names(
        [
            measure_candidate("a", sql="${b} + 1"),
            measure_candidate("b", sql="${a} + 1"),
        ]
    )

    assert sorted(names) == ["a", "b"]


def test_a_measure_referencing_itself_terminates():
    assert ordered_names([measure_candidate("a", sql="${a} + 1")]) == ["a"]


# --------------------------------------------------------------------------------------
# Field mapping
# --------------------------------------------------------------------------------------


def test_sql_round_trips_verbatim_into_the_metric_expression(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "total_revenue")])

    assert request.metricExpression.code == "${TABLE}.amount"
    assert request.metricExpression.language == Language.SQL


def test_a_measure_without_sql_has_no_expression_but_keeps_its_aggregation(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "count")])

    assert request.metricExpression is None
    assert request.measures[0].aggregation == "count"


def test_name_and_label_are_both_preserved(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "total_revenue")])

    assert request.displayName == "Total Revenue"
    assert request.measures[0].name == "total_revenue"
    assert request.description.root == "Sum of order amounts"


def test_display_name_falls_back_to_the_measure_name(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "count")])

    assert request.displayName == "count"


@pytest.mark.parametrize(
    ("lookml_type", "expected"),
    [
        ("count", MetricType.COUNT),
        ("count_distinct", MetricType.COUNT),
        ("sum", MetricType.SUM),
        ("sum_distinct", MetricType.SUM),
        ("average", MetricType.AVERAGE),
        ("average_distinct", MetricType.AVERAGE),
        ("min", MetricType.MIN),
        ("max", MetricType.MAX),
        ("median", MetricType.MEDIAN),
        ("percent_of_total", MetricType.PERCENTAGE),
        ("running_total", MetricType.CUMULATIVE),
        ("number", MetricType.DERIVED),
        ("list", MetricType.OTHER),
        (None, MetricType.OTHER),
        ("a_type_looker_has_not_invented_yet", MetricType.OTHER),
    ],
)
def test_measure_type_maps_to_metric_type(lookml_type, expected):
    field = explore_field(name="orders.m", view="orders", type=lookml_type)
    (candidate,) = candidates_from_explore(explore(field), PROJECT)

    assert build_metric_request(SERVICE, candidate).metricType == expected


@pytest.mark.parametrize(
    ("value_format_name", "expected", "expected_custom"),
    [
        ("usd", UnitOfMeasurement.DOLLARS, None),
        ("usd_0", UnitOfMeasurement.DOLLARS, None),
        ("percent_2", UnitOfMeasurement.PERCENTAGE, None),
        ("decimal_1", None, None),
        (None, None, None),
    ],
)
def test_value_format_maps_to_unit_of_measurement(value_format_name, expected, expected_custom):
    field = explore_field(name="orders.m", view="orders", type="sum", value_format_name=value_format_name)
    (candidate,) = candidates_from_explore(explore(field), PROJECT)
    request = build_metric_request(SERVICE, candidate)

    assert request.unitOfMeasurement == expected
    assert request.customUnitOfMeasurement == expected_custom


@pytest.mark.parametrize(
    ("value_format_name", "expected_custom"),
    [("gbp", "GBP"), ("gbp_0", "GBP"), ("eur", "EUR"), ("eur_0", "EUR")],
)
def test_a_non_dollar_currency_is_named_rather_than_relabelled_as_dollars(value_format_name, expected_custom):
    """`DOLLARS` is the enum's only currency, and a pound is not a dollar.

    Calling a GBP measure `DOLLARS` is a wrong assertion about the data; `OTHER` plus the
    currency in `customUnitOfMeasurement` says exactly what the measure is denominated in.
    """
    field = explore_field(name="orders.m", view="orders", type="sum", value_format_name=value_format_name)
    (candidate,) = candidates_from_explore(explore(field), PROJECT)
    request = build_metric_request(SERVICE, candidate)

    assert request.unitOfMeasurement == UnitOfMeasurement.OTHER
    assert request.customUnitOfMeasurement == expected_custom


def test_the_defining_views_dimensions_are_attached(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "total_revenue")])
    dimensions = {dimension.name: dimension for dimension in request.dimensions}

    assert set(dimensions) == {"id", "status", "created"}
    assert dimensions["status"].type == Type.CATEGORICAL
    assert dimensions["created"].type == Type.TIME
    assert dimensions["id"].expression == "${TABLE}.id"


def test_granularity_is_never_guessed(candidates):
    assert build_metric_request(SERVICE, candidates[(PROJECT, "orders", "count")]).granularity is None


# --------------------------------------------------------------------------------------
# Filters
# --------------------------------------------------------------------------------------


def test_new_style_filter_syntax(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "total_revenue")])

    assert [filter_.where for filter_ in request.filters] == ["status: complete"]


def test_legacy_filter_block_syntax(candidates):
    request = build_metric_request(SERVICE, candidates[(PROJECT, "orders", "completed_count")])

    assert [filter_.where for filter_ in request.filters] == ["status: complete"]


def test_api_filters_use_the_condition_field():
    field = explore_field(
        name="orders.recent_revenue",
        view="orders",
        type="sum",
        filters=[LookmlModelExploreFieldMeasureFilters(field="orders.created_date", condition="30 days")],
    )
    (candidate,) = candidates_from_explore(explore(field), PROJECT)

    assert [f.where for f in build_metric_request(SERVICE, candidate).filters] == ["orders.created_date: 30 days"]


def test_filter_expressions_are_kept_as_lookml_not_translated_to_sql():
    """`-NULL`, `>10` and friends are Looker filter expressions, not SQL predicates."""
    field = explore_field(
        name="orders.big",
        view="orders",
        type="sum",
        filters=[LookmlModelExploreFieldMeasureFilters(field="amount", condition=">10")],
    )
    (candidate,) = candidates_from_explore(explore(field), PROJECT)

    assert [f.where for f in build_metric_request(SERVICE, candidate).filters] == ["amount: >10"]


def test_a_measure_without_filters_has_none(candidates):
    assert build_metric_request(SERVICE, candidates[(PROJECT, "orders", "count")]).filters is None


# --------------------------------------------------------------------------------------
# References -> lineage and relatedMetrics
# --------------------------------------------------------------------------------------


def test_measure_references_are_extracted(candidates):
    candidate = candidates[(PROJECT, "orders", "avg_order_value")]

    assert measure_references(candidate.sql) == ["total_revenue", "count"]


def test_table_reference_is_not_a_measure_reference():
    assert measure_references("${TABLE}.amount") == []


def test_related_metrics_resolve_to_emitted_metric_names(candidates):
    request = build_metric_request(
        SERVICE,
        candidates[(PROJECT, "orders", "avg_order_value")],
        related_metrics=[looker_metric_name(SERVICE, PROJECT, "orders", "total_revenue")],
    )

    assert [model_str(related) for related in request.relatedMetrics] == [
        looker_metric_name(SERVICE, PROJECT, "orders", "total_revenue")
    ]


def test_table_columns_resolve_through_dimension_references(view):
    """`${status}` inside a measure resolves to the column that dimension reads."""
    field_sql = {field.name: field.sql for field in (*view.dimensions, *view.dimension_groups, *view.measures)}

    assert table_column_references("${TABLE}.amount", field_sql) == {"amount"}
    assert table_column_references("CASE WHEN ${status} = 'x' THEN 1 END", field_sql) == {"status"}


def test_table_columns_resolve_transitively_through_other_measures(view):
    field_sql = {field.name: field.sql for field in (*view.dimensions, *view.dimension_groups, *view.measures)}

    assert table_column_references("${total_revenue} / 2", field_sql) == {"amount"}


def test_self_referencing_sql_does_not_recurse_forever():
    assert table_column_references("${a}", {"a": "${b}", "b": "${a}"}) == set()


# --------------------------------------------------------------------------------------
# Hidden measures
# --------------------------------------------------------------------------------------

HIDDEN_VIEW_LKML = """
view: orders {
  measure: visible_total { type: sum  sql: ${TABLE}.amount ;; }
  measure: internal_helper {
    hidden: yes
    type: sum
    sql: ${TABLE}.raw_amount ;;
  }
  measure: explicitly_visible { hidden: no  type: count }
}
"""


def test_a_hidden_lookml_measure_is_not_a_metric():
    """`hidden: yes` marks an intermediate, not something a user can chart.

    Metric names are unique across the whole instance, so every hidden helper ingested takes a
    permanent slot in that namespace for a measure Looker itself will not show.
    """
    view = LkmlFile.model_validate(lkml.load(HIDDEN_VIEW_LKML)).views[0]

    names = {candidate.name for candidate in candidates_from_view(view, PROJECT)}

    assert names == {"visible_total", "explicitly_visible"}


def test_a_hidden_api_measure_is_not_a_metric():
    fields = [
        explore_field(name="orders.visible", view="orders", type="sum"),
        explore_field(name="orders.internal", view="orders", type="sum", hidden=True),
    ]

    assert [candidate.name for candidate in candidates_from_explore(explore(*fields), PROJECT)] == ["visible"]


# --------------------------------------------------------------------------------------
# Aliased joins
# --------------------------------------------------------------------------------------


def test_a_view_joined_twice_does_not_repeat_its_dimensions():
    """`billing.status` and `shipping.status` are one view's one `status` dimension."""
    model = explore(
        explore_field(name="billing.status", view="billing", original_view="addresses", type="string", measure=False),
        explore_field(name="shipping.status", view="shipping", original_view="addresses", type="string", measure=False),
        explore_field(name="billing.count", view="billing", original_view="addresses", type="count"),
    )

    (candidate,) = candidates_from_explore(model, PROJECT)

    assert [dimension.name for dimension in candidate.dimensions] == ["status"]


# --------------------------------------------------------------------------------------
# Partial LookML declarations
# --------------------------------------------------------------------------------------

OVERRIDE_VIEW_LKML = """
view: orders_extended {
  extends: [orders]
  measure: total_revenue { label: "Revenue (extended)" }
}
"""


def test_a_partial_lookml_override_keeps_what_the_api_resolved():
    """The parser reads view files verbatim -- it never expands `extends`.

    A child view overriding only `label` therefore parses to a measure with no type and no SQL.
    Letting that replace the API candidate wholesale would turn a `sum` into an untyped metric
    with no expression; the API has already applied inheritance, so it backfills.
    """
    view = LkmlFile.model_validate(lkml.load(OVERRIDE_VIEW_LKML)).views[0]
    api_field = explore_field(
        name="orders_extended.total_revenue",
        view="orders_extended",
        type="sum",
        sql="${TABLE}.amount",
        value_format_name="usd",
        description="Sum of order amounts",
    )

    merged = merge_candidates({}, candidates_from_explore(explore(api_field), PROJECT))
    merged = merge_candidates(merged, candidates_from_view(view, PROJECT))
    request = build_metric_request(SERVICE, merged[(PROJECT, "orders_extended", "total_revenue")])

    assert request.displayName == "Revenue (extended)"
    assert request.metricType == MetricType.SUM
    assert request.metricExpression.code == "${TABLE}.amount"
    assert request.unitOfMeasurement == UnitOfMeasurement.DOLLARS


def test_a_full_lookml_declaration_still_wins_over_the_api():
    """Backfilling must not let a stale API value survive a LookML declaration."""
    api_field = explore_field(
        name="orders.total_revenue",
        view="orders",
        type="count",
        sql="${TABLE}.stale",
        label="Stale label",
    )

    merged = merge_candidates({}, candidates_from_explore(explore(api_field), PROJECT))
    view = LkmlFile.model_validate(lkml.load(VIEW_LKML)).views[0]
    merged = merge_candidates(merged, candidates_from_view(view, PROJECT))
    request = build_metric_request(SERVICE, merged[(PROJECT, "orders", "total_revenue")])

    assert request.displayName == "Total Revenue"
    assert request.metricType == MetricType.SUM
    assert request.metricExpression.code == "${TABLE}.amount"
