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
Unit tests for the Dremio lineage
"""

from unittest.mock import MagicMock

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.dremio.metadata import DremioSource

VIEW_SQL = """
SELECT o.order_id AS id, SUM(l.amount) AS total
FROM "space"."folder"."orders" o
JOIN "space"."folder"."lines" l ON l.order_id = o.order_id
GROUP BY o.order_id
"""


def dremio_source(database: str = "space") -> DremioSource:
    source = DremioSource.__new__(DremioSource)
    source.database = database
    return source


def inspector_returning(view_definition):
    inspector = MagicMock(spec=["get_view_definition"])
    inspector.get_view_definition.return_value = view_definition
    return inspector


class TestViewDefinition:
    def test_view_is_stored_as_a_create_view_statement(self):
        definition = dremio_source().get_schema_definition(
            TableType.View, "totals", "folder", inspector_returning("SELECT 1")
        )

        assert definition == 'CREATE VIEW "totals" AS SELECT 1'

    def test_definition_is_read_with_the_full_path_of_the_schema(self):
        inspector = inspector_returning("SELECT 1")

        dremio_source("space").get_schema_definition(TableType.View, "totals", "folder", inspector)

        inspector.get_view_definition.assert_called_once_with("totals", "space.folder")

    def test_view_name_is_quoted(self):
        definition = dremio_source().get_schema_definition(
            TableType.View, 'my"view', "folder", inspector_returning("SELECT 1")
        )

        assert definition == 'CREATE VIEW "my""view" AS SELECT 1'

    def test_a_missing_definition_stays_missing(self):
        definition = dremio_source().get_schema_definition(
            TableType.View, "totals", "folder", inspector_returning(None)
        )

        assert definition is None

    def test_tables_have_no_definition(self):
        inspector = inspector_returning("SELECT 1")

        definition = dremio_source().get_schema_definition(TableType.Regular, "orders", "folder", inspector)

        assert definition is None
        inspector.get_view_definition.assert_not_called()
