import pytest

from _openmetadata_testutils.helpers.markers import xfail_param
from metadata.generated.schema.entity.data.table import TableData


@pytest.mark.parametrize(
    "parameter",
    [
        TableData(
            columns=[],
            rows=[],
        ),
        TableData(
            columns=[],
            rows=[[1]],
        ),
        TableData(
            columns=[],
            rows=[["a"]],
        ),
        TableData(
            columns=[],
            rows=[
                [b"\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"]
            ],
        ),
    ],
)
def test_table_data_serialization(parameter):
    for row in parameter.rows:
        for i, cell in enumerate(row):
            if isinstance(cell, bytes):
                # bytes are written as strings and deserialize as strings
                row[i] = cell.decode("utf-8")
    assert TableData.model_validate_json(parameter.model_dump_json()) == parameter


@pytest.mark.parametrize(
    "parameter",
    [
        xfail_param(
            TableData(
                columns=[],
                rows=[
                    [
                        b"\xe6\x10\x00\x00\x01\x0c\xae\x8b\xfc(\xbc\xe4G@g\xa8\x91\x89\x89\x8a^\xc0"
                    ]
                ],
            ),
            reason="TODO: change TableData.rows to List[List[str]]",
        ),
    ],
)
def test_unserializble(parameter):
    parameter = TableData.model_validate(parameter.model_dump())
    assert TableData.model_validate_json(parameter.model_dump_json()) != parameter
