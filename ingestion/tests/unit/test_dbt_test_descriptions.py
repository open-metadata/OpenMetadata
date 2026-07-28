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
Tests that dbt test descriptions are resolved from the node meta when the node
has no description of its own, and that the description of an already ingested
test case is kept in sync on re-ingestion.

Regression tests for https://github.com/open-metadata/OpenMetadata/issues/27792
"""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.source.database.dbt.constants import DbtCommonEnum
from metadata.ingestion.source.database.dbt.dbt_utils import get_dbt_test_description
from metadata.ingestion.source.database.dbt.metadata import DbtSource

UPSTREAM_TABLE_FQN = "local_bigquery.ecommerce.dbt_jaffle.dim_customers"
DBT_TEST_CASE_NAME = "unique_dim_customers_customer_id"
DBT_TEST_TYPE = "unique"
TEST_CASE_FQN = f"{UPSTREAM_TABLE_FQN}.customer_id.{DBT_TEST_CASE_NAME}"
NODE_DESCRIPTION = "Customer ids are unique"
META_DESCRIPTION = "Customer ids are unique, from the config block"


def _make_generic_test_node(description=None, meta=None):
    node = MagicMock()
    node.name = DBT_TEST_CASE_NAME
    node.description = description
    node.meta = meta
    node.column_name = "customer_id"
    node.test_metadata.name = DBT_TEST_TYPE
    node.test_metadata.kwargs = {
        "column_name": "customer_id",
        "model": "{{ get_where_subquery(ref('dim_customers')) }}",
    }
    return node


def _make_dbt_test(manifest_node):
    return {
        DbtCommonEnum.MANIFEST_NODE.value: manifest_node,
        DbtCommonEnum.UPSTREAM.value: [UPSTREAM_TABLE_FQN],
    }


def _make_dbt_source(existing_entity=None, update_descriptions=False):
    source = MagicMock(spec=DbtSource)
    for method_name in ("create_dbt_test_case", "create_dbt_tests_definition", "patch_dbt_test_case_description"):
        setattr(source, method_name, getattr(DbtSource, method_name).__get__(source, DbtSource))
    source.metadata = MagicMock()
    source.metadata.get_by_name.return_value = existing_entity
    source.source_config = MagicMock(dbtUpdateDescriptions=update_descriptions)
    return source


def _make_existing_test_case():
    test_case = MagicMock()
    test_case.fullyQualifiedName.root = TEST_CASE_FQN
    return test_case


def _run_create_test_case(source, manifest_node):
    with patch("metadata.ingestion.source.database.dbt.metadata.fqn") as mock_fqn:
        mock_fqn.split.return_value = UPSTREAM_TABLE_FQN.split(".")
        mock_fqn.build.return_value = TEST_CASE_FQN

        return list(source.create_dbt_test_case(_make_dbt_test(manifest_node)))


class TestGetDbtTestDescription:
    def test_node_description_is_used_when_present(self):
        node = _make_generic_test_node(description=NODE_DESCRIPTION, meta={"description": META_DESCRIPTION})

        assert get_dbt_test_description(node) == NODE_DESCRIPTION

    def test_meta_description_is_used_when_node_description_is_empty(self):
        node = _make_generic_test_node(description="", meta={"description": META_DESCRIPTION})

        assert get_dbt_test_description(node) == META_DESCRIPTION

    def test_meta_description_is_used_when_node_description_is_none(self):
        node = _make_generic_test_node(meta={"description": META_DESCRIPTION})

        assert get_dbt_test_description(node) == META_DESCRIPTION

    def test_none_when_neither_description_nor_meta_is_set(self):
        assert get_dbt_test_description(_make_generic_test_node(meta={})) is None

    def test_none_when_meta_has_no_description_key(self):
        assert get_dbt_test_description(_make_generic_test_node(meta={"owner": "data-team"})) is None

    def test_non_dict_meta_is_ignored(self):
        assert get_dbt_test_description(_make_generic_test_node(meta="not-a-dict")) is None


class TestDbtTestCaseDescriptionOnCreate:
    def test_test_case_is_created_with_meta_description(self):
        source = _make_dbt_source()

        results = _run_create_test_case(source, _make_generic_test_node(meta={"description": META_DESCRIPTION}))

        assert len(results) == 1
        assert results[0].left is None, results[0].left
        assert results[0].right.description.root == META_DESCRIPTION
        source.metadata.patch_description.assert_not_called()

    def test_test_definition_is_created_with_meta_description(self):
        source = _make_dbt_source()

        results = list(
            source.create_dbt_tests_definition(
                _make_dbt_test(_make_generic_test_node(meta={"description": META_DESCRIPTION}))
            )
        )

        assert len(results) == 1
        assert results[0].left is None, results[0].left
        assert results[0].right.description.root == META_DESCRIPTION


class TestDbtTestCaseDescriptionOnReIngestion:
    def test_existing_test_case_description_is_patched(self):
        existing_test_case = _make_existing_test_case()
        source = _make_dbt_source(existing_entity=existing_test_case, update_descriptions=True)

        results = _run_create_test_case(source, _make_generic_test_node(description=NODE_DESCRIPTION))

        assert results == []
        source.metadata.patch_description.assert_called_once_with(
            entity=TestCase,
            source=existing_test_case,
            description=NODE_DESCRIPTION,
            force=True,
        )

    def test_existing_test_case_description_is_patched_from_meta(self):
        existing_test_case = _make_existing_test_case()
        source = _make_dbt_source(existing_entity=existing_test_case, update_descriptions=True)

        _run_create_test_case(source, _make_generic_test_node(meta={"description": META_DESCRIPTION}))

        assert source.metadata.patch_description.call_args.kwargs["description"] == META_DESCRIPTION

    def test_existing_description_is_not_forced_when_update_descriptions_is_disabled(self):
        source = _make_dbt_source(existing_entity=_make_existing_test_case(), update_descriptions=False)

        _run_create_test_case(source, _make_generic_test_node(description=NODE_DESCRIPTION))

        assert source.metadata.patch_description.call_args.kwargs["force"] is False

    def test_nothing_is_patched_when_dbt_has_no_description(self):
        source = _make_dbt_source(existing_entity=_make_existing_test_case(), update_descriptions=True)

        _run_create_test_case(source, _make_generic_test_node(meta={}))

        source.metadata.patch_description.assert_not_called()

    def test_existing_test_definition_description_is_never_patched(self):
        source = _make_dbt_source(existing_entity=MagicMock(), update_descriptions=True)

        results = list(
            source.create_dbt_tests_definition(_make_dbt_test(_make_generic_test_node(description=NODE_DESCRIPTION)))
        )

        assert results == []
        source.metadata.patch_description.assert_not_called()
