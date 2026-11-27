#  Copyright 2026 Collate
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
dbt Python models keep their dependency lineage, but their code is never parsed as SQL (#38330)
"""

import logging
from types import SimpleNamespace

import pytest

from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.dbt.constants import DbtCommonEnum
from metadata.ingestion.source.database.dbt.dbt_utils import is_dbt_sql_node

from . import test_dbt as dbt_cases  # noqa: TID252

MODEL_KEY = dbt_cases.TestDbtSourceIdentifiers.MODEL_KEY
PHYSICAL_FQN = dbt_cases.TestDbtSourceIdentifiers.PHYSICAL_FQN
MODEL_FQN = dbt_cases.TestDbtSourceIdentifiers.MODEL_FQN
TEST_KEY = "test.jaffle_shop.not_null_orders_order_id.cf6c17daed"
PYTHON_CODE = (
    "import pandas as pd\n"
    "from pyspark.sql import functions as F\n\n\n"
    "def model(dbt, session):\n"
    '    dbt.config(materialized="table")\n'
    '    return dbt.source("raw", "orders").withColumn("loaded_at", F.current_timestamp())\n'
)


def _as_manifest_version(payload, manifest_version):
    payload["metadata"]["dbt_schema_version"] = f"https://schemas.getdbt.com/dbt/manifest/v{manifest_version}.json"
    if manifest_version < 8:
        for node in [*payload["sources"].values(), *payload["nodes"].values()]:
            node["root_path"] = "/dbt/jaffle_shop"
        model = payload["nodes"][MODEL_KEY]
        model["compiled"] = True
        if manifest_version < 7:
            model["raw_sql"] = model.pop("raw_code")
            model["compiled_sql"] = model.pop("compiled_code")
        else:
            model.setdefault("language", "sql")
    if manifest_version == 12:
        payload.update(groups={}, group_map={}, saved_queries={}, semantic_models={}, unit_tests={})
    return payload


def _payload(language, manifest_version=8, code=None):
    payload = dbt_cases.TestDbtSourceIdentifiers._payload()
    model = payload["nodes"][MODEL_KEY]
    if code is not None:
        model.update(raw_code=code, compiled_code=code, original_file_path="models/orders.py", path="orders.py")
    if language is not None:
        model["language"] = language
    return _as_manifest_version(payload, manifest_version)


def _source():
    source = dbt_cases.TestCatalogMapping._source(PHYSICAL_FQN, MODEL_FQN)
    # a lookup that misses must return None, not a truthy mock, or SqlParse's bogus tables "resolve"
    source.metadata.get_by_name.return_value = None
    source.config = SimpleNamespace(
        serviceName="trino_svc",
        serviceConnection=SimpleNamespace(
            root=SimpleNamespace(config=SimpleNamespace(type=SimpleNamespace(value="BigQuery")))
        ),
    )
    return source


def _model_link(source, payload, **files):
    objects = dbt_cases.TestDbtSourceIdentifiers._objects(source, payload, **files)
    return dbt_cases.TestDbtSourceIdentifiers._links(source, objects)[MODEL_FQN]


class TestDbtModelLanguage:
    @pytest.mark.parametrize(
        ("language", "expected"),
        [
            (None, True),
            ("", True),
            ("sql", True),
            ("SQL", True),
            ("python", False),
            ("Python", False),
            ("java", False),
            (5, False),
        ],
    )
    def test_only_sql_or_unlabelled_nodes_are_sql(self, language, expected):
        assert is_dbt_sql_node(SimpleNamespace(language=language)) is expected

    def test_a_node_without_a_language_field_is_sql(self):
        assert is_dbt_sql_node(SimpleNamespace()) is True

    @pytest.mark.parametrize("manifest_version", [7, 8, 12])
    @pytest.mark.parametrize("language", ["python", "Python"])
    def test_python_model_code_is_not_parsed_as_sql(self, manifest_version, language, caplog):
        source = _source()
        link = _model_link(source, _payload(language, manifest_version, code=PYTHON_CODE))
        source.metadata.es_search_from_fqn.reset_mock()
        source.metadata.get_by_name.reset_mock()
        caplog.clear()

        with caplog.at_level(logging.DEBUG, logger="metadata.Ingestion"):
            lineage = list(source.create_dbt_query_lineage(link))

        assert link.parse_query_lineage is False
        assert lineage == []
        assert any(
            record.getMessage().startswith(f"Skipping query lineage for {MODEL_FQN}: its dbt code is not SQL")
            for record in caplog.records
        )
        assert [record.getMessage() for record in caplog.records if record.levelno >= logging.WARNING] == []
        looked_up = [
            *(call.kwargs.get("fqn_search_string") for call in source.metadata.es_search_from_fqn.call_args_list),
            *(call.kwargs.get("fqn") for call in source.metadata.get_by_name.call_args_list),
        ]
        assert not any("pyspark" in str(table_fqn) for table_fqn in looked_up), looked_up
        assert source.status.failures == []
        assert source.status.warnings == []

    @pytest.mark.parametrize(
        ("manifest_version", "language"), [(4, None), (7, "sql"), (8, None), (8, "sql"), (12, "SQL"), (12, None)]
    )
    def test_sql_model_keeps_query_lineage(self, manifest_version, language):
        source = _source()
        link = _model_link(source, _payload(language, manifest_version))
        assert link.parse_query_lineage is True

        requests = [either.right.lineage_request for either in source.create_dbt_query_lineage(link) if either.right]

        assert [(request.from_entity_fqn, request.to_entity_fqn) for request in requests] == [(PHYSICAL_FQN, MODEL_FQN)]

    def test_python_model_keeps_its_code_and_dependency_lineage(self):
        source = _source()
        link = _model_link(source, _payload("python", code=PYTHON_CODE))

        lineage = list(source.create_dbt_lineage(link))

        assert model_str(link.datamodel.sql) == PYTHON_CODE
        assert model_str(link.datamodel.rawSql) == PYTHON_CODE
        assert [either.right.lineage_request.edge.fromEntity.id.root for either in lineage] == [
            link.upstream_table_ids[PHYSICAL_FQN]
        ]

    def test_test_on_python_model_still_targets_the_model(self):
        source = _source()
        payload = _payload("python", code=PYTHON_CODE)
        payload["nodes"][TEST_KEY] = {
            "test_metadata": {"name": "not_null", "kwargs": {"column_name": "order_id"}, "namespace": None},
            "resource_type": "test",
            "depends_on": {"macros": [], "nodes": [MODEL_KEY]},
            "config": {"materialized": "test", "severity": "ERROR"},
            "database": "RAW_DB",
            "schema": "RAW_dbt_test__audit",
            "fqn": ["jaffle_shop", "not_null_orders_order_id"],
            "unique_id": TEST_KEY,
            "name": "not_null_orders_order_id",
            "alias": "not_null_orders_order_id",
            "package_name": "jaffle_shop",
            "path": "not_null_orders_order_id.sql",
            "original_file_path": "models/schema.yml",
            "checksum": {"name": "none", "checksum": ""},
            "column_name": "order_id",
            "raw_code": "{{ test_not_null(**_dbt_generic_test_kwargs) }}",
            "compiled_code": "select order_id from RAW_DB.RAW.stg_orders where order_id is null",
            "language": "sql",
        }
        run_results = [dbt_cases._run_result_payload("pass", None, "2026-11-01T00:00:00.000000Z", unique_id=TEST_KEY)]

        objects = dbt_cases.TestDbtSourceIdentifiers._objects(source, payload, dbt_run_results=run_results)
        list(source.yield_data_models(objects))

        assert source.context.get().dbt_tests[TEST_KEY][DbtCommonEnum.UPSTREAM.value] == [MODEL_FQN]
