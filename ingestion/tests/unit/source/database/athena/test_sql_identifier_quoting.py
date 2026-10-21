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
Same defect as the Trino and Impala SHOW CREATE VIEW sites: schema and view names
are enumerated from the source system and interpolated into a quoted identifier
without escaping.
"""

from pyathena.sqlalchemy.base import AthenaDialect

from metadata.ingestion.source.database.athena.utils import get_view_definition


class _FakeResult:
    def fetchall(self):
        return []


class _FakeConnection:
    def __init__(self, emitted):
        self.emitted = emitted

    def execute(self, clause):
        self.emitted.append(str(clause))
        return _FakeResult()


def test_show_create_view_escapes_quotes_in_schema_and_view():
    emitted = []

    get_view_definition(AthenaDialect(), _FakeConnection(emitted), 'ev"il', schema='sch"ema')

    assert emitted == ['SHOW CREATE VIEW "sch""ema"."ev""il"']
