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

- root-level ``orders`` → schema "<root>"
- ``raw/events``        → schema "raw", table "events"
- ``staging/events``    → schema "staging", table "events", tableType=View
- ``marts/analytics/events_by_user`` → schema "marts/analytics", table "events_by_user"
"""

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
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
        (f"{service}./local.(root).orders", TableType.Regular),
        (f"{service}./local.raw.events", TableType.Regular),
        (f"{service}./local.staging.events", TableType.View),
        (f"{service}./local.marts/analytics.events_by_user", TableType.View),
    ]

    for fqn, expected_type in expected:
        table = metadata.get_by_name(entity=Table, fqn=fqn)
        assert table is not None, f"Table {fqn} not ingested"
        assert table.tableType == expected_type, f"{fqn}: expected {expected_type}, got {table.tableType}"
        assert table.columns, f"{fqn}: ingested with zero columns"


def test_column_types(
    patch_passwords_for_db_services,
    create_test_data,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    """YDB primitive types must map to the expected OM DataType values.

    Mapping exercised here (via ydb-sqlalchemy → SQLAlchemy → OM parser):
      Int64   → INTEGER → DataType.INT
      Double  → FLOAT   → DataType.FLOAT
      Utf8    → TEXT    → DataType.TEXT
      Datetime→ DATETIME→ DataType.DATETIME
    """
    run_workflow(MetadataWorkflow, ingestion_config)

    service = db_service.fullyQualifiedName.root

    orders = metadata.get_by_name(entity=Table, fqn=f"{service}./local.(root).orders")
    assert orders is not None
    orders_by_name = {c.name.root: c for c in orders.columns}
    assert orders_by_name["order_id"].dataType.name.lower() == "int"
    assert orders_by_name["amount"].dataType.name.lower() == "float"

    events = metadata.get_by_name(entity=Table, fqn=f"{service}./local.raw.events")
    assert events is not None
    events_by_name = {c.name.root: c for c in events.columns}
    assert events_by_name["event_id"].dataType.name.lower() == "text"
    assert events_by_name["user_id"].dataType.name.lower() == "text"
    assert events_by_name["ts"].dataType.name.lower() == "datetime"


def test_schema_and_table_counts(
    patch_passwords_for_db_services,
    create_test_data,
    run_workflow,
    ingestion_config,
    metadata,
    db_service,
):
    """The connector must project YDB directories into the expected schema set."""
    run_workflow(MetadataWorkflow, ingestion_config)

    service_fqn = db_service.fullyQualifiedName.root
    db_fqn = f"{service_fqn}./local"

    schemas = metadata.list_all_entities(
        entity=DatabaseSchema,
        params={"database": db_fqn},
    )
    schema_names = {s.name.root for s in schemas}

    assert "(root)" in schema_names, "root-level schema '(root)' missing"
    assert "raw" in schema_names, "schema 'raw' missing"
    assert "staging" in schema_names, "schema 'staging' missing"
    assert "marts/analytics" in schema_names, "nested schema 'marts/analytics' missing"
