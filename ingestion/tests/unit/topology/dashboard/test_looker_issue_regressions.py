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

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.ingestion.source.dashboard.looker.models import LookMlView


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
    source._lookml_constants_map = {}
    source._view_data_model = SimpleNamespace(name="table_details_view")
    return source


@contextmanager
def _stubbed_db_services(
    source: LookerSource,
    lineage_request: object,
    prefixes: Sequence[str] = ("trino_service",),
) -> Iterator[MagicMock]:
    """Stub out everything that needs a live OpenMetadata server and hand back the
    ``build_lineage_request`` mock so tests can assert on the resolved source table."""
    with (
        patch.object(source, "get_db_service_prefixes", return_value=list(prefixes)),
        patch.object(source, "parse_db_service_prefix", side_effect=lambda prefix: (prefix,)),
        patch.object(source, "_get_db_dialect", return_value=Dialect.ANSI),
        patch.object(source, "build_lineage_request", return_value=lineage_request) as build_lineage_request,
    ):
        yield build_lineage_request


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

    assert list(source.list_datamodels()) == [allowed_explore]
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


@pytest.mark.parametrize(
    "sql_table_name",
    [MODEL_CONDITIONAL_TABLE, EXPLORE_CONDITIONAL_TABLE, VIEW_CONDITIONAL_TABLE],
    ids=["_model._name", "_explore._name", "_view._name"],
)
def test_liquid_scopes_select_source_table_for_view_lineage(sql_table_name: str) -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=sql_table_name)
    explore = SimpleNamespace(model_name="finance_reports", name="table_details_explore")
    lineage_request = MagicMock()

    with _stubbed_db_services(source, lineage_request) as build_lineage_request:
        assert list(source.add_view_lineage(view, explore)) == [lineage_request]

    build_lineage_request.assert_called_once_with(
        source="schema_prod.table_name",
        db_service_prefix="trino_service",
        to_entity=source._view_data_model,
        column_lineage=[],
    )


def test_view_lineage_skips_unresolved_lineage_request() -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)
    explore = SimpleNamespace(model_name="finance_reports", name="table_details_explore")

    with _stubbed_db_services(source, lineage_request=None) as build_lineage_request:
        assert list(source.add_view_lineage(view, explore)) == []

    build_lineage_request.assert_called_once()


def test_column_lineage_is_extracted_once_per_view() -> None:
    source = _view_lineage_source()
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)
    explore = SimpleNamespace(model_name="finance_reports", name="table_details_explore")
    lineage_request = MagicMock()

    with (
        patch.object(source, "_extract_column_lineage", return_value=[]) as extract_column_lineage,
        _stubbed_db_services(
            source,
            lineage_request,
            prefixes=("trino_service", "snowflake_service"),
        ) as build_lineage_request,
    ):
        assert list(source.add_view_lineage(view, explore)) == [lineage_request, lineage_request]

    assert build_lineage_request.call_count == 2
    extract_column_lineage.assert_called_once_with(view)


def test_model_liquid_context_selects_source_table_for_standalone_view_lineage() -> None:
    source = object.__new__(LookerSource)
    source._views_cache = {}
    source._parsed_views = {}
    source._lookml_constants_map = {}
    view = LookMlView(name="table_details", sql_table_name=MODEL_CONDITIONAL_TABLE)
    view_data_model = SimpleNamespace(name="finance_reports_table_details_view")
    lineage_request = MagicMock()

    with (
        patch.object(source, "_build_data_model", return_value=view_data_model),
        _stubbed_db_services(source, lineage_request) as build_lineage_request,
    ):
        assert list(source._add_standalone_view_lineage(view, "finance_project", "finance_reports")) == [
            lineage_request
        ]

    build_lineage_request.assert_called_once_with(
        source="schema_prod.table_name",
        db_service_prefix="trino_service",
        to_entity=view_data_model,
        column_lineage=[],
    )
