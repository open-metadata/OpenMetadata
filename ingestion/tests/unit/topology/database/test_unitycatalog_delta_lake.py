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

from threading import RLock
from unittest.mock import MagicMock, Mock, patch

import pytest
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


def _listed(source, catalog="demo", schema="s"):
    return list(UnitycatalogSource._list_tables(source, catalog, schema))


def _run(table, securable_kind=""):
    source = _make_source()
    with (
        patch(f"{UC_METADATA_MODULE}.fqn") as fqn_mock,
        patch(f"{UC_METADATA_MODULE}.filter_by_table", return_value=False),
    ):
        fqn_mock.build.return_value = f"svc.cat.schema1.{table.name}"
        return list(UnitycatalogSource._process_table(source, table, "cat", "schema1", securable_kind))


def test_list_tables_pairs_every_table_with_its_securable_kind():
    # The whole reason the listing is hand-rolled: TableInfo.from_dict enumerates its
    # fields and securable_kind is not one of them, so the typed listing cannot tell a
    # managed Iceberg table from a Delta one -- both report data_source_format DELTA.
    source = _source_with_pages({"tables": REAL_LIST_ROWS})
    listed = _listed(source, "demo", "om_delta_test_c1b99ed8")
    assert [(table.name, kind) for table, kind in listed] == [
        (row["name"], row["securable_kind"]) for row in REAL_LIST_ROWS
    ]
    assert all(isinstance(table, TableInfo) for table, _ in listed)


def test_list_tables_is_one_call_per_schema():
    # One listing per schema, the same count the SDK's own tables.list made.
    source = _source_with_pages({"tables": REAL_LIST_ROWS})
    _listed(source, "demo", "om_delta_test_c1b99ed8")
    assert source.client.api_client.do.call_count == 1


def test_list_tables_keeps_the_columns_the_sink_needs():
    # yield_table reads table.columns off this listing, so it must not be omitted.
    source = _source_with_pages({"tables": [{"name": "t", "columns": [{"name": "c", "type_text": "int"}]}]})
    [(table, _)] = _listed(source)
    assert [column.name for column in table.columns or []] == ["c"]


def test_list_tables_paginates_with_server_page_size():
    # max_results=0 makes the server paginate with its configured page size; leaving
    # it unset returns every table of the schema at once and OOMs the pod.
    source = _source_with_pages({"tables": REAL_LIST_ROWS})
    _listed(source)
    assert source.client.api_client.do.call_args.kwargs["query"]["max_results"] == 0


def test_list_tables_follows_next_page_token():
    source = _source_with_pages(
        {"tables": [REAL_LIST_ROWS[1]], "next_page_token": "page-2"},
        {"tables": [REAL_LIST_ROWS[2]]},
    )
    assert [table.name for table, _ in _listed(source)] == ["managed_delta", "managed_iceberg"]
    assert source.client.api_client.do.call_count == 2
    assert source.client.api_client.do.call_args_list[1].kwargs["query"]["page_token"] == "page-2"


def test_list_tables_refuses_a_reissued_page_token():
    # A server echoing the same token would otherwise spin this loop forever.
    source = _source_with_pages(
        {"tables": [REAL_LIST_ROWS[1]], "next_page_token": "same"},
        {"tables": [REAL_LIST_ROWS[1]], "next_page_token": "same"},
    )
    with pytest.raises(RuntimeError, match="reissued page token"):
        _listed(source)


def test_list_tables_rejects_a_non_dict_body():
    # do() is typed dict | BinaryIO. A non-dict body carries no next_page_token we
    # can trust, and reading one off it would spin the pagination loop forever.
    source = _make_source()
    source.client.api_client.do = Mock(return_value=MagicMock())
    with pytest.raises(TypeError, match="expected a JSON object"):
        _listed(source)


def test_list_tables_upper_cases_the_securable_kind():
    # The only place the kind is normalised, so the comparisons downstream need not be.
    source = _source_with_pages({"tables": [{"name": "t", "securable_kind": "table_delta_iceberg_managed"}]})
    assert _listed(source) == [(TableInfo.from_dict({"name": "t"}), "TABLE_DELTA_ICEBERG_MANAGED")]


def test_list_tables_tolerates_a_missing_securable_kind():
    source = _source_with_pages({"tables": [{"name": "t"}]})
    assert [kind for _, kind in _listed(source)] == [""]


@pytest.mark.parametrize("row", REAL_LIST_ROWS, ids=[row["name"] for row in REAL_LIST_ROWS])
def test_real_schema_table_types(row):
    assert _run(_table_info(row), row["securable_kind"]) == [(row["name"], EXPECTED_TYPES[row["name"]])]


def test_uniform_iceberg_securable_kind_is_not_iceberg():
    # UniForm generates Iceberg metadata alongside a table that stays Delta Lake,
    # so the TABLE_DELTA_UNIFORM_ICEBERG_* kinds must not be typed Iceberg.
    table = TableInfo(
        name="uniform_external",
        table_type=SdkTableType.EXTERNAL,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, "TABLE_DELTA_UNIFORM_ICEBERG_EXTERNAL") == [("uniform_external", TableType.DeltaLake)]


@pytest.mark.parametrize(
    ("sdk_table_type", "expected"),
    [
        # A table's storage format is a property of the table, not of whether it is
        # managed, so an External Delta table is DeltaLake too -- matching the
        # Databricks connector and the tracking issue's "previously typed as
        # External or Regular is recognized as Delta Lake".
        (SdkTableType.MANAGED, TableType.DeltaLake),
        (SdkTableType.EXTERNAL, TableType.DeltaLake),
    ],
)
def test_delta_format_refines_managed_and_external_tables(sdk_table_type, expected):
    table = TableInfo(
        name="t",
        table_type=sdk_table_type,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table) == [("t", expected)]


@pytest.mark.parametrize("sdk_table_type", [SdkTableType.MANAGED, SdkTableType.EXTERNAL])
def test_iceberg_securable_kind_wins_over_the_delta_format(sdk_table_type):
    # A managed Iceberg table reports data_source_format DELTA, so the Delta branch
    # would swallow it if the kind were not checked first.
    table = TableInfo(name="t", table_type=sdk_table_type, data_source_format=DataSourceFormat.DELTA)
    assert _run(table, "TABLE_DELTA_ICEBERG_MANAGED") == [("t", TableType.Iceberg)]


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


def test_view_not_overridden_by_iceberg_securable_kind():
    table = TableInfo(
        name="v",
        table_type=SdkTableType.VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, "TABLE_DELTA_ICEBERG_MANAGED") == [("v", TableType.View)]


def test_materialized_view_not_overridden_by_delta_format():
    table = TableInfo(
        name="mv",
        table_type=SdkTableType.MATERIALIZED_VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table) == [("mv", TableType.MaterializedView)]


def test_materialized_view_not_overridden_by_iceberg_securable_kind():
    table = TableInfo(
        name="mv",
        table_type=SdkTableType.MATERIALIZED_VIEW,
        data_source_format=DataSourceFormat.DELTA,
    )
    assert _run(table, "TABLE_DELTA_ICEBERG_MANAGED") == [("mv", TableType.MaterializedView)]


@pytest.mark.parametrize("data_source_format", ["DELTA_UNIFORM_ICEBERG", "DELTA_LIVE_TABLE"])
def test_only_the_exact_delta_format_is_delta_lake(data_source_format):
    # Raw strings: databricks-sdk 0.20.0's DataSourceFormat has no DELTA_UNIFORM_*
    # member and a real UniForm table reports plain DELTA, so a prefix match buys
    # nothing and would swallow any future DELTA-prefixed format that is not Delta.
    table = TableInfo(name="t", table_type=SdkTableType.MANAGED, data_source_format=data_source_format)
    assert _run(table) == [("t", TableType.Regular)]


def test_delta_sharing_not_classified_delta_lake():
    # DELTASHARING shares the "DELTA" string prefix but is not a Delta Lake table;
    # a prefix match would mislabel it, so it must keep the default Regular type.
    table = TableInfo(
        name="ds",
        table_type=SdkTableType.MANAGED,
        data_source_format=DataSourceFormat.DELTASHARING,
    )
    assert _run(table) == [("ds", TableType.Regular)]
