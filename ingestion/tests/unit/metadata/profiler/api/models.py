import pytest

from ingestion.src.metadata.generated.schema.entity.data.table import TableData
from ingestion.src.metadata.profiler.api.models import SerializableTableData


@pytest.mark.parametrize(
    "parameter",
    [
        TableData(
            columns=[],
            rows=[],
        )
    ],
)
def test_table_data_serialization(parameter):
    parameter = SerializableTableData.model_validate(parameter.model_dump())
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
