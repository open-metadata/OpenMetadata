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
"""LookML view refinements (`view: +name`) in the bulk LookML parser."""

from pathlib import Path

import pytest

from metadata.ingestion.source.dashboard.looker.bulk_parser import BulkLkmlParser
from metadata.ingestion.source.dashboard.looker.measures import _filters_from_lookml
from metadata.readers.file.local import LocalReader
from metadata.utils.singleton import Singleton

ORDERS_VIEW = """
view: orders {
  sql_table_name: raw.orders ;;
  dimension: id {
    label: "Order ID"
    type: number
    sql: ${TABLE}.id ;;
  }
}
"""


@pytest.fixture(autouse=True)
def clear_singleton():
    """BulkLkmlParser is a process-wide singleton"""
    Singleton.clear_all()
    yield
    Singleton.clear_all()


def parse(tmp_path: Path, files: dict[str, str]) -> BulkLkmlParser:
    for name, content in files.items():
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    return BulkLkmlParser(reader=LocalReader(base_path=tmp_path))


def fields(parser: BulkLkmlParser, view_name: str) -> dict:
    view = parser.find_view(view_name)
    return {field.name: field for field in [*view.dimensions, *view.dimension_groups, *view.measures]}


def test_refinement_is_merged_into_its_view(tmp_path):
    parser = parse(
        tmp_path,
        {
            "views/orders.view.lkml": ORDERS_VIEW,
            "views/orders_refinements.view.lkml": """
view: +orders {
  sql_table_name: analytics.orders_clean ;;
  dimension: status { sql: ${TABLE}.status ;; }
}
""",
        },
    )

    view = parser.find_view("orders")
    assert view.name == "orders"
    assert view.sql_table_name == "analytics.orders_clean"
    assert list(fields(parser, "orders")) == ["id", "status"]
    assert view.source_file == str(tmp_path / "views/orders.view.lkml")
    assert parser.find_view("+orders") is None
    assert "+orders" not in parser._views_cache


def test_refinement_in_a_non_view_file(tmp_path):
    parser = parse(
        tmp_path,
        {
            "views/orders.view.lkml": ORDERS_VIEW,
            "refinements/orders.layer.lkml": "view: +orders { sql_table_name: analytics.orders_clean ;; }",
        },
    )

    assert parser.find_view("orders").sql_table_name == "analytics.orders_clean"


def test_refinement_read_before_its_view(tmp_path):
    parser = parse(
        tmp_path,
        {
            "a_refinements.lkml": "view: +orders { sql_table_name: refined ;; }",
            "views/orders.view.lkml": ORDERS_VIEW,
        },
    )

    assert parser.find_view("orders").sql_table_name == "refined"


def test_last_refinement_wins(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": ORDERS_VIEW,
            "refinements.lkml": """
view: +orders { sql_table_name: first ;; }
view: +orders { sql_table_name: second ;; }
""",
        },
    )

    assert parser.find_view("orders").sql_table_name == "second"


def test_refinements_apply_in_path_order(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": ORDERS_VIEW,
            "refinements/b.lkml": "view: +orders { sql_table_name: from_b ;; }",
            "refinements/a.lkml": "view: +orders { sql_table_name: from_a ;; }",
        },
    )

    assert parser.find_view("orders").sql_table_name == "from_b"


def test_refinement_from_another_reader(tmp_path):
    (tmp_path / "primary").mkdir()
    (tmp_path / "primary/refinements.lkml").write_text("view: +orders { sql_table_name: refined ;; }")
    (tmp_path / "other").mkdir()
    (tmp_path / "other/orders.view.lkml").write_text(ORDERS_VIEW)

    parser = BulkLkmlParser(
        reader=LocalReader(base_path=tmp_path / "primary"),
        additional_readers=[LocalReader(base_path=tmp_path / "other")],
    )

    assert parser.find_view("orders").sql_table_name == "refined"


def test_views_are_only_taken_from_view_files(tmp_path):
    parser = parse(
        tmp_path,
        {
            "views/orders.view.lkml": ORDERS_VIEW,
            "zz_legacy.model.lkml": "view: orders { sql_table_name: legacy.orders ;; }",
            "views/orders.view.lkml.bak": "view: orders { sql_table_name: stale.orders ;; }",
        },
    )

    view = parser.find_view("orders")
    assert view.sql_table_name == "raw.orders"
    assert view.source_file == str(tmp_path / "views/orders.view.lkml")


def test_backup_files_are_ignored(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": ORDERS_VIEW,
            "refinements.lkml": "view: +orders { sql_table_name: refined ;; }",
            "refinements.lkml.bak": "view: +orders { sql_table_name: stale ;; }",
        },
    )

    assert parser.find_view("orders").sql_table_name == "refined"


def test_field_refinement_keeps_unset_parameters(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": ORDERS_VIEW,
            "refinements.lkml": 'view: +orders { dimension: id { description: "Primary key" } }',
        },
    )

    field = fields(parser, "orders")["id"]
    assert field.description == "Primary key"
    assert field.label == "Order ID"
    assert field.type == "number"
    assert field.sql == "${TABLE}.id"


def test_field_filters_are_additive(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": """
view: orders {
  measure: n {
    type: count
    filters: [status: "complete"]
  }
}
""",
            "refinements.lkml": 'view: +orders { measure: n { filters: [region: "EU"] } }',
        },
    )

    measure = fields(parser, "orders")["n"]
    assert measure.filters__all == [[{"status": "complete"}], [{"region": "EU"}]]
    assert _filters_from_lookml(measure) == ["status: complete", "region: EU"]


def test_extends_is_additive(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": "view: orders { extends: [base_a] }",
            "refinements.lkml": "view: +orders { extends: [base_b] }",
        },
    )

    assert parser.find_view("orders").extends__all == [["base_a"], ["base_b"]]


def test_derived_table_refinement_keeps_unset_parameters(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": "view: orders { derived_table: { sql: SELECT id FROM raw.orders ;; } }",
            "refinements.lkml": 'view: +orders { description: "Orders PDT" derived_table: { datagroup_trigger: nightly } }',
        },
    )

    view = parser.find_view("orders")
    assert view.description == "Orders PDT"
    assert view.derived_table.sql == "SELECT id FROM raw.orders"


def test_derived_table_refinement_overrides_the_parameters_it_sets(tmp_path):
    parser = parse(
        tmp_path,
        {
            "orders.view.lkml": "view: orders { derived_table: { sql: SELECT id FROM raw.orders ;; } }",
            "refinements.lkml": "view: +orders { derived_table: { sql: SELECT id FROM analytics.orders_clean ;; } }",
        },
    )

    assert parser.find_view("orders").derived_table.sql == "SELECT id FROM analytics.orders_clean"


def test_refinement_without_a_view_is_dropped(tmp_path):
    parser = parse(tmp_path, {"ghost.view.lkml": "view: +ghost { sql_table_name: nowhere ;; }"})

    assert parser._views_cache == {}


def test_imported_project_views_are_refined_but_their_refinements_are_skipped(tmp_path):
    parser = parse(
        tmp_path,
        {
            "imported_projects/shared/views/customers.view.lkml": "view: customers { sql_table_name: raw.customers ;; }",
            "imported_projects/shared/views/orders.view.lkml": ORDERS_VIEW,
            "imported_projects/shared/refinements.lkml": "view: +orders { sql_table_name: imported ;; }",
            "refinements.lkml": "view: +customers { sql_table_name: local.customers ;; }",
        },
    )

    assert parser.find_view("customers").sql_table_name == "local.customers"
    assert parser.find_view("orders").sql_table_name == "raw.orders"
