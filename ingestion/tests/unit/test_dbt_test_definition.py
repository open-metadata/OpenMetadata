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
Tests that dbt test cases reference the dbt test type
(manifest_node.test_metadata.name, e.g. "unique") as their TestDefinition
instead of the per-test-case node name (e.g. "unique_dim_customers_customer_id").

Regression tests for https://github.com/open-metadata/OpenMetadata/issues/28710
"""

from unittest.mock import MagicMock, patch

from metadata.ingestion.source.database.dbt.constants import DbtCommonEnum
from metadata.ingestion.source.database.dbt.dbt_utils import get_dbt_test_definition_name
from metadata.ingestion.source.database.dbt.metadata import DbtSource

UPSTREAM_TABLE_FQN = "local_bigquery.ecommerce.dbt_jaffle.dim_customers"
DBT_TEST_CASE_NAME = "unique_dim_customers_customer_id"
DBT_TEST_TYPE = "unique"
SINGULAR_TEST_NAME = "assert_total_payment_amount_is_positive"


def _make_generic_test_node():
    node = MagicMock()
    node.name = DBT_TEST_CASE_NAME
    node.description = None
    node.column_name = "customer_id"
    node.test_metadata.name = DBT_TEST_TYPE
    node.test_metadata.kwargs = {
        "column_name": "customer_id",
        "model": "{{ get_where_subquery(ref('dim_customers')) }}",
    }
    return node


def _make_singular_test_node():
    node = MagicMock(spec=["name", "description"])
    node.name = SINGULAR_TEST_NAME
    node.description = None
    return node


def _make_dbt_test(manifest_node):
    return {
        DbtCommonEnum.MANIFEST_NODE.value: manifest_node,
        DbtCommonEnum.UPSTREAM.value: [UPSTREAM_TABLE_FQN],
    }


def _make_dbt_source(bound_method_name, existing_test_definition=None):
    source = MagicMock(spec=DbtSource)
    bound = getattr(DbtSource, bound_method_name).__get__(source, DbtSource)
    setattr(source, bound_method_name, bound)
    source.metadata = MagicMock()
    source.metadata.get_by_name.return_value = existing_test_definition
    return source


class TestGetDbtTestDefinitionName:
    def test_generic_test_returns_test_type(self):
        assert get_dbt_test_definition_name(_make_generic_test_node()) == DBT_TEST_TYPE

    def test_singular_test_falls_back_to_node_name(self):
        assert get_dbt_test_definition_name(_make_singular_test_node()) == SINGULAR_TEST_NAME


class TestDbtTestDefinitionFromTestType:
    def test_test_case_uses_dbt_test_type_as_test_definition(self):
        source = _make_dbt_source("create_dbt_test_case")

        with patch("metadata.ingestion.source.database.dbt.metadata.fqn") as mock_fqn:
            mock_fqn.split.return_value = UPSTREAM_TABLE_FQN.split(".")
            mock_fqn.build.return_value = f"{UPSTREAM_TABLE_FQN}.customer_id.{DBT_TEST_CASE_NAME}"
            results = list(source.create_dbt_test_case(_make_dbt_test(_make_generic_test_node())))

        assert len(results) == 1
        assert results[0].left is None, results[0].left
        request = results[0].right

        assert request.name.root == DBT_TEST_CASE_NAME
        assert request.testDefinition.root == DBT_TEST_TYPE

    def test_test_case_for_singular_test_falls_back_to_node_name(self):
        source = _make_dbt_source("create_dbt_test_case")

        with patch("metadata.ingestion.source.database.dbt.metadata.fqn") as mock_fqn:
            mock_fqn.split.return_value = UPSTREAM_TABLE_FQN.split(".")
            mock_fqn.build.return_value = f"{UPSTREAM_TABLE_FQN}.{SINGULAR_TEST_NAME}"
            results = list(source.create_dbt_test_case(_make_dbt_test(_make_singular_test_node())))

        assert len(results) == 1
        assert results[0].left is None, results[0].left
        request = results[0].right

        assert request.name.root == SINGULAR_TEST_NAME
        assert request.testDefinition.root == SINGULAR_TEST_NAME

    def test_test_definition_entity_is_named_after_dbt_test_type(self):
        source = _make_dbt_source("create_dbt_tests_definition")

        results = list(source.create_dbt_tests_definition(_make_dbt_test(_make_generic_test_node())))

        assert len(results) == 1
        assert results[0].left is None, results[0].left
        request = results[0].right

        assert request.name.root == DBT_TEST_TYPE
        source.metadata.get_by_name.assert_called_once()
        assert source.metadata.get_by_name.call_args.kwargs["fqn"] == DBT_TEST_TYPE

    def test_test_definition_not_recreated_when_test_type_exists(self):
        source = _make_dbt_source("create_dbt_tests_definition", existing_test_definition=MagicMock())

        results = list(source.create_dbt_tests_definition(_make_dbt_test(_make_generic_test_node())))

        assert results == []
