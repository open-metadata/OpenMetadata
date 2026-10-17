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
Tests for TrinoLineageSource._get_cross_database_schema_fqn.

Regression test for https://github.com/open-metadata/OpenMetadata/issues/34279:
databaseSchema.name is a plain str on EntityReference, but the code was calling
.root on it, raising AttributeError for every cross-database lineage run.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.database.trino.lineage import TrinoLineageSource


def _make_source() -> TrinoLineageSource:
    source = TrinoLineageSource.__new__(TrinoLineageSource)
    source.metadata = MagicMock()
    return source


def _table_stub(schema_name: str | None):
    ref = EntityReference(id="00000000-0000-0000-0000-000000000001", type="databaseSchema", name=schema_name)
    table = MagicMock()
    table.databaseSchema = ref
    table.fullyQualifiedName = None
    return table


@pytest.mark.parametrize("schema_name", ["public", "my_schema", "Purchases"])
def test_plain_str_name_does_not_raise(schema_name):
    """databaseSchema.name is a plain str — must not raise AttributeError (issue #34279)."""
    source = _make_source()
    table = _table_stub(schema_name)
    with patch("metadata.utils.fqn.search_database_schema_from_es", return_value=[]):
        result = source._get_cross_database_schema_fqn("svc2.db", table, {})
    # Falls back to constructing an FQN — the schema name must appear in it
    assert result is not None
    assert schema_name.lower() in result.lower()


def test_mapping_entry_returned_verbatim():
    """When the schema name is found in the pre-populated mapping, return its FQN as-is."""
    source = _make_source()
    table = _table_stub("public")
    mapping = {"svc2.db": {"public": "svc2.db.public"}}
    with patch("metadata.utils.fqn.search_database_schema_from_es", return_value=[]):
        result = source._get_cross_database_schema_fqn("svc2.db", table, mapping)
    assert result == "svc2.db.public"


def test_none_schema_name_no_fqn_returns_none():
    """When both databaseSchema.name and fullyQualifiedName are absent, return None."""
    source = _make_source()
    table = MagicMock()
    table.databaseSchema = None
    table.fullyQualifiedName = None
    with patch("metadata.utils.fqn.search_database_schema_from_es", return_value=[]):
        result = source._get_cross_database_schema_fqn("svc2.db", table, {})
    assert result is None
