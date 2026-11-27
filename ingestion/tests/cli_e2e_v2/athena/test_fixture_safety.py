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
"""Live Glue database and S3 prefix isolation, owned cleanup and helper scoping (no OpenMetadata server)."""

import pytest

from . import source as source_module
from .baseline import DATABASE_DESCRIPTION
from .source import DATABASE_PARAMETERS, fresh_athena_source


def _assert_removed(instance, source):
    with pytest.raises(instance.glue.exceptions.EntityNotFoundException):
        instance.glue.get_database(Name=source.database)
    listed = instance.s3.list_objects_v2(Bucket=source.location.bucket, Prefix=source.location.prefix)
    assert listed.get("KeyCount", 0) == 0, f"objects remain under {source.location.uri}"


def _count(source, table):
    return source.run(f"SELECT COUNT(*) FROM {source.qualified(table)}")[0][0]


def test_sources_isolate_mutations_and_cleanup(athena_instance):
    with fresh_athena_source(athena_instance) as source_b:
        with fresh_athena_source(athena_instance) as source_a:
            assert source_a.database != source_b.database
            assert source_a.location.prefix != source_b.location.prefix
            database = athena_instance.glue.get_database(Name=source_a.database)["Database"]
            assert database["Description"] == DATABASE_DESCRIPTION
            assert database["Parameters"] == DATABASE_PARAMETERS
            source_a.set_value("orders", 1, "status", "refunded")
            source_a.drop_table("sales")
            assert source_a.run(f"SELECT status FROM {source_a.qualified('orders')} WHERE id = 1") == [("refunded",)]
            with pytest.raises(KeyError):
                source_a.drop_table(f"{source_b.database}.sales")
            with pytest.raises(KeyError):
                source_a.set_value("orders", 1, "not_a_column", "x")
            with pytest.raises(ValueError, match="Expected one"):
                source_a.set_value("orders", 999, "status", "x")
            assert _count(source_b, "sales") == 3
        _assert_removed(athena_instance, source_a)
        with pytest.raises(ValueError, match="already been closed"):
            source_a.run("SELECT 1")
        assert source_b.run(f"SELECT status FROM {source_b.qualified('orders')} WHERE id = 1") == [("placed",)]
    _assert_removed(athena_instance, source_b)


def test_seeded_tables_hold_their_declared_rows(athena_source):
    for table in athena_source.baseline.tables:
        assert _count(athena_source, table.name) == len(table.rows), table.name
    assert athena_source.run(f'SELECT COUNT(*) FROM "{athena_source.database}"."view_customers"') == [(5,)]


def test_seed_failure_removes_database_and_prefix(athena_instance, monkeypatch):
    allocated = []
    seed = source_module._seed_source

    def fail_after_seed(source):
        allocated.append(source)
        seed(source)
        raise RuntimeError("injected seed failure")

    monkeypatch.setattr(source_module, "_seed_source", fail_after_seed)
    with pytest.raises(RuntimeError, match="injected seed failure"), fresh_athena_source(athena_instance):
        pytest.fail("Setup should not yield")
    assert len(allocated) == 1
    _assert_removed(athena_instance, allocated[0])
