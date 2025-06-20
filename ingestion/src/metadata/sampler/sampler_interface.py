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
"""
Interface for sampler
"""
import traceback
from abc import ABC, abstractmethod
from typing import List, Optional, Set, Union

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import TableConfig
from metadata.profiler.processor.sample_data_handler import upload_sample_data
from metadata.sampler.config import (
    get_exclude_columns,
    get_include_columns,
    get_profile_sample_config,
    get_sample_data_count_config,
    get_sample_query,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.partition import get_partition_details
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.logger import sampler_logger
from metadata.utils.sqa_like_column import SQALikeColumn
from metadata.utils.ssl_manager import get_ssl_connection

logger = sampler_logger()


class SamplerInterface(ABC):
    """Sampler interface
    This should be the entrypoint for computing any metrics that are required downstream for
    data quality, profiling, etc.
    """

    # pylint: disable=too-many-instance-attributes, too-many-arguments
    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        include_columns: Optional[List[ColumnProfilerConfig]] = None,
        exclude_columns: Optional[List[str]] = None,
        sample_config: SampleConfig = SampleConfig(),
        partition_details: Optional[PartitionProfilerConfig] = None,
        sample_query: Optional[str] = None,
        storage_config: Optional[DataStorageConfig] = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **__,
    ):
        self.ometa_client = ometa_client
        self._sample = None
        self._columns: List[SQALikeColumn] = []
        self.sample_config = sample_config

        self.entity = entity
        self.include_columns = include_columns or []
        self.exclude_columns = exclude_columns or []
        self.sample_query = sample_query
        self.sample_limit = sample_data_count
        self.partition_details = partition_details
        self.storage_config = storage_config

        self.service_connection_config = service_connection_config
        self.connection = get_ssl_connection(self.service_connection_config)

    # pylint: disable=too-many-arguments, too-many-locals
    @classmethod
    def create(
        cls,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        schema_entity: DatabaseSchema,
        database_entity: Database,
        table_config: Optional[TableConfig] = None,
        storage_config: Optional[DataStorageConfig] = None,
        default_sample_config: Optional[SampleConfig] = None,
        default_sample_data_count: int = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ) -> "SamplerInterface":
        """Create sampler"""

        sample_data_count = get_sample_data_count_config(
            entity=entity,
            schema_entity=schema_entity,
            database_entity=database_entity,
            entity_config=table_config,
            default_sample_data_count=default_sample_data_count,
        )
        sample_config = get_profile_sample_config(
            entity=entity,
            schema_entity=schema_entity,
            database_entity=database_entity,
            entity_config=table_config,
            default_sample_config=default_sample_config,
        )
        sample_query = get_sample_query(entity=entity, entity_config=table_config)
        partition_details = get_partition_details(
            entity=entity, entity_config=table_config
        )
        include_columns = get_include_columns(entity, entity_config=table_config)
        exclude_columns = get_exclude_columns(entity, entity_config=table_config)

        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            include_columns=include_columns,
            exclude_columns=exclude_columns,
            sample_config=sample_config,
            partition_details=partition_details,
            sample_query=sample_query,
            storage_config=storage_config,
            sample_data_count=sample_data_count,
            **kwargs,
        )

    @property
    def columns(self) -> List[SQALikeColumn]:
        """
        Return the list of columns to profile
        by skipping the columns to ignore.
        """

        if self._columns:
            return self._columns

        if self._get_included_columns():
            self._columns = [
                column
                for column in self.get_columns()
                if column.name in self._get_included_columns()
            ]

        if not self._get_included_columns():
            self._columns = [
                column
                for column in self._columns or self.get_columns()
                if column.name not in self._get_excluded_columns()
            ]

        return self._columns

    def _get_excluded_columns(self) -> Set[str]:
        """Get excluded  columns for table being profiled"""
        if self.exclude_columns:
            return set(self.exclude_columns)
        return set()

    def _get_included_columns(self) -> Set[str]:
        """Get include columns for table being profiled"""
        if self.include_columns:
            return {
                include_col.columnName
                for include_col in self.include_columns
                if include_col.columnName
            }
        return set()

    @property
    @abstractmethod
    def raw_dataset(self):
        """Table object to run the sampling"""
        raise NotImplementedError

    @abstractmethod
    def get_client(self):
        """Get client"""
        raise NotImplementedError

    @abstractmethod
    def _rdn_sample_from_user_query(self):
        """Get random sample from user query"""
        raise NotImplementedError

    @abstractmethod
    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Fetch sample data from user query"""
        raise NotImplementedError

    @abstractmethod
    def get_dataset(self, **kwargs):
        """Get random sample"""
        raise NotImplementedError

    @abstractmethod
    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]]) -> TableData:
        """Fetch sample data

        Args:
            columns (Optional[List]): List of columns to fetch
        """
        raise NotImplementedError

    @abstractmethod
    def get_columns(self) -> List[SQALikeColumn]:
        """get columns"""
        raise NotImplementedError

    @calculate_execution_time(store=False)
    def generate_sample_data(self) -> Optional[TableData]:
        """Fetch and ingest sample data

        Returns:
            TableData: sample data
        """
        try:
            logger.debug(
                f"Fetching sample data for {self.entity.fullyQualifiedName.root}..."
            )
            table_data = self.fetch_sample_data(self.columns)
            # Only store the data if configured to do so
            if self.storage_config:
                upload_sample_data(
                    data=table_data,
                    entity=self.entity,
                    sample_storage_config=self.storage_config,
                )
            table_data.rows = table_data.rows[
                : min(SAMPLE_DATA_DEFAULT_COUNT, self.sample_limit)
            ]
            return table_data

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching sample data: {err}")
            raise err

    def close(self):
        """Default noop"""
