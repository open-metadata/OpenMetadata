import warnings

import pytest

from ingestion.src.metadata.generated.schema.entity.data.table import TableData
from ingestion.src.metadata.profiler.api.models import SerializableTableData


@pytest.mark.parametrize(
    "parameter",
    [
        SerializableTableData(
            columns=[],
            rows=[],
        ),
        SerializableTableData(
            columns=[],
            rows=[[1]],
        ),
        SerializableTableData(
            columns=[],
            rows=[["a"]],
        ),
        SerializableTableData(
            columns=[],
            rows=[
                [b"\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"]
            ],
        ),
    ],
)
def test_table_data_serialization(parameter):
    warnings.warn(UserWarning("api v1, should use functions from v2"))
    for row in parameter.rows:
        for i, cell in enumerate(row):
            if isinstance(cell, bytes):
                # bytes are written as strings and deserialize as strings
                row[i] = cell.decode("utf-8")
    assert (
        SerializableTableData.model_validate_json(parameter.model_dump_json())
        == parameter
    )


@pytest.mark.parametrize(
    "parameter",
    [
        TableData(
            columns=[],
            rows=[
                [
                    b"\xe6\x10\x00\x00\x01\x0c\xae\x8b\xfc(\xbc\xe4G@g\xa8\x91\x89\x89\x8a^\xc0"
                ]
            ],
        ),
    ],
)
def test_unserializble(parameter):
    parameter = SerializableTableData.model_validate(parameter.model_dump())
    assert (
        SerializableTableData.model_validate_json(parameter.model_dump_json())
        != parameter
    )
