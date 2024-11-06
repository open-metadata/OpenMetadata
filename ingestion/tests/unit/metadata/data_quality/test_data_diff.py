from unittest.mock import Mock, patch

import pytest

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
    TableDiffValidator,
    compile_and_clauses,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    ProfileSampleType,
    TableProfilerConfig,
)


@pytest.mark.parametrize(
    "elements, expected",
    [
        ("a", "a"),
        (["a", "b"], "a and b"),
        (["a", ["b", "c"]], "a and (b and c)"),
        (["a", ["b", ["c", "d"]]], "a and (b and (c and d))"),
        (["a", ["b", "c"], "d"], "a and (b and c) and d"),
        ([], ""),
        ("", ""),
        (["a"], "a"),
        ([["a"]], "a"),
        ([["a"]], "a"),
    ],
)
def test_compile_and_clauses(elements, expected):
    assert compile_and_clauses(elements) == expected


@pytest.mark.parametrize(
    "config,expected",
    [
        (
            TableDiffRuntimeParameters.model_construct(
                **{
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleType=ProfileSampleType.PERCENTAGE,
                        profileSample=10,
                    ),
                    "table1": TableParameter.model_construct(
                        **{
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ]
                        }
                    ),
                    "keyColumns": ["id"],
                }
            ),
            "substr(MD5(id || 'a'), 1, 8) < '19999999'",
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleType=ProfileSampleType.PERCENTAGE,
                        profileSample=20,
                    ),
                    "table1": TableParameter.model_construct(
                        **{
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ]
                        }
                    ),
                    "keyColumns": ["id"],
                }
            ),
            "substr(MD5(id || 'a'), 1, 8) < '33333333'",
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleType=ProfileSampleType.PERCENTAGE,
                        profileSample=10,
                    ),
                    "table1": TableParameter.model_construct(
                        **{
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ]
                        }
                    ),
                    "keyColumns": ["id", "name"],
                }
            ),
            "substr(MD5(id || name || 'a'), 1, 8) < '19999999'",
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{
                    "database_service_type": "BigQuery",
                    "table_profile_config": TableProfilerConfig(
                        profileSampleType=ProfileSampleType.ROWS,
                        profileSample=20,
                    ),
                    "table1": TableParameter.model_construct(
                        **{
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ]
                        }
                    ),
                    "keyColumns": ["id", "name"],
                }
            ),
            "substr(MD5(id || name || 'a'), 1, 8) < '0083126e'",
        ),
        (
            TableDiffRuntimeParameters.model_construct(
                **{
                    
                    "table_profile_config": None,
                    "table1": TableParameter.model_construct(
                        **{
                            "columns": [
                                Column(name="id", dataType=DataType.STRING),
                                Column(name="name", dataType=DataType.STRING),
                            ]
                        }
                    ),
                    "keyColumns": ["id", "name"],
                }
            ),
            None,
        ),
    ],
)
def test_sample_where_clauses(config, expected):
    validator = TableDiffValidator(None, None, None)
    validator.runtime_params = config
    if (
        config.table_profile_config
        and config.table_profile_config.profileSampleType == ProfileSampleType.ROWS
    ):
        validator.get_row_count = Mock(return_value=10_000)
    with patch("random.choices", Mock(return_value=["a"])):
        assert validator.sample_where_clause() == expected
