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
Catalog and schema names are enumerated from the Databricks workspace, so anyone
with CREATE rights there controls them. Unity Catalog forbids only `.`, space,
`/`, ASCII control characters and DEL, so a name may contain a backtick or a
quote -- the names below are ones a real catalog can carry.
"""

from unittest.mock import MagicMock

from databricks.sqlalchemy.base import DatabricksDialect

from metadata.ingestion.source.database.databricks.connection import (
    DatabricksEngineWrapper,
)
from metadata.ingestion.source.database.databricks.metadata import get_schema_names

HOSTILE_CATALOG = "a`--"
HOSTILE_SCHEMA = "b`--"
# Both characters at once: the quote that closed the old string-literal form
# early, and the backtick the identifier form has to double.
HOSTILE_CATALOG_WITH_QUOTE = "a`'--"


class _FakeResult:
    def fetchmany(self, size):
        return []

    def __iter__(self):
        return iter(())


class _FakeConnection:
    def __init__(self, emitted):
        self.emitted = emitted

    def execute(self, clause):
        self.emitted.append(str(clause))
        return _FakeResult()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class _FakeEngine:
    # The real dialect, so the preparer under test is the production one.
    dialect = DatabricksDialect()

    def __init__(self, emitted):
        self.emitted = emitted

    def connect(self):
        return _FakeConnection(self.emitted)


def _wrapper(emitted) -> DatabricksEngineWrapper:
    borrowed = MagicMock()
    borrowed.client = _FakeEngine(emitted)
    return DatabricksEngineWrapper(borrowed)


def test_use_catalog_quotes_the_catalog_as_an_identifier():
    """`USE CATALOG '<literal>'` closed early on the name's own quote; Databricks
    escapes a string literal with \\' rather than '', so the identifier form is
    used instead -- the same form the two sibling call sites already emit."""
    emitted = []
    get_schema_names(DatabricksDialect(), _FakeConnection(emitted), database=HOSTILE_CATALOG_WITH_QUOTE)

    assert emitted[0] == "USE CATALOG `a``'--`"


def test_engine_wrapper_escapes_backticks_in_catalog_and_schema():
    emitted = []
    wrapper = _wrapper(emitted)
    wrapper.first_catalog = HOSTILE_CATALOG

    wrapper.get_schemas(schema_name=HOSTILE_SCHEMA)
    wrapper.get_tables()
    wrapper.get_views()

    assert emitted == [
        "USE CATALOG `a``--`",
        "SHOW TABLES IN `a``--`.`b``--`",
        "SHOW VIEWS IN `a``--`.`b``--`",
    ]
