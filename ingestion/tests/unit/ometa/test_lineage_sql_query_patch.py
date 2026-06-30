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
Test that a lineage edge's sqlQuery is preserved when patching an existing edge.

Regression for the CTAS lineage gap where the table edge is created but the SQL
query is dropped on subsequent runs because the patch allowlist excluded sqlQuery.
"""

from types import SimpleNamespace
from unittest.mock import Mock

from metadata.generated.schema.type.entityLineage import LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.ingestion.ometa.mixins.lineage_mixin import OMetaLineageMixin

CTAS_QUERY = "CREATE TABLE t AS SELECT * FROM s"


def _fake_ometa():
    """Mixin instance stand-in with only the HTTP client (a boundary) stubbed."""
    return SimpleNamespace(
        client=Mock(),
        _lineage_edge_path_by_name=OMetaLineageMixin._lineage_edge_path_by_name,
    )


class TestLineageSqlQueryPatch:
    """patch_lineage_edge_by_name must carry sqlQuery onto an existing edge."""

    def test_sql_query_is_patched_onto_existing_edge_without_query(self):
        fake = _fake_ometa()
        original = LineageDetails(source=LineageSource.QueryLineage)
        updated = LineageDetails(sqlQuery=CTAS_QUERY, source=LineageSource.QueryLineage)

        OMetaLineageMixin.patch_lineage_edge_by_name(
            fake,
            from_entity_fqn="svc.db.sch.s",
            from_entity_type="table",
            to_entity_fqn="svc.db.sch.t",
            to_entity_type="table",
            original=original,
            updated=updated,
        )

        fake.client.patch.assert_called_once()
        sent = str(fake.client.patch.call_args.kwargs.get("data"))
        assert "sqlQuery" in sent
        assert CTAS_QUERY in sent
