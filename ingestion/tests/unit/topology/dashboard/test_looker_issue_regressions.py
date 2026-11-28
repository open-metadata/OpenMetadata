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
"""Regression tests for Looker project filtering and Liquid lineage."""

import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from fnmatch import fnmatchcase
from types import SimpleNamespace
from unittest.mock import MagicMock, PropertyMock, patch

import lkml
import pytest

from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.looker.bulk_parser import BulkLkmlParser
from metadata.ingestion.source.dashboard.looker.columns import get_columns_from_model
from metadata.ingestion.source.dashboard.looker.metadata import (
    DATAMODEL_LINEAGE_SENTINEL,
    ExploreRef,
    LookerSource,
)
from metadata.ingestion.source.dashboard.looker.models import LkmlFile, LookMlView
from metadata.readers.file.local import LocalReader
from metadata.utils.singleton import Singleton


def _conditional_table(condition: str) -> str:
    """A ``sql_table_name`` that only resolves to the prod table when ``condition`` holds."""
    return f"""
{{% if {condition} %}}
schema_prod.table_name
{{% else %}}
schema_test.table_name
{{% endif %}}
"""


MODEL_CONDITIONAL_TABLE = _conditional_table("_model._name == 'finance_reports'")
EXPLORE_CONDITIONAL_TABLE = _conditional_table("_explore._name == 'table_details_explore'")
VIEW_CONDITIONAL_TABLE = _conditional_table("_view._name == 'table_details'")


def _view_lineage_source() -> LookerSource:
    source = object.__new__(LookerSource)
    source._explores_cache = {}
    source._views_cache = {}
    source._parsed_views = {}
    source._unparsed_views = {}
    source._lookml_constants_map = {}
    source._view_data_model = _view_data_model(LookMlView(name="table_details"))
    source._added_lineage = {}
    source.source_config = DashboardServiceMetadataPipeline()
    return source


class Catalog:
    def __init__(self, prefixes, available, columns: Sequence[str] = ()):
        self.services = {name: DatabaseService(id=uuid.uuid4(), name=name, serviceType="Trino") for name in prefixes}
        self.tables = (
            {
                name: Table(
                    id=uuid.uuid4(),
                    name="table_name",
                    columns=[
                        Column(
                            name=column,
                            dataType=DataType.STRING,
                            fullyQualifiedName=f"{name}.demo_db.schema_prod.table_name.{column}",
                        )
                        for column in columns
                    ],
                    fullyQualifiedName=f"{name}.demo_db.schema_prod.table_name",
                )
                for name in prefixes
            }
            if available
            else {}
        )
        self.searches = []

    def es_search_from_fqn(self, entity_type, fqn_search_string, **kwargs):
        if entity_type == DatabaseService:
            service = self.services.get(fqn_search_string)
            return [service] if service else []
        self.searches.append(fqn_search_string)
        return [
            table
            for table in self.tables.values()
            if fnmatchcase(model_str(table.fullyQualifiedName), fqn_search_string)
        ]

    def get_by_name(self, entity, fqn, **kwargs):
        if entity == DatabaseService:
            return self.services.get(fqn)
        return next((table for table in self.tables.values() if model_str(table.fullyQualifiedName) == fqn), None)


@contextmanager
def _stubbed_db_services(
    source: LookerSource,
    available: bool = True,
    prefixes: Sequence[str] = ("trino_service",),
    columns: Sequence[str] = (),
) -> Iterator[Catalog]:
    source.metadata = Catalog(prefixes, available, columns)
    with (
        patch.object(source, "get_db_service_prefixes", return_value=list(prefixes)),
        patch.object(source, "_get_db_dialect", return_value=Dialect.ANSI),
    ):
        yield source.metadata


def test_project_filter_excludes_lookml_models_and_explores() -> None:
    source = object.__new__(LookerSource)
    source.source_config = MagicMock(
        includeDataModels=True,
        dataModelFilterPattern=None,
        projectFilterPattern=FilterPattern(excludes=["^secret_project$"]),
    )
    allowed_model = SimpleNamespace(
        name="finance",
        project_name="allowed_project",
        explores=[SimpleNamespace(name="orders")],
    )
    excluded_model = SimpleNamespace(
        name="confidential",
        project_name="secret_project",
        explores=[SimpleNamespace(name="payroll")],
    )
    allowed_explore = SimpleNamespace(name="orders")
    excluded_explore = SimpleNamespace(name="payroll")
    source.client = MagicMock()
    source.client.all_lookml_models.return_value = [allowed_model, excluded_model]
    source.client.lookml_model_explore.side_effect = [allowed_explore, excluded_explore]
    source.status = MagicMock()
    source._repo_credentials = None
    source._main_lookml_repos = None
    source.service_connection = MagicMock(gitCredentials=None)

    assert list(source.list_datamodels()) == [allowed_explore, DATAMODEL_LINEAGE_SENTINEL]
    assert source._all_lookml_models == [allowed_model]
    source.client.lookml_model_explore.assert_called_once_with(
        lookml_model_name="finance",
        explore_name="orders",
    )
    source.status.filter.assert_called_once_with(
        "confidential",
        "Project [secret_project] filtered out.",
    )
    assert source.progress_tracking.registry._global[DashboardDataModel.__name__].total == 1


def test_list_datamodels_still_closes_the_stream_when_the_explore_fetch_fails() -> None:
    """The sentinel is what triggers standalone views and deferred lineage, so it has to
    survive a failed explore fetch or neither ever runs."""
    source = object.__new__(LookerSource)
    source.source_config = MagicMock(includeDataModels=True)
    source.client = MagicMock()
    source.client.all_lookml_models.side_effect = RuntimeError("Looker API is down")
    source.status = MagicMock()

    assert list(source.list_datamodels()) == [DATAMODEL_LINEAGE_SENTINEL]


@pytest.mark.parametrize(
    "sql_table_name",
    [MODEL_CONDITIONAL_TABLE, EXPLORE_CONDITIONAL_TABLE, VIEW_CONDITIONAL_TABLE],
    ids=["_model._name", "_explore._name", "_view._name"],
)
def test_liquid_scopes_select_source_table_for_view_lineage(sql_table_name: str) -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=sql_table_name)
    explore = ExploreRef("finance_reports", "table_details_explore")
    with _stubbed_db_services(source) as catalog:
        results = list(source.add_view_lineage(view, explore))
    assert len(results) == 1 and results[0].left is None
    edge = results[0].right.edge
    assert edge.fromEntity.id == catalog.tables["trino_service"].id
    assert edge.toEntity.id == source._view_data_model.id
    assert not edge.lineageDetails.columnsLineage


REFERENCING_VIEWS = f"""
view: fact_usage {{
  sql_table_name: {MODEL_CONDITIONAL_TABLE} ;;
}}

view: derived_usage {{
  derived_table: {{ sql: SELECT id FROM schema_prod.table_name ;; }}
}}

view: usage {{
  sql_table_name: ${{fact_usage.SQL_TABLE_NAME}} ;;
}}

view: usage_of_usage {{
  sql_table_name: ${{usage.SQL_TABLE_NAME}} ;;
}}

view: usage_of_derived {{
  sql_table_name: ${{derived_usage.SQL_TABLE_NAME}} ;;
}}

view: usage_of_missing {{
  sql_table_name: ${{missing.SQL_TABLE_NAME}} ;;
}}

view: cycle_a {{
  sql_table_name: ${{cycle_b.SQL_TABLE_NAME}} ;;
}}

view: cycle_b {{
  sql_table_name: ${{cycle_a.SQL_TABLE_NAME}} ;;
}}
"""


@contextmanager
def _lookml_project(tmp_path, views: str) -> Iterator[BulkLkmlParser]:
    """`views` parsed from a LookML project, as `LookerSource.parser` serves them."""
    (tmp_path / "project.view.lkml").write_text(views)
    # BulkLkmlParser is a singleton: drop any instance another test left, and ours afterwards.
    Singleton.clear_all()
    parser = BulkLkmlParser(reader=LocalReader(base_path=tmp_path))
    try:
        with patch.object(LookerSource, "parser", new_callable=PropertyMock, return_value={"finance_project": parser}):
            yield parser
    finally:
        Singleton.clear_all()


@pytest.fixture
def referencing_project(tmp_path) -> Iterator[BulkLkmlParser]:
    with _lookml_project(tmp_path, REFERENCING_VIEWS) as parser:
        yield parser


def _explore_lineage(source: LookerSource, view: LookMlView, model_name: str = "finance_reports") -> list:
    explore = ExploreRef(model_name, "usage_explore", "finance_project")
    return list(source.add_view_lineage(view, explore))


@pytest.mark.parametrize("view_name", ["usage", "usage_of_usage", "usage_of_derived"])
def test_sql_table_name_reading_another_views_table_gets_its_lineage(referencing_project, view_name) -> None:
    """`sql_table_name: ${other.SQL_TABLE_NAME}` gets lineage from what `other` reads (#38326),
    through chained references and derived tables, without `other` having been processed."""
    source = _view_lineage_source()
    with _stubbed_db_services(source) as catalog:
        results = _explore_lineage(source, referencing_project.find_view(view_name))
    assert len(results) == 1 and results[0].left is None
    edge = results[0].right.edge
    assert edge.fromEntity.id == catalog.tables["trino_service"].id
    assert edge.toEntity.id == source._view_data_model.id


def test_referenced_sql_table_name_is_rendered_in_the_referencing_views_model(referencing_project) -> None:
    """`fact_usage` reads the test table outside `finance_reports`, so `usage` must too."""
    source = _view_lineage_source()
    with _stubbed_db_services(source) as catalog:
        assert _explore_lineage(source, referencing_project.find_view("usage"), model_name="sandbox") == []
    assert catalog.searches and all("schema_test.table_name" in search for search in catalog.searches)


def test_standalone_view_reading_another_views_table_gets_its_lineage(referencing_project) -> None:
    source = _view_lineage_source()
    with _stubbed_db_services(source) as catalog:
        results = list(
            source._add_standalone_view_lineage(
                referencing_project.find_view("usage"), "finance_project", "finance_reports"
            )
        )
    assert len(results) == 1 and results[0].left is None
    assert results[0].right.edge.fromEntity.id == catalog.tables["trino_service"].id


@pytest.mark.parametrize("view_name", ["usage_of_missing", "cycle_a"])
def test_unresolvable_view_reference_is_not_looked_up_as_a_table(referencing_project, view_name) -> None:
    source = _view_lineage_source()
    with _stubbed_db_services(source) as catalog:
        assert _explore_lineage(source, referencing_project.find_view(view_name)) == []
    assert catalog.searches == []


def test_view_lineage_skips_unresolved_lineage_request() -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)
    explore = ExploreRef("finance_reports", "table_details_explore")

    with _stubbed_db_services(source, available=False) as catalog:
        assert list(source.add_view_lineage(view, explore)) == []
    assert catalog.searches


def test_column_lineage_is_extracted_once_per_view() -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)
    explore = ExploreRef("finance_reports", "table_details_explore")
    with (
        patch.object(source, "_extract_column_lineage", wraps=source._extract_column_lineage) as extract_column_lineage,
        _stubbed_db_services(source, prefixes=("trino_service", "snowflake_service")) as catalog,
    ):
        results = list(source.add_view_lineage(view, explore))
    assert all(result.left is None for result in results)
    assert {result.right.edge.fromEntity.id.root for result in results} == {
        table.id.root for table in catalog.tables.values()
    }
    assert all(result.right.edge.toEntity.id == source._view_data_model.id for result in results)
    extract_column_lineage.assert_called_once_with(view)


def test_model_liquid_context_selects_source_table_for_standalone_view_lineage() -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)
    with _stubbed_db_services(source) as catalog:
        results = list(source._add_standalone_view_lineage(view, "finance_project", "finance_reports"))
    assert len(results) == 1 and results[0].left is None
    edge = results[0].right.edge
    assert edge.fromEntity.id == catalog.tables["trino_service"].id
    assert edge.toEntity.id == source._view_data_model.id
    assert not edge.lineageDetails.columnsLineage


def test_standalone_view_lineage_skips_when_the_data_model_was_never_written() -> None:
    """An unresolved data model means there is nothing to point lineage at, so the view
    is skipped rather than yielding a request with a null target."""
    source = object.__new__(LookerSource)
    source._views_cache = {}
    source._parsed_views = {}
    source._lookml_constants_map = {}
    source._view_data_model = None
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)

    with _stubbed_db_services(source) as catalog:
        assert list(source._add_standalone_view_lineage(view, "finance_project", "finance_reports")) == []

    assert catalog.searches == []


VIEW_WITH_DIMENSION_GROUP = """
view: orders {
  sql_table_name: public.orders ;;
  dimension: id { type: number  sql: ${TABLE}.id ;; }
  dimension_group: created {
    type: time
    timeframes: [date, month]
    sql: ${TABLE}.created_at ;;
  }
}
"""


def _view_data_model(view: LookMlView) -> DashboardDataModel:
    """The view's data model as the connector writes it, with the FQNs the server assigns."""
    return DashboardDataModel(
        id=uuid.uuid4(),
        name="orders_view",
        service=EntityReference(id=uuid.uuid4(), type="dashboardService"),
        dataModelType=DataModelType.LookMlView,
        columns=[
            column.model_copy(
                update={"fullyQualifiedName": FullyQualifiedEntityName(f"looker.orders_view.{model_str(column.name)}")}
            )
            for column in get_columns_from_model(view)
        ],
    )


def test_a_dimension_group_is_a_column_of_the_view_data_model() -> None:
    """The explore side gets one dimension per timeframe from the API; a parsed view only has
    the group, so dropping it leaves the view data model with no time dimension at all."""
    view = LkmlFile.model_validate(lkml.load(VIEW_WITH_DIMENSION_GROUP)).views[0]

    columns = get_columns_from_model(view)

    assert [model_str(column.name) for column in columns] == ["id", "created"]
    assert columns[1].dataType is DataType.TIME


def test_dimension_group_column_lineage_reaches_the_data_model_column() -> None:
    """`_extract_column_lineage` walks dimension groups, but the edge is only kept if the data
    model carries a column to point at."""
    view = LkmlFile.model_validate(lkml.load(VIEW_WITH_DIMENSION_GROUP)).views[0]
    source = _view_lineage_source()
    table = Table(
        id=uuid.uuid4(),
        name="orders",
        fullyQualifiedName="trino.db.public.orders",
        columns=[
            Column(
                name="created_at",
                dataType=DataType.TIMESTAMP,
                fullyQualifiedName="trino.db.public.orders.created_at",
            )
        ],
    )

    edges = source._process_and_validate_column_lineage(
        source._extract_column_lineage(view), table, _view_data_model(view)
    )

    assert [([model_str(column) for column in edge.fromColumns], model_str(edge.toColumn)) for edge in edges] == [
        (["trino.db.public.orders.created_at"], "looker.orders_view.created")
    ]


TABLE_FQN = "trino_service.demo_db.schema_prod.table_name"
VIEW_FQN = "looker.orders_view"
ORDERS_COLUMNS = ("id", "status", "first_name", "last_name", "created_at", "amount", "order_number", "number")


def _derived_view(sql: str, fields: str) -> LookMlView:
    lookml = "view: orders { derived_table: { sql: " + sql + " ;; } " + fields + " }"
    return LkmlFile.model_validate(lkml.load(lookml)).views[0]


def _column_pairs(results) -> set[tuple[str, str]]:
    return {
        (model_str(from_column), model_str(column.toColumn))
        for result in results
        for column in result.right.edge.lineageDetails.columnsLineage or []
        for from_column in column.fromColumns
    }


def _qualified(pairs: set[tuple[str, str]]) -> set[tuple[str, str]]:
    return {(f"{TABLE_FQN}.{column}", f"{VIEW_FQN}.{field}") for column, field in pairs}


def _derived_lineage(view: LookMlView) -> list:
    source = _view_lineage_source()
    source._view_data_model = _view_data_model(view)
    with _stubbed_db_services(source, columns=ORDERS_COLUMNS):
        return _explore_lineage(source, view)


@pytest.mark.parametrize(
    ("sql", "fields", "expected"),
    [
        pytest.param(
            "SELECT id",
            "dimension: order_id { sql: ${TABLE}.id ;; }",
            {("id", "order_id")},
            id="renamed_field",
        ),
        pytest.param(
            "SELECT id, status",
            "dimension: id { sql: ${TABLE}.id ;; } dimension: status {}",
            {("id", "id"), ("status", "status")},
            id="same_name_and_no_sql",
        ),
        pytest.param(
            "SELECT id",
            "dimension: order_id { sql: ${TABLE}.id ;; } "
            "dimension: order_key { sql: CAST(${TABLE}.id AS VARCHAR) ;; } "
            "measure: order_count { type: count_distinct sql: ${TABLE}.id ;; }",
            {("id", "order_id"), ("id", "order_key"), ("id", "order_count")},
            id="one_column_many_fields",
        ),
        pytest.param(
            "SELECT first_name, last_name",
            "dimension: full_name { sql: ${TABLE}.first_name || ' ' || ${TABLE}.last_name ;; }",
            {("first_name", "full_name"), ("last_name", "full_name")},
            id="one_field_many_columns",
        ),
        pytest.param(
            "SELECT id",
            "dimension: order_id { sql: ${TABLE}.id ;; } dimension: order_label { sql: CONCAT('#', ${order_id}) ;; }",
            {("id", "order_id"), ("id", "order_label")},
            id="field_reading_another_field",
        ),
        pytest.param(
            "SELECT created_at",
            "dimension_group: created { type: time timeframes: [date, month] sql: ${TABLE}.created_at ;; }",
            {("created_at", "created")},
            id="dimension_group",
        ),
        pytest.param(
            "SELECT amount",
            "measure: total_amount { type: sum sql: ${TABLE}.amount ;; }",
            {("amount", "total_amount")},
            id="measure",
        ),
        pytest.param(
            "SELECT ID",
            "dimension: order_id { sql: ${TABLE}.id ;; }",
            {("id", "order_id")},
            id="case_differs",
        ),
        pytest.param(
            "SELECT id, order_number",
            "dimension: id { sql: ${TABLE}.order_number ;; }",
            {("order_number", "id")},
            id="name_shared_with_another_column",
        ),
        pytest.param(
            "SELECT id, number",
            'dimension: order_number { label: "id" sql: ${TABLE}.number ;; }',
            {("number", "order_number")},
            id="label_shared_with_another_column",
        ),
    ],
)
def test_derived_view_column_lineage_lands_on_the_fields_reading_each_column(sql, fields, expected) -> None:
    """The data model's columns are the view's fields, so each SQL output column has to be carried
    to the fields reading it (#38583). A field's declared column wins over a name or label that
    happens to match another output column."""
    results = _derived_lineage(_derived_view(f"{sql} FROM schema_prod.table_name", fields))

    assert len(results) == 1 and results[0].left is None
    assert _column_pairs(results) == _qualified(expected)


@pytest.mark.parametrize(
    ("sql", "fields"),
    [
        pytest.param("SELECT *", "dimension: order_id { sql: ${TABLE}.id ;; }", id="select_star"),
        pytest.param("SELECT id", "dimension: order_status { sql: ${TABLE}.status ;; }", id="column_not_selected"),
    ],
)
def test_derived_view_keeps_the_table_edge_when_no_field_column_resolves(sql, fields) -> None:
    """Without an output column a field reads, there is nothing to link, so no column is guessed."""
    results = _derived_lineage(_derived_view(f"{sql} FROM schema_prod.table_name", fields))

    assert len(results) == 1 and results[0].left is None
    assert results[0].right.edge.fromEntity.fullyQualifiedName == TABLE_FQN
    assert _column_pairs(results) == set()


RENAMING_VIEWS = """
view: orders_derived {
  derived_table: { sql: SELECT id FROM schema_prod.table_name ;; }
  dimension: order_id { sql: ${TABLE}.id ;; }
}

view: order_usage {
  sql_table_name: ${orders_derived.SQL_TABLE_NAME} ;;
  dimension: usage_order_id { sql: ${TABLE}.id ;; }
}

view: order_summary {
  derived_table: { sql: SELECT id FROM ${orders_derived.SQL_TABLE_NAME} ;; }
  dimension: summary_order_id { sql: ${TABLE}.id ;; }
}
"""


@pytest.fixture
def renaming_project(tmp_path) -> Iterator[BulkLkmlParser]:
    with _lookml_project(tmp_path, RENAMING_VIEWS) as parser:
        yield parser


@pytest.mark.parametrize("path", ["explore", "standalone"])
def test_view_reading_a_derived_views_table_maps_columns_to_its_own_fields(renaming_project, path) -> None:
    """`order_usage` reads `orders_derived`'s SQL, but the data model is `order_usage`'s, so the
    SQL columns land on `order_usage`'s fields, not on `orders_derived`'s."""
    view = renaming_project.find_view("order_usage")
    source = _view_lineage_source()
    source._view_data_model = _view_data_model(view)
    with _stubbed_db_services(source, columns=ORDERS_COLUMNS):
        results = (
            _explore_lineage(source, view)
            if path == "explore"
            else list(source._add_standalone_view_lineage(view, "finance_project", "finance_reports"))
        )

    assert len(results) == 1 and results[0].left is None
    assert _column_pairs(results) == _qualified({("id", "usage_order_id")})


def test_chained_derived_view_maps_the_upstream_sql_columns_to_its_own_fields(renaming_project) -> None:
    """The upstream view is inlined as a subquery, so only the downstream view's fields apply."""
    view = renaming_project.find_view("order_summary")
    source = _view_lineage_source()
    source._view_data_model = _view_data_model(view)
    source._parsed_views["orders_derived"] = "SELECT id FROM schema_prod.table_name"
    with _stubbed_db_services(source, columns=ORDERS_COLUMNS):
        results = _explore_lineage(source, view)

    assert len(results) == 1 and results[0].left is None
    assert _column_pairs(results) == _qualified({("id", "summary_order_id")})
