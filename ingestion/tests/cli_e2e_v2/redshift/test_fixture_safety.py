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
"""Real Redshift isolation and cleanup on success and setup failure.

One E2E identity seeds and ingests, as in v1: the cluster is shared, so the suite
creates no database users. Isolation therefore rests on unique owned schemas.
"""

import pytest

from . import source as source_module
from .source import SCHEMA_PREFIX, fresh_redshift_source


def _schema_exists(instance, schema):
    with instance.admin_engine.connect() as connection:
        rows = connection.exec_driver_sql(
            "SELECT nspname FROM pg_namespace WHERE nspname = %(schema)s", {"schema": schema}
        ).all()
    return bool(rows)


def test_sources_isolate_mutations_and_cleanup(redshift_instance):
    with fresh_redshift_source(redshift_instance) as first:
        with fresh_redshift_source(redshift_instance) as second:
            assert first.schema != second.schema
            assert first.schema.startswith(SCHEMA_PREFIX)
            first.set_value("customers", 1, "credit_score", 999)
            first.drop_table("all_datatypes")
            with pytest.raises(KeyError):
                first.drop_table(f"{second.schema}.all_datatypes")
            with pytest.raises(ValueError, match="Expected one"):
                first.set_value("customers", 999, "credit_score", 1)
            assert second.run(f"SELECT credit_score FROM {second.qualified}.customers WHERE id = 1") == [(720,)]
            assert second.run(f"SELECT COUNT(*) FROM {second.qualified}.all_datatypes") == [(1,)]
        assert not _schema_exists(redshift_instance, second.schema)
        assert first.run(f"SELECT COUNT(*) FROM {first.qualified}.customers") == [(5,)]
    assert not _schema_exists(redshift_instance, first.schema)
    with pytest.raises(ValueError, match="already been closed"):
        first.run("SELECT 1")


def test_seed_failure_removes_owned_schema(redshift_instance, monkeypatch):
    allocated = []
    seed = source_module._seed_source

    def fail_after_seed(source):
        allocated.append(source.schema)
        seed(source)
        raise RuntimeError("injected seed failure")

    monkeypatch.setattr(source_module, "_seed_source", fail_after_seed)
    with pytest.raises(RuntimeError, match="injected seed failure"), fresh_redshift_source(redshift_instance):
        pytest.fail("Setup should not yield")
    assert len(allocated) == 1
    assert not _schema_exists(redshift_instance, allocated[0])
