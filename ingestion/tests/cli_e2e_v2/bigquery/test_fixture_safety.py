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
"""Live BigQuery dataset isolation, owned cleanup and helper scoping (no OpenMetadata server)."""

import pytest
from google.api_core.exceptions import NotFound

from . import source as source_module
from .source import DATASET_LABELS, fresh_bigquery_source


def _count(source, table):
    return next(iter(source.run(f"SELECT COUNT(*) AS n FROM {source.qualified}.{table}").result())).n


def _assert_removed(project, dataset):
    with pytest.raises(NotFound):
        project.client.get_dataset(f"{project.project_id}.{dataset}")


def test_sources_isolate_mutations_and_cleanup(bigquery_instance):
    project = bigquery_instance.primary
    with fresh_bigquery_source(project, bigquery_instance.location) as source_b:
        with fresh_bigquery_source(project, bigquery_instance.location) as source_a:
            assert source_a.dataset != source_b.dataset
            dataset = project.client.get_dataset(f"{project.project_id}.{source_a.dataset}")
            assert dataset.labels == DATASET_LABELS
            assert dataset.default_table_expiration_ms is not None
            assert dataset.location == bigquery_instance.location
            source_a.set_value("customers", 1, "credit_score", 999)
            source_a.drop_table("all_types")
            credit = source_a.run(f"SELECT credit_score FROM {source_a.qualified}.customers WHERE id = 1").result()
            assert [row.credit_score for row in credit] == [999]
            with pytest.raises(KeyError):
                source_a.drop_table(f"{source_b.dataset}.all_types")
            with pytest.raises(KeyError):
                source_a.set_value("customers", 1, "not_a_column", 1)
            with pytest.raises(ValueError, match="Expected one"):
                source_a.set_value("customers", 999, "credit_score", 1)
            assert _count(source_b, "all_types") == 3
        _assert_removed(project, source_a.dataset)
        with pytest.raises(ValueError, match="already been closed"):
            source_a.run("SELECT 1")
        assert _count(source_b, "customers") == 5
    _assert_removed(project, source_b.dataset)


def test_both_projects_are_writable(bigquery_instance, bigquery_source, bigquery_secondary_source):
    assert bigquery_source.project_id == bigquery_instance.primary.project_id
    assert bigquery_secondary_source.project_id == bigquery_instance.secondary.project_id
    for source in (bigquery_source, bigquery_secondary_source):
        assert _count(source, "customers") == 5
        assert _count(source, "transactions") == 5
        assert _count(source, "all_types") == 3


def test_seed_failure_removes_dataset(bigquery_instance, monkeypatch):
    allocated = []
    seed = source_module._seed_source

    def fail_after_seed(source):
        allocated.append(source.dataset)
        seed(source)
        raise RuntimeError("injected seed failure")

    monkeypatch.setattr(source_module, "_seed_source", fail_after_seed)
    with (
        pytest.raises(RuntimeError, match="injected seed failure"),
        fresh_bigquery_source(bigquery_instance.primary, bigquery_instance.location),
    ):
        pytest.fail("Setup should not yield")
    assert len(allocated) == 1
    _assert_removed(bigquery_instance.primary, allocated[0])


def test_declared_constraints_are_visible_to_information_schema(bigquery_source):
    """The FK scenario is meaningless unless BigQuery itself reports the NOT ENFORCED keys."""
    rows = bigquery_source.run(
        "SELECT table_name, constraint_type "
        f"FROM {bigquery_source.qualified}.INFORMATION_SCHEMA.TABLE_CONSTRAINTS ORDER BY table_name, constraint_type"
    ).result()
    assert {(row.table_name, row.constraint_type) for row in rows} == {
        ("all_types", "PRIMARY KEY"),
        ("customers", "PRIMARY KEY"),
        ("transactions", "FOREIGN KEY"),
        ("transactions", "PRIMARY KEY"),
    }
