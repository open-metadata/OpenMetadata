"""
Resilience tests for the PowerBI connector.

Covers two production failure modes:

1. A single nullable ``name`` in the PowerBI admin scan response must not
   invalidate the whole workspace batch (`Dataflow`, `Dataset`,
   `PowerBIReport`, `PowerBIDashboard`, etc. all accept ``name=None``).
2. PowerBI/DAX names containing ``::`` are sanitized before being sent to
   the OpenMetadata API, which enforces ``^((?!::).)*$`` on column names.
"""

from unittest.mock import MagicMock

import pytest
from pydantic import BaseModel

from metadata.ingestion.source.dashboard.powerbi.metadata import (
    _COLUMN_NAME_REPLACEMENT,
    _INVALID_COLUMN_NAME_FRAGMENT,
    _clean_powerbi_column_name,
)
from metadata.ingestion.source.dashboard.powerbi.models import (
    Dataflow,
    DataflowEntity,
    DataflowEntityAttribute,
    Dataset,
    DatasetExpression,
    Group,
    PowerBiColumns,
    PowerBIDashboard,
    PowerBiMeasureModel,
    PowerBiMeasures,
    PowerBIReport,
    PowerBiTable,
    ReportPage,
    Workspaces,
)

_LOOSENED_MODELS_NAME_FIELD = [
    (PowerBIReport, {"id": "r-1"}, "name"),
    (PowerBiColumns, {}, "name"),
    (PowerBiMeasureModel, {"dataType": "STRING", "dataTypeDisplay": "STRING", "description": ""}, "name"),
    (PowerBiMeasures, {}, "name"),
    (PowerBiTable, {}, "name"),
    (DatasetExpression, {}, "name"),
    (Dataset, {"id": "ds-1"}, "name"),
    (Dataflow, {"objectId": "df-1"}, "name"),
    (ReportPage, {}, "name"),
    (DataflowEntityAttribute, {}, "name"),
    (DataflowEntity, {}, "name"),
]


@pytest.mark.parametrize("model_cls, base_payload, field", _LOOSENED_MODELS_NAME_FIELD)
def test_loosened_name_field_accepts_none(model_cls, base_payload, field):
    """Every loosened model parses cleanly when its ``name`` is null."""
    payload = {**base_payload, field: None}
    instance: BaseModel = model_cls(**payload)
    assert getattr(instance, field) is None


def test_powerbi_dashboard_display_name_accepts_none():
    """`PowerBIDashboard.displayName` is now optional."""
    dashboard = PowerBIDashboard(id="d-1", displayName=None)
    assert dashboard.displayName is None
    assert dashboard.id == "d-1"


def test_workspaces_round_trip_survives_nullable_nested_name():
    """A null ``Dataflow.name`` no longer breaks the parent ``Workspaces`` parse.

    This is the exact failure mode observed in the Novartis log:
    ``workspaces.83.dataflows.17.name: Input should be a valid string``.
    """
    raw = {
        "workspaces": [
            {
                "id": "ws-1",
                "name": "Sales",
                "state": "Active",
                "dataflows": [
                    {"objectId": "df-good", "name": "Customers"},
                    {"objectId": "df-bad", "name": None},
                ],
            }
        ]
    }
    workspaces = Workspaces(**raw)
    assert len(workspaces.workspaces) == 1
    dataflows = workspaces.workspaces[0].dataflows
    assert [df.id for df in dataflows] == ["df-good", "df-bad"]
    assert dataflows[1].name is None


def test_fetch_workspace_scan_result_skips_one_bad_workspace(monkeypatch):
    """A single un-parseable workspace must not drop the rest of the batch."""
    from metadata.ingestion.source.dashboard.powerbi import client as client_module

    api_client = client_module.PowerBiApiClient.__new__(client_module.PowerBiApiClient)
    api_client.client = MagicMock()
    api_client.client._base_url = "https://api.powerbi.com/v1.0"

    api_client.client.get.return_value = {
        "workspaces": [
            {"id": "ws-good", "name": "Good", "state": "Active"},
            {"id": "ws-bad", "name": "Bad", "state": "Active", "dashboards": "not-a-list"},
        ]
    }

    result = api_client.fetch_workspace_scan_result(scan_id="scan-1")

    assert result is not None
    assert [ws.id for ws in result.workspaces] == ["ws-good"]


def test_fetch_workspace_scan_result_handles_empty_response(monkeypatch):
    from metadata.ingestion.source.dashboard.powerbi import client as client_module

    api_client = client_module.PowerBiApiClient.__new__(client_module.PowerBiApiClient)
    api_client.client = MagicMock()
    api_client.client._base_url = "https://api.powerbi.com/v1.0"
    api_client.client.get.return_value = None

    assert api_client.fetch_workspace_scan_result(scan_id="scan-1") is None


@pytest.mark.parametrize(
    "raw_name, expected",
    [
        ("Sales::YTD", "Sales_YTD"),
        ("A::B::C", "A_B_C"),
        ("NoColons", "NoColons"),
        ("", ""),
        (None, None),
        (":single_colon_ok", ":single_colon_ok"),
    ],
)
def test_clean_powerbi_column_name(raw_name, expected):
    assert _clean_powerbi_column_name(raw_name) == expected


def test_clean_powerbi_column_name_truncates_after_replacement():
    """Long names with ``::`` are sanitized AND truncated to 256 chars."""
    raw = ("a::b" * 100)  # 400 chars
    cleaned = _clean_powerbi_column_name(raw)
    assert _INVALID_COLUMN_NAME_FRAGMENT not in cleaned
    assert _COLUMN_NAME_REPLACEMENT in cleaned
    assert len(cleaned) == 256


def test_clean_powerbi_column_name_uses_well_known_constants():
    """The constants used by the sanitizer match the spec contract."""
    assert _INVALID_COLUMN_NAME_FRAGMENT == "::"
    assert _COLUMN_NAME_REPLACEMENT == "_"


def test_loosened_models_preserve_provided_name():
    """Loosening to Optional must not silently change a provided value."""
    ds = Dataset(id="ds-1", name="Orders")
    assert ds.name == "Orders"
    df = Dataflow(objectId="df-1", name="Customers")
    assert df.name == "Customers"


def test_group_with_nameless_dataflow_parses_via_workspaces():
    """End-to-end: the original scan payload shape with a null dataflow name."""
    workspaces = Workspaces(
        workspaces=[
            Group(
                id="ws-1",
                name="WS",
                state="Active",
                dataflows=[Dataflow(objectId="df-1", name=None)],
            )
        ]
    )
    assert workspaces.workspaces[0].dataflows[0].name is None
