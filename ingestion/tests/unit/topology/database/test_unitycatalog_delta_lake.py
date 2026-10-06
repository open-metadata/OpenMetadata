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
"""Unity Catalog Delta Lake and Iceberg detection."""

import logging
from threading import RLock
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock, patch

import pytest
from databricks.sdk.errors import NotFound, PermissionDenied
from databricks.sdk.service.catalog import DataSourceFormat, TableInfo
from databricks.sdk.service.catalog import TableType as SdkTableType

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource

UC_METADATA_MODULE = "metadata.ingestion.source.database.unitycatalog.metadata"

# Verbatim rows returned by
# GET /api/2.1/unity-catalog/tables?catalog_name=demo&schema_name=om_delta_test_c1b99ed8
# against a real workspace. managed_iceberg is the reason ``securable_kind`` is
# read at all: the REST payload reports data_source_format DELTA for it exactly
# like a plain Delta table, and databricks-sdk 0.20.0's ``TableInfo`` dataclass
# has no securable_kind field, so the typed listing cannot tell them apart.
REAL_LIST_ROWS = [
    {
        "name": "demo_view",
        "table_type": "VIEW",
        "data_source_format": None,
        "securable_kind": "TABLE_VIEW",
    },
    {
        "name": "managed_delta",
        "table_type": "MANAGED",
        "data_source_format": "DELTA",
        "securable_kind": "TABLE_DELTA",
    },
    {
        "name": "managed_iceberg",
        "table_type": "MANAGED",
        "data_source_format": "DELTA",
        "securable_kind": "TABLE_DELTA_ICEBERG_MANAGED",
    },
    {
        "name": "partitioned_delta",
        "table_type": "MANAGED",
        "data_source_format": "DELTA",
        "securable_kind": "TABLE_DELTA",
    },
    {
        "name": "preflight_probe",
        "table_type": "MANAGED",
        "data_source_format": "DELTA",
        "securable_kind": "TABLE_DELTA",
    },
    {
        "name": "uniform_delta",
        "table_type": "MANAGED",
        "data_source_format": "DELTA",
        "securable_kind": "TABLE_DELTA",
    },
]

EXPECTED_TYPES = {
    "demo_view": TableType.View,
    "managed_delta": TableType.DeltaLake,
    "managed_iceberg": TableType.Iceberg,
    "partitioned_delta": TableType.DeltaLake,
    "preflight_probe": TableType.DeltaLake,
    "uniform_delta": TableType.DeltaLake,
}


def _make_source():
    source = Mock()
    source._state_lock = RLock()
    source.config.sourceConfig.config.useFqnForFiltering = False
    # Mock() answers any attribute with a truthy Mock, so the real __init__ default
    # has to be restated here or the very first lookup would read as unavailable.
    source._iceberg_lookup_unavailable = False
    return source


def _source_with_pages(*pages):
    source = _make_source()
    source.client.api_client.do = Mock(side_effect=list(pages))
    return source


def _table_info(row):
    dsf = row["data_source_format"]
    return TableInfo(
        name=row["name"],
        table_type=SdkTableType(row["table_type"]),
        data_source_format=DataSourceFormat(dsf) if dsf else None,
    )


def _run(table, iceberg_table_names):
    source = _make_source()
    with (
        patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
        patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=False),
    ):
        fqn_mock.build.return_value = f"svc.cat.schema1.{table.name}"
        return list(UnitycatalogSource._process_table(source, table, "cat", "schema1", iceberg_table_names))


def test_iceberg_table_names_from_real_payload():
    source = _source_with_pages({"tables": REAL_LIST_ROWS})
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "om_delta_test_c1b99ed8") == {"managed_iceberg"}


def test_iceberg_lookup_is_one_call_per_schema():
    source = _source_with_pages({"tables": REAL_LIST_ROWS})
    UnitycatalogSource._iceberg_table_names(source, "demo", "om_delta_test_c1b99ed8")
    assert source.client.api_client.do.call_count == 1


def test_iceberg_lookup_omits_columns_and_properties():
    # The lookup reads name + securable_kind only. Without these flags the server
    # ships every column and every property of every table in the schema.
    source = _source_with_pages({"tables": REAL_LIST_ROWS})
    UnitycatalogSource._iceberg_table_names(source, "demo", "s")
    query = source.client.api_client.do.call_args.kwargs["query"]
    assert query["omit_columns"] is True
    assert query["omit_properties"] is True


@pytest.mark.parametrize("row", REAL_LIST_ROWS, ids=[row["name"] for row in REAL_LIST_ROWS])
def test_real_schema_table_types(row):
    assert _run(_table_info(row), {"managed_iceberg"}) == [(row["name"], EXPECTED_TYPES[row["name"]])]


def test_iceberg_table_names_follows_next_page_token():
    source = _source_with_pages(
        {"tables": [REAL_LIST_ROWS[1]], "next_page_token": "page-2"},
        {"tables": [REAL_LIST_ROWS[2]]},
    )
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s") == {"managed_iceberg"}
    assert source.client.api_client.do.call_count == 2
    assert source.client.api_client.do.call_args_list[1].kwargs["query"]["page_token"] == "page-2"


def test_iceberg_table_names_none_on_non_dict_response(caplog):
    # A non-JSON-object body carries no next_page_token worth trusting; reading
    # one off it anyway spins the pagination loop forever.
    source = _make_source()
    source.client.api_client.do = Mock(return_value=MagicMock())
    with caplog.at_level(logging.WARNING):
        assert UnitycatalogSource._iceberg_table_names(source, "demo", "s") is None
    assert "Could not list Iceberg tables" in caplog.text


def test_iceberg_table_names_none_and_warns_on_error(caplog):
    source = _make_source()
    source.client.api_client.do = Mock(side_effect=RuntimeError("boom"))
    with caplog.at_level(logging.WARNING):
        assert UnitycatalogSource._iceberg_table_names(source, "demo", "s") is None
    assert "boom" in caplog.text
    # A log line alone leaves the workflow report claiming a clean run.
    assert source.status.warning.call_count == 1


def test_transient_failure_is_scoped_to_its_own_schema():
    # A 500 or a timeout on one schema says nothing about the next one; latching on
    # it would silently drop storage-format detection for the whole rest of the run.
    source = _source_with_pages(RuntimeError("boom"), {"tables": REAL_LIST_ROWS})
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s1") is None
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s2") == {"managed_iceberg"}
    assert source.client.api_client.do.call_count == 2


def _error_with(**attrs):
    error = RuntimeError("denied")
    for name, value in attrs.items():
        setattr(error, name, value)
    return error


@pytest.mark.parametrize(
    "error",
    [
        NotFound("endpoint does not exist"),
        _error_with(error_code="NOT_FOUND"),
        _error_with(response=SimpleNamespace(status_code=404)),
    ],
    ids=["sdk-404", "code-missing", "http-404"],
)
def test_missing_endpoint_failure_latches(error):
    # An older Unity Catalog has no such REST route at all, so it 404s for every
    # schema, and each attempt burns the full SDK retry budget.
    source = _make_source()
    source.client.api_client.do = Mock(side_effect=error)
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s1") is None
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s2") is None
    assert source.client.api_client.do.call_count == 1
    assert source.status.warning.call_count == 1


@pytest.mark.parametrize(
    "error",
    [
        PermissionDenied("no access to the tables endpoint"),
        _error_with(error_code="PERMISSION_DENIED"),
        _error_with(response=SimpleNamespace(status_code=403)),
    ],
    ids=["sdk-403", "code-denied", "http-403"],
)
def test_permission_failure_is_scoped_to_its_schema(error):
    # Unity Catalog grants are per-securable, so a denial on one schema says nothing
    # about the next; latching on it drops Delta detection for fully-granted schemas.
    source = _source_with_pages(error, {"tables": REAL_LIST_ROWS})
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s1") is None
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s2") == {"managed_iceberg"}
    assert source.client.api_client.do.call_count == 2
    assert source.status.warning.call_count == 1


@pytest.mark.parametrize(
    ("sdk_table_type", "expected"),
    [
        (SdkTableType.MANAGED, TableType.Regular),
        (SdkTableType.EXTERNAL, TableType.External),
    ],
)
def test_failed_iceberg_lookup_makes_no_delta_lake_guess(sdk_table_type, expected):
    # The Iceberg listing failed, so DELTA could mean either Delta Lake or a
    # managed Iceberg table; guessing DeltaLake would relabel Iceberg tables.
    table = TableInfo(name="t", table_type=sdk_table_type, data_source_format=DataSourceFormat.DELTA)
    assert _run(table, None) == [("t", expected)]


def test_uniform_iceberg_securable_kind_is_not_iceberg():
    # UniForm generates Iceberg metadata alongside a table that stays Delta Lake,
    # so the TABLE_DELTA_UNIFORM_ICEBERG_* kinds must not be typed Iceberg.
    source = _source_with_pages(
        {
            "tables": [
                {
                    "name": "uniform_external",
                    "table_type": "EXTERNAL",
                    "data_source_format": "DELTA",
                    "securable_kind": "TABLE_DELTA_UNIFORM_ICEBERG_EXTERNAL",
                }
            ]
        }
    )
    assert UnitycatalogSource._iceberg_table_names(source, "demo", "s") == set()


@pytest.mark.parametrize(
    ("sdk_table_type", "expected"),
    [
        # Only a managed (Regular) table is refined to DeltaLake; an External
        # table keeps External so re-ingest never silently flips its type.
        (SdkTableType.MANAGED, TableType.DeltaLake),
        (SdkTableType.EXTERNAL, TableType.External),
    ],
)
def test_delta_format_refines_only_regular_tables(sdk_table_type, expected):
    table = TableInfo(
        name="t",
        table_type=sdk_table_type,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, set()) == [("t", expected)]


def test_no_format_non_view_stays_regular():
    table = TableInfo(name="t", table_type=SdkTableType.MANAGED, data_source_format=None)
    assert _run(table, set()) == [("t", TableType.Regular)]


def test_view_stays_view_even_with_delta_format():
    table = TableInfo(
        name="v",
        table_type=SdkTableType.VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, set()) == [("v", TableType.View)]


def test_view_not_overridden_by_iceberg_securable_kind():
    table = TableInfo(
        name="v",
        table_type=SdkTableType.VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, {"v"}) == [("v", TableType.View)]


def test_materialized_view_not_overridden_by_delta_format():
    table = TableInfo(
        name="mv",
        table_type=SdkTableType.MATERIALIZED_VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, set()) == [("mv", TableType.MaterializedView)]


def test_materialized_view_not_overridden_by_iceberg_securable_kind():
    table = TableInfo(
        name="mv",
        table_type=SdkTableType.MATERIALIZED_VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, {"mv"}) == [("mv", TableType.MaterializedView)]


@pytest.mark.parametrize("data_source_format", ["DELTA_UNIFORM_ICEBERG", "DELTA_LIVE_TABLE"])
def test_only_the_exact_delta_format_is_delta_lake(data_source_format):
    # Raw strings: databricks-sdk 0.20.0's DataSourceFormat has no DELTA_UNIFORM_*
    # member and a real UniForm table reports plain DELTA, so a prefix match buys
    # nothing and would swallow any future DELTA-prefixed format that is not Delta.
    table = TableInfo(name="t", table_type=SdkTableType.MANAGED, data_source_format=data_source_format)
    assert _run(table, set()) == [("t", TableType.Regular)]


def test_delta_sharing_not_classified_delta_lake():
    # DELTASHARING shares the "DELTA" string prefix but is not a Delta Lake table;
    # a prefix match would mislabel it, so it must keep the default Regular type.
    table = TableInfo(
        name="ds",
        table_type=SdkTableType.MANAGED,
        data_source_format=DataSourceFormat.DELTASHARING,
    )
    assert _run(table, set()) == [("ds", TableType.Regular)]
