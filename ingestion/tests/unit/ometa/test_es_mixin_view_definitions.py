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
"""View definitions read back from the search index."""

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.mixins.es_mixin import ESMixin
from metadata.utils import fqn


class ViewSearchClient:
    """Answers the first search request with one view, and every later one with no hits."""

    def __init__(self, view_fqn):
        self._view_fqn = view_fqn
        self.calls = 0

    def get(self, path):
        self.calls += 1
        if self.calls > 1:
            return {"hits": {"total": {"relation": "eq", "value": 0}, "hits": []}}
        hit = {
            "_index": "table_search_index",
            "_id": "view-id",
            "_source": {"fullyQualifiedName": self._view_fqn, "schemaDefinition": "SELECT 1"},
            "sort": ["view-id"],
        }
        return {"hits": {"total": {"relation": "eq", "value": 1}, "hits": [hit]}}


@pytest.mark.parametrize(
    ("view_fqn", "names"),
    [
        (
            'sample_service.sample_db.reporting."warehouse.orders"',
            ("sample_db", "reporting", "warehouse.orders"),
        ),
        (
            'sample_service."sales.db"."dbo.reporting".orders',
            ("sales.db", "dbo.reporting", "orders"),
        ),
        ("sample_service.sample_db.reporting.orders", ("sample_db", "reporting", "orders")),
    ],
)
def test_view_names_are_unquoted_and_rebuild_the_stored_fqn(view_fqn, names):
    mixin = ESMixin()
    mixin.client = ViewSearchClient(view_fqn)

    (view,) = mixin.yield_es_view_def(service_name="sample_service")

    assert (view.db_name, view.schema_name, view.table_name) == names
    rebuilt = fqn.build(
        None,
        Table,
        service_name="sample_service",
        database_name=view.db_name,
        schema_name=view.schema_name,
        table_name=view.table_name,
        skip_es_search=True,
    )
    assert rebuilt == view_fqn
