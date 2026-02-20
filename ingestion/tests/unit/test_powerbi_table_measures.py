import pytest

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.powerbi.models import (
    DatasetExpression,
    PowerBiMeasures,
    PowerBiTable,
    PowerBITableSource,
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
    "multiline_expression_as_list": {
        "input": [
            PowerBiMeasures(
                name="multiline_measure",
                expression=[
                    "",
                    "VAR PL_Net_Selection =",
                    "    SUMX('DB P&L', [Value] * RELATED('Map Account'[Sign]))",
                    "",
                    "RETURN PL_Net_Selection / 1000000",
                ],
                description="Multiline DAX",
                isHidden=False,
            )
        ],
        "expected": [
            Column(
                name="multiline_measure",
                dataType=DataType.MEASURE_VISIBLE,
                dataTypeDisplay=DataType.MEASURE_VISIBLE,
                description=Markdown(
                    "Expression : \nVAR PL_Net_Selection =\n    SUMX('DB P&L', [Value] * RELATED('Map Account'[Sign]))\n\nRETURN PL_Net_Selection / 1000000\n\nDescription : Multiline DAX"
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


def test_powerbi_measures_string_expression():
    measure = PowerBiMeasures(name="test", expression="SUM(Sales)", isHidden=False)
    assert measure.expression == "SUM(Sales)"


def test_powerbi_measures_list_expression():
    measure = PowerBiMeasures(
        name="test",
        expression=["", "VAR x = 1", "RETURN x"],
        isHidden=False,
    )
    assert measure.expression == "\nVAR x = 1\nRETURN x"


def test_powerbi_measures_empty_list_expression():
    measure = PowerBiMeasures(name="test", expression=[], isHidden=False)
    assert measure.expression == ""


def test_powerbi_table_source_string_expression():
    source = PowerBITableSource(expression="SELECT * FROM table")
    assert source.expression == "SELECT * FROM table"


def test_powerbi_table_source_list_expression():
    source = PowerBITableSource(expression=["let", "    Source = ...", "in Source"])
    assert source.expression == "let\n    Source = ...\nin Source"


def test_powerbi_table_source_none_expression():
    source = PowerBITableSource(expression=None)
    assert source.expression is None


def test_dataset_expression_string():
    expr = DatasetExpression(name="test", expression="SUM(Sales)")
    assert expr.expression == "SUM(Sales)"


def test_dataset_expression_list():
    expr = DatasetExpression(name="test", expression=["", "VAR x = 1", "RETURN x"])
    assert expr.expression == "\nVAR x = 1\nRETURN x"


def test_dataset_expression_none():
    expr = DatasetExpression(name="test", expression=None)
    assert expr.expression is None
