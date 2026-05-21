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
Integration test for the YDB metadata ingestion workflow.

Verifies that the directory-as-schema projection lands correctly in OM:

- root-level ``orders`` → schema "default"
- ``raw/events``        → schema "raw", table "events"
- ``staging/events``    → schema "staging", table "events", tableType=View
- ``marts/analytics/events_by_user`` → schema "marts/analytics", table "events_by_user"
"""

from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow


def test_metadata_ingestion(
    patch_passwords_for_db_services,
    create_test_data,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    run_workflow(MetadataWorkflow, ingestion_config)

    service = db_service.fullyQualifiedName.root

    expected = [
        (f"{service}./local.default.orders", TableType.Regular),
        (f"{service}./local.raw.events", TableType.Regular),
        (f"{service}./local.staging.events", TableType.View),
        (f"{service}./local.marts/analytics.events_by_user", TableType.View),
    ]

    for fqn, expected_type in expected:
        table = metadata.get_by_name(entity=Table, fqn=fqn)
        assert table is not None, f"Table {fqn} not ingested"
        assert table.tableType == expected_type, (
            f"{fqn}: expected {expected_type}, got {table.tableType}"
        )
        assert table.columns, f"{fqn}: ingested with zero columns"
