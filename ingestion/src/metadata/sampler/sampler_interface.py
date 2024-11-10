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

from metadata.generated.schema.entity.services.connections.connectionBasicType import DataStorageConfig


from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import DatabaseServiceProfilerPipeline

from metadata.generated.schema.entity.data.database import DatabaseProfilerConfig

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchemaProfilerConfig
from metadata.profiler.processor.sample_data_handler import upload_sample_data
from metadata.sampler.models import SampleConfig

from metadata.sampler.partition import get_partition_details
from metadata.utils.execution_time_tracker import calculate_execution_time
from metadata.utils.logger import sampler_logger
from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import Table, TableData, PartitionProfilerConfig
from metadata.profiler.api.models import TableConfig
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.sqa_like_column import SQALikeColumn

logger = sampler_logger()


class SamplerInterface(ABC):
    """Sampler interface"""

    def __init__(
        self,
        client,
        table: Table,
        sample_config: Optional[SampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
        storage_config: DataStorageConfig = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
    ):
        self.profile_sample = None
        self.profile_sample_type = None
        if sample_config:
            self.profile_sample = sample_config.profile_sample
            self.profile_sample_type = sample_config.profile_sample_type
        self.client = client
        self.table = table
        self._profile_sample_query = profile_sample_query
        self.sample_limit = sample_data_count
        self._sample_rows = None
        self._partition_details = partition_details
        self.storage_config = storage_config

    @classmethod
    def create(
        cls,
        client,
        table: Table,
        sample_config: Optional[SampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
        storage_config: DataStorageConfig = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
    ) -> "SamplerInterface":
        """Create sampler"""

        return cls(
            client=client,
            table=table,
            sample_config=sample_config,
            partition_details=partition_details,
            profile_sample_query=profile_sample_query,
            storage_config=storage_config,
            sample_data_count=sample_data_count,
        )

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
            table_data = self.fetch_sample_data(
                self.table, self.columns
            )
            upload_sample_data(
                data=table_data, entity=self.table, sample_storage_config=self.storage_config,
            )
            table_data.rows = table_data.rows[
                              : min(
                                  SAMPLE_DATA_DEFAULT_COUNT, self.sample_limit
                              )
                              ]
            return table_data

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching sample data: {err}")
            return None
