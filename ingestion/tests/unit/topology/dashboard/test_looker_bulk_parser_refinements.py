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
Regression tests for LookML view refinements in BulkLkmlParser (#35684).

Refinements use the `view: +name {}` syntax to extend an existing view:
  - override sql_table_name / derived_table
  - add dimensions, measures, dimension_groups
  - change fields that already exist on the base view

Previously BulkLkmlParser cached `+orders` as a separate view and never
merged it into `orders`.
"""

from pathlib import Path

import pytest

from metadata.ingestion.source.dashboard.looker.bulk_parser import BulkLkmlParser
from metadata.ingestion.source.dashboard.looker.models import ViewName
from metadata.readers.file.local import LocalReader
from metadata.utils.singleton import Singleton

BASE_PATH = Path(__file__).parent.parent.parent / "resources/lkml"


@pytest.fixture(autouse=True)
def clear_singletons():
    """BulkLkmlParser is a singleton: reset it around every test."""
    Singleton.clear_all()
    yield
    Singleton.clear_all()


@pytest.fixture
def parser():
    return BulkLkmlParser(reader=LocalReader(BASE_PATH))


def _write_view(root: Path, name: str, content: str) -> None:
    (root / f"{name}.view.lkml").write_text(content)


def test_refinement_overrides_sql_table_name(parser):
    """`view: +orders` changes sql_table_name from raw.orders to analytics.orders_clean."""
    view = parser.get_view_from_cache(ViewName("orders"))

    assert view is not None
    assert view.sql_table_name == "analytics.orders_clean"


def test_refinement_adds_dimensions_to_base_view(parser):
    """The original `id` dimension is kept and the refinement's `status` is added."""
    view = parser.get_view_from_cache(ViewName("orders"))

    assert view is not None
    dim_names = [d.name for d in view.dimensions]
    assert "id" in dim_names
    assert "status" in dim_names


def test_refinement_view_not_stored_as_separate_cache_entry(parser):
    """`+orders` must not appear as a standalone view in the cache."""
    assert parser.get_view_from_cache(ViewName("+orders")) is None


def test_refinement_updates_existing_field_instead_of_duplicating(tmp_path):
    """Redeclaring an existing field changes it and keeps the attributes it does not set."""
    _write_view(
        tmp_path,
        "users",
        """
        view: users {
          sql_table_name: raw.users ;;
          dimension: id {
            type: number
            sql: ${TABLE}.id ;;
          }
        }
        """,
    )
    _write_view(
        tmp_path,
        "users_refinements",
        """
        view: +users {
          dimension: id {
            description: "Primary key"
          }
        }
        """,
    )

    parser = BulkLkmlParser(reader=LocalReader(tmp_path))
    view = parser.get_view_from_cache(ViewName("users"))

    assert view is not None
    assert [d.name for d in view.dimensions] == ["id"]
    assert view.dimensions[0].description == "Primary key"
    assert view.dimensions[0].type == "number"
    assert view.dimensions[0].sql == "${TABLE}.id"


def test_refinement_of_view_from_additional_reader(tmp_path):
    """A refinement in the primary repository applies to a base view from an imported one."""
    primary = tmp_path / "primary"
    imported = tmp_path / "imported"
    primary.mkdir()
    imported.mkdir()
    _write_view(
        primary,
        "customers_refinements",
        """
        view: +customers {
          sql_table_name: analytics.customers_clean ;;
          dimension: tier {
            type: string
            sql: ${TABLE}.tier ;;
          }
        }
        """,
    )
    _write_view(
        imported,
        "customers",
        """
        view: customers {
          sql_table_name: raw.customers ;;
          dimension: id {
            type: number
            sql: ${TABLE}.id ;;
          }
        }
        """,
    )

    parser = BulkLkmlParser(reader=LocalReader(primary), additional_readers=[LocalReader(imported)])
    view = parser.get_view_from_cache(ViewName("customers"))

    assert view is not None
    assert view.sql_table_name == "analytics.customers_clean"
    assert [d.name for d in view.dimensions] == ["id", "tier"]
    assert parser.get_view_from_cache(ViewName("+customers")) is None
