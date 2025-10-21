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

"""Unit tests for mock infrastructure."""

import uuid
from unittest.mock import Mock

import pandas as pd
import pytest

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
    PandasTestSuiteInterface,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sampler.models import SampleConfig
from metadata.sdk.data_quality.mocks.mock_entities import (
    MockDataFrameSampler,
    create_mock_datalake_connection,
    create_mock_table_entity,
)


@pytest.fixture
def sample_dataframes():
    """Create sample DataFrames for testing."""
    df1 = pd.DataFrame(
        {
            "id": [1, 2, 3],
            "name": ["Alice", "Bob", "Charlie"],
            "age": [25, 30, 35],
        }
    )

    df2 = pd.DataFrame(
        {
            "id": [4, 5, 6],
            "name": ["David", "Eve", "Frank"],
            "age": [40, 45, 50],
        }
    )

    return [df1, df2]


@pytest.fixture
def mock_test_case():
    """Create a mock test case for testing."""
    test_definition_ref = EntityReference(
        id=uuid.uuid4(),
        type="testDefinition",
        name="columnValuesToBeNotNull",
        fullyQualifiedName="test.columnValuesToBeNotNull",
    )

    test_suite_ref = EntityReference(
        id=uuid.uuid4(),
        type="testSuite",
        name="test_suite",
        fullyQualifiedName="test.test_suite",
    )

    return TestCase(
        id=uuid.uuid4(),
        name="name_not_null",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.name.name_not_null"),
        testDefinition=test_definition_ref,
        entityLink="<#E::table::test.table::columns::name>",
        testSuite=test_suite_ref,
        parameterValues=[
            TestCaseParameterValue(name="columnName", value="name"),
        ],
    )


def test_mock_dataframe_sampler_initialization(sample_dataframes):
    """Test MockDataFrameSampler can be initialized with DataFrames."""
    sampler = MockDataFrameSampler(sample_dataframes)

    assert sampler.dataframes == sample_dataframes
    assert sampler.sample_query is None
    assert isinstance(sampler.sample_config, SampleConfig)
    assert sampler.partition_details is None


def test_mock_dataframe_sampler_get_dataset(sample_dataframes):
    """Test MockDataFrameSampler returns DataFrames via get_dataset()."""
    sampler = MockDataFrameSampler(sample_dataframes)
    dataset = sampler.get_dataset()

    assert len(dataset) == 2
    assert dataset[0].equals(sample_dataframes[0])
    assert dataset[1].equals(sample_dataframes[1])


def test_mock_dataframe_sampler_empty_list():
    """Test MockDataFrameSampler works with empty DataFrame list."""
    sampler = MockDataFrameSampler([])
    dataset = sampler.get_dataset()

    assert len(dataset) == 0


def test_create_mock_table_entity():
    """Test create_mock_table_entity creates valid Table."""
    table = create_mock_table_entity()

    assert isinstance(table, Table)
    assert table.columns == []
    assert table.database is not None
    assert table.database.type == "database"


def test_create_mock_datalake_connection():
    """Test create_mock_datalake_connection creates valid connection."""
    connection = create_mock_datalake_connection()

    assert isinstance(connection, DatalakeConnection)
    assert connection.configSource is not None


def test_mock_table_entity_is_unique():
    """Test that each call to create_mock_table_entity creates unique IDs."""
    table1 = create_mock_table_entity()
    table2 = create_mock_table_entity()

    assert table1.id != table2.id
    assert table1.database.id != table2.database.id


def test_pandas_test_suite_interface_with_mocks(sample_dataframes):
    """Integration test: PandasTestSuiteInterface works with mocks."""
    sampler = MockDataFrameSampler(sample_dataframes)
    table = create_mock_table_entity()
    connection = create_mock_datalake_connection()
    mock_ometa = Mock()

    interface = PandasTestSuiteInterface(
        service_connection_config=connection,
        ometa_client=mock_ometa,
        sampler=sampler,
        table_entity=table,
        validator_builder=ValidatorBuilder,
    )

    assert interface is not None
    assert interface.dataset is not None
    assert len(interface.dataset) == 2


def test_pandas_test_suite_interface_dataset_access(sample_dataframes):
    """Test that PandasTestSuiteInterface can access dataset from mock sampler."""
    sampler = MockDataFrameSampler(sample_dataframes)
    table = create_mock_table_entity()
    connection = create_mock_datalake_connection()
    mock_ometa = Mock()

    interface = PandasTestSuiteInterface(
        service_connection_config=connection,
        ometa_client=mock_ometa,
        sampler=sampler,
        table_entity=table,
        validator_builder=ValidatorBuilder,
    )

    dataset = interface.dataset

    assert len(dataset) == 2
    assert dataset[0].equals(sample_dataframes[0])
    assert dataset[1].equals(sample_dataframes[1])


def test_mock_sampler_with_single_dataframe():
    """Test MockDataFrameSampler with single DataFrame."""
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
    sampler = MockDataFrameSampler([df])

    dataset = sampler.get_dataset()

    assert len(dataset) == 1
    assert dataset[0].equals(df)


def test_mock_sampler_preserves_dataframe_properties():
    """Test that MockDataFrameSampler preserves DataFrame properties."""
    df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]}, index=[10, 20, 30])
    sampler = MockDataFrameSampler([df])

    dataset = sampler.get_dataset()

    assert dataset[0].index.tolist() == [10, 20, 30]
    assert dataset[0].columns.tolist() == ["col1", "col2"]
    assert dataset[0]["col1"].dtype == df["col1"].dtype


def test_mock_entities_minimal_required_fields():
    """Test that mock entities have only minimal required fields."""
    table = create_mock_table_entity()
    connection = create_mock_datalake_connection()

    assert len(table.columns) == 0
    assert connection.configSource is not None
