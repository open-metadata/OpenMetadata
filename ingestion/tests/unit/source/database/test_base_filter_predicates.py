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
"""The shared ``DatabaseServiceSource`` filter predicates: pure, FQN-aware,
honoring ``useFqnForFiltering``."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.database_service import DatabaseServiceSource


class _StubSource(DatabaseServiceSource):
    """Concrete stand-in for the ABC so the base predicates can be unit-tested
    directly. Clearing ``__abstractmethods__`` lets ``object.__new__`` build a
    bare instance without implementing the 11 unrelated abstract methods."""


_StubSource.__abstractmethods__ = frozenset()


def _source(use_fqn, database_pattern=None, schema_pattern=None):
    source = object.__new__(_StubSource)
    source.metadata = MagicMock()
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(database_service="svc")
    source.source_config = SimpleNamespace(
        useFqnForFiltering=use_fqn,
        databaseFilterPattern=database_pattern,
        schemaFilterPattern=schema_pattern,
    )
    return source


def test_database_not_filtered_when_pattern_is_none():
    assert _source(use_fqn=False)._is_database_filtered("db") is False


def test_database_filtered_by_bare_name_exclude():
    source = _source(use_fqn=False, database_pattern=FilterPattern(excludes=["db"]))
    assert source._is_database_filtered("db") is True
    assert source._is_database_filtered("other") is False


def test_database_fqn_matching_depends_on_use_fqn_flag():
    # Exclude targets the FQN "svc.db", which only matches when useFqnForFiltering is on.
    pattern = FilterPattern(excludes=["svc.db"])
    assert _source(use_fqn=True, database_pattern=pattern)._is_database_filtered("db") is True
    assert _source(use_fqn=False, database_pattern=pattern)._is_database_filtered("db") is False


def test_schema_not_filtered_when_pattern_is_none():
    assert _source(use_fqn=False)._is_schema_filtered("db", "sch") is False


def test_schema_filtered_by_bare_name_exclude():
    source = _source(use_fqn=False, schema_pattern=FilterPattern(excludes=["sch"]))
    assert source._is_schema_filtered("db", "sch") is True
    assert source._is_schema_filtered("db", "other") is False


def test_schema_fqn_matching_depends_on_use_fqn_flag():
    # Exclude targets the schema FQN "svc.db.sch".
    pattern = FilterPattern(excludes=["svc.db.sch"])
    assert _source(use_fqn=True, schema_pattern=pattern)._is_schema_filtered("db", "sch") is True
    assert _source(use_fqn=False, schema_pattern=pattern)._is_schema_filtered("db", "sch") is False
