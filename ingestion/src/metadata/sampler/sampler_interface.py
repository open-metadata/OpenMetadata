#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from typing import Dict, List, Optional, Union

from metadata.ingestion.ometa.ometa_api import OpenMetadata
from sqlalchemy import Column

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.profiler.api.models import ProfilerProcessorConfig, TableConfig
from metadata.profiler.config import (
    get_database_profiler_config,
    get_schema_profiler_config,
)
from metadata.profiler.processor.sample_data_handler import upload_sample_data
from metadata.sampler.config import (
    get_profile_query,
    get_sample_data_count_config,
    get_storage_config_for_table,
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
    """Sampler interface"""

    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        sample_config: Optional[SampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
        storage_config: DataStorageConfig = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ):
        self.ometa_client = ometa_client
        self._sample_rows = None
        self.sample_config = sample_config

        self.entity = entity
        self.profile_sample_query = profile_sample_query
        self.sample_limit = sample_data_count
        self.partition_details = partition_details
        self.storage_config = storage_config

        self.service_connection_config = service_connection_config
        self.connection = get_ssl_connection(self.service_connection_config)
        self.client = self.get_client()

    @classmethod
    def create(
        cls,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        schema_entity: DatabaseSchema,
        database_entity: Database,
        db_service: DatabaseService,
        table_config: TableConfig,
        profiler_config: ProfilerProcessorConfig,
        sample_config: Optional[SampleConfig] = None,
        default_sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ) -> "SamplerInterface":
        """Create sampler"""

        schema_profiler_config = get_schema_profiler_config(schema_entity=schema_entity)
        database_profiler_config = get_database_profiler_config(
            database_entity=database_entity
        )

        storage_config = get_storage_config_for_table(
            entity=entity,
            schema_profiler_config=schema_profiler_config,
            database_profiler_config=database_profiler_config,
            db_service=db_service,
            profiler_config=profiler_config,
        )

        sample_data_count = get_sample_data_count_config(
            entity=entity,
            schema_profiler_config=schema_profiler_config,
            database_profiler_config=database_profiler_config,
            entity_config=table_config,
            default_sample_data_count=default_sample_data_count,
        )

        profile_sample_query = get_profile_query(
            entity=entity, entity_config=table_config
        )

        partition_details = get_partition_details(entity=entity)

        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            sample_config=sample_config,
            partition_details=partition_details,
            profile_sample_query=profile_sample_query,
            storage_config=storage_config,
            sample_data_count=sample_data_count,
            **kwargs,
        )

    @property
    @abstractmethod
    def table(self):
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
    def random_sample(self):
        """Get random sample"""
        raise NotImplementedError

    @abstractmethod
    def fetch_sample_data(
        self, columns: Optional[Union[List[Column], List[SQALikeColumn]]]
    ) -> TableData:
        """Fetch sample data

        Args:
            columns (Optional[List]): List of columns to fetch
        """
        raise NotImplementedError

    @calculate_execution_time(store=False)
    def generate_sample_data(self) -> Optional[TableData]:
        """Fetch and ingest sample data

        Returns:
            TableData: sample data
        """
        try:
            logger.debug(
                "Fetching sample data for "
                f"{self.profiler_interface.table_entity.fullyQualifiedName.root}..."  # type: ignore
            )
            # TODO: GET COLUMNS?
            table_data = self.fetch_sample_data(self.columns)
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
            return None
