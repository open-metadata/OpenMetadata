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

"""Mock entities for StreamingRunner testing.

This module provides minimal mock implementations of OpenMetadata entities
required by PandasTestSuiteInterface for in-memory DataFrame validation.
"""

import uuid
from typing import List

from pandas import DataFrame

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
    LocalConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sampler.models import SampleConfig
from metadata.sampler.sampler_interface import SamplerInterface


class MockDataFrameSampler(SamplerInterface):
    """Minimal sampler implementation that returns DataFrame chunks.

    Used to provide DataFrames to PandasTestSuiteInterface without
    needing real database connections. This mock sampler simply
    returns the DataFrames it was initialized with.

    Attributes:
        dataframes: List of DataFrame chunks to return
        sample_query: Always None for mock sampler
        sample_config: Default empty SampleConfig
        partition_details: Always None for mock sampler
    """

    def __init__(self, dataframes: List[DataFrame]):
        """Initialize with DataFrame chunks.

        Args:
            dataframes: List of DataFrame chunks to return from get_dataset()
        """
        self.dataframes = dataframes
        self.sample_query = None
        self.sample_config = SampleConfig()
        self.partition_details = None

    @property
    def raw_dataset(self):
        """Return first DataFrame as raw dataset."""
        return self.dataframes[0] if self.dataframes else None

    def get_client(self):
        """Return None - no client for mock sampler."""
        return None

    def _rdn_sample_from_user_query(self):
        """Not implemented for mock sampler."""
        return None

    def _fetch_sample_data_from_user_query(self):
        """Not implemented for mock sampler."""
        return None

    def get_dataset(self, **kwargs) -> List[DataFrame]:
        """Return DataFrame chunks.

        Returns:
            List of DataFrame chunks provided at initialization
        """
        return self.dataframes

    def fetch_sample_data(self, columns=None):
        """Not implemented for mock sampler."""
        return None

    def get_columns(self):
        """Return empty list - columns come from DataFrame."""
        return []

    def _compute_table_metrics(self):
        """Not implemented for mock sampler."""
        pass

    def _compute_static_metrics(self):
        """Not implemented for mock sampler."""
        pass

    def _compute_query_metrics(self):
        """Not implemented for mock sampler."""
        pass

    def _compute_window_metrics(self):
        """Not implemented for mock sampler."""
        pass

    def _compute_system_metrics(self):
        """Not implemented for mock sampler."""
        pass

    def get_sample_data(self):
        """Not implemented for mock sampler."""
        pass

    def close(self):
        """Not implemented for mock sampler."""
        pass


def create_mock_table_entity() -> Table:
    """Create minimal Table entity for interface initialization.

    Creates a Table entity with minimal required fields. The entity
    is used by PandasTestSuiteInterface for metadata, but validators
    get column information directly from the DataFrame.

    Returns:
        Table entity with minimal required fields
    """
    database_ref = EntityReference(
        id=uuid.uuid4(),
        type="database",
        name="streaming",
        fullyQualifiedName="streaming.db",
    )

    return Table(
        id=uuid.uuid4(),
        name="dataframe_validation",
        fullyQualifiedName=FullyQualifiedEntityName("streaming.dataframe_validation"),
        columns=[],
        database=database_ref,
    )


def create_mock_datalake_connection() -> DatalakeConnection:
    """Create minimal DatalakeConnection for interface initialization.

    Creates a DatalakeConnection with local file source configuration.
    The connection is used by PandasTestSuiteInterface but actual
    connection testing is skipped for in-memory DataFrames.

    Returns:
        DatalakeConnection with minimal required fields
    """
    return DatalakeConnection(
        configSource=LocalConfig(),
    )
