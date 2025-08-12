import pytest

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    PowerBiMeasures,
    PowerBiTable,
)

test_cases = {
    "visible_measure": {
        "input": [
            PowerBiMeasures(
                name="test_measure",
                expression="SUM(Sales)",
                description="Test Description",
                isHidden=False,
            )
        ],
        "expected": [
            Column(
                name="test_measure",
                dataType=DataType.MEASURE_VISIBLE,
                dataTypeDisplay=DataType.MEASURE_VISIBLE,
                description=Markdown(
                    "Expression : SUM(Sales)\n\nDescription : Test Description"
                ),
            )
        ],
    },
    "hidden_measure": {
        "input": [
            PowerBiMeasures(
                name="hidden_measure",
                expression="AVG(Profit)",
                description="Hidden",
                isHidden=True,
            )
        ],
        "expected": [
            Column(
                name="hidden_measure",
                dataType=DataType.MEASURE_HIDDEN,
                dataTypeDisplay=DataType.MEASURE_HIDDEN,
                description=Markdown(
                    "Expression : AVG(Profit)\n\nDescription : Hidden"
                ),
            )
        ],
    },
    "complex_expression": {
        "input": [
            PowerBiMeasures(
                name="complex_measure",
                expression="SUM(Table[Column]) - SUM(OtherTable[OtherColumn])",
                isHidden=False,
            )
        ],
        "expected": [
            Column(
                name="complex_measure",
                dataType=DataType.MEASURE_VISIBLE,
                dataTypeDisplay=DataType.MEASURE_VISIBLE,
                description=Markdown(
                    "Expression : SUM(Table[Column]) - SUM(OtherTable[OtherColumn])\n\n"
                ),
            )
        ],
    },
}


class MockPowerbiSource(PowerbiSource):
    def __init__(self):
        pass


@pytest.mark.parametrize("test_case_name, test_case", test_cases.items())
def test_get_child_measures(test_case_name, test_case):
    powerbi_source = MockPowerbiSource()
    test_table = PowerBiTable(
        name="test_table",
        measures=test_case["input"],
    )

    result_columns = powerbi_source._get_child_measures(test_table)

    assert result_columns

    for expected_col, actual_col in zip(test_case["expected"], result_columns):
        assert actual_col.name == expected_col.name
        assert actual_col.dataType == expected_col.dataType
        assert actual_col.dataTypeDisplay == expected_col.dataTypeDisplay
        assert actual_col.description == expected_col.description
