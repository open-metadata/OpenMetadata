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
End-to-end coverage for Oracle Global Temporary Table (GTT) ingestion.

GTTs have permanent definitions in the Oracle data dictionary (their
DURATION column is SYS$SESSION or SYS$TRANSACTION), so they CAN be
ingested — only the data is session-scoped. The connector excludes them
by default and only fetches them when includeTemporaryTables=true,
tagging them as TableType.Local.
"""
import pytest

from ingestion.tests.integration.oracle.conftest import (
    REGULAR_TABLE,
    SESSION_GTT,
    TRANSACTION_GTT,
)
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.workflow.metadata import MetadataWorkflow


def _run_workflow(workflow_config):
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()


def _table_fqn(service_name, table_name):
    return f"{service_name}.default.test.{table_name.upper()}"


def _get_table(metadata, service_name, table_name):
    return metadata.get_by_name(
        Table, _table_fqn(service_name, table_name), fields=["columns"]
    )


@pytest.fixture(scope="package")
def ingested_with_flag_off(oracle_gtt_container, gtt_workflow_configs):
    service_name, config = gtt_workflow_configs["off"]
    _run_workflow(config)
    return service_name


@pytest.fixture(scope="package")
def ingested_with_flag_on(oracle_gtt_container, gtt_workflow_configs):
    service_name, config = gtt_workflow_configs["on"]
    _run_workflow(config)
    return service_name


def test_gtts_excluded_by_default(metadata, ingested_with_flag_off):
    """With includeTemporaryTables=false, only the regular table is ingested."""
    assert _get_table(metadata, ingested_with_flag_off, REGULAR_TABLE) is not None
    assert _get_table(metadata, ingested_with_flag_off, SESSION_GTT) is None
    assert _get_table(metadata, ingested_with_flag_off, TRANSACTION_GTT) is None


def test_gtts_ingested_when_flag_enabled(metadata, ingested_with_flag_on):
    """With includeTemporaryTables=true, regular table and both GTTs are ingested."""
    assert _get_table(metadata, ingested_with_flag_on, REGULAR_TABLE) is not None
    assert _get_table(metadata, ingested_with_flag_on, SESSION_GTT) is not None
    assert _get_table(metadata, ingested_with_flag_on, TRANSACTION_GTT) is not None


def test_gtts_carry_local_table_type(metadata, ingested_with_flag_on):
    """GTTs are surfaced with TableType.Local; regular tables stay Regular."""
    assert (
        _get_table(metadata, ingested_with_flag_on, REGULAR_TABLE).tableType
        == TableType.Regular
    )
    assert (
        _get_table(metadata, ingested_with_flag_on, SESSION_GTT).tableType
        == TableType.Local
    )
    assert (
        _get_table(metadata, ingested_with_flag_on, TRANSACTION_GTT).tableType
        == TableType.Local
    )


def test_gtt_columns_are_ingested(metadata, ingested_with_flag_on):
    """Columns flow through the existing reflection path for GTTs."""
    session_gtt = _get_table(metadata, ingested_with_flag_on, SESSION_GTT)
    column_names = {c.name.root.lower() for c in session_gtt.columns}
    assert {"user_id", "action_code", "payload"}.issubset(column_names)
