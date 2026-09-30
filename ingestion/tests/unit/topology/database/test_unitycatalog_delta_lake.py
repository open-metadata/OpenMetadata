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
"""Unity Catalog Delta Lake detection from the SDK ``data_source_format``."""

from threading import RLock
from unittest.mock import Mock, patch

import pytest
from databricks.sdk.service.catalog import DataSourceFormat, TableInfo
from databricks.sdk.service.catalog import TableType as SdkTableType

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

UC_METADATA_MODULE = "metadata.ingestion.source.database.unitycatalog.metadata"


def _make_source():
    source = Mock()
    source._state_lock = RLock()
    source.config.sourceConfig.config.useFqnForFiltering = False
    return source


def _run(table):
    source = _make_source()
    with (
        patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
        patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=False),
    ):
        fqn_mock.build.return_value = f"svc.cat.schema1.{table.name}"
        return list(UnitycatalogSource._process_table(source, table, "cat", "schema1"))


@pytest.mark.parametrize(
    "sdk_table_type",
    [SdkTableType.MANAGED, SdkTableType.EXTERNAL],
)
def test_delta_format_yields_delta_lake(sdk_table_type):
    table = TableInfo(
        name="t",
        table_type=sdk_table_type,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table) == [("t", TableType.DeltaLake)]


def test_no_format_non_view_stays_regular():
    table = TableInfo(name="t", table_type=SdkTableType.MANAGED, data_source_format=None)
    assert _run(table) == [("t", TableType.Regular)]


def test_view_stays_view_even_with_delta_format():
    table = TableInfo(
        name="v",
        table_type=SdkTableType.VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table) == [("v", TableType.View)]


def test_materialized_view_not_overridden_by_delta_format():
    table = TableInfo(
        name="mv",
        table_type=SdkTableType.MATERIALIZED_VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table) == [("mv", TableType.MaterializedView)]
