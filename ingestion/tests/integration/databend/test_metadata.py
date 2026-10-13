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
"""Databend metadata ingestion integration tests."""

import pytest

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def ingest_databend_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
):
    return run_workflow(MetadataWorkflow, ingestion_config)


def test_catalog_database_and_table_hierarchy(
    ingest_databend_metadata,
    db_service,
    metadata,
):
    service_fqn = db_service.fullyQualifiedName.root

    database = metadata.get_by_name(Database, f"{service_fqn}.default")
    database_schema = metadata.get_by_name(DatabaseSchema, f"{service_fqn}.default.analytics")
    table = metadata.get_by_name(Table, f"{service_fqn}.default.analytics.customers")
    view = metadata.get_by_name(Table, f"{service_fqn}.default.analytics.active_customers")

    assert database is not None
    assert database_schema is not None
    assert table is not None
    assert table.tableType == TableType.Regular
    assert [column.name.root for column in table.columns] == ["id", "name", "email"]
    assert view is not None
    assert view.tableType == TableType.View
