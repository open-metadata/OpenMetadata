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
Base sampler for storage services (S3, GCS, etc.)
"""

from abc import abstractmethod
from typing import Any, List, Optional

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import (
    ColumnProfilerConfig,
    PartitionProfilerConfig,
    TableData,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.storageService import StorageConnection
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    ProcessingEngine,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.sampler.models import SampleConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.datalake.datalake_utils import fetch_dataframe_first_chunk
from metadata.utils.logger import sampler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = sampler_logger()


class StorageSampler(SamplerInterface):
    """
    Base sampler for storage services that reads data from cloud storage buckets
    """

    def __init__(
        self,
        service_connection_config: StorageConnection,
        ometa_client: OpenMetadata,
        entity: Container,
        include_columns: Optional[List[ColumnProfilerConfig]] = None,
        exclude_columns: Optional[List[str]] = None,
        sample_config: SampleConfig = SampleConfig(),
        partition_details: Optional[PartitionProfilerConfig] = None,
        sample_query: Optional[str] = None,
        storage_config: Optional[DataStorageConfig] = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        processing_engine: Optional[ProcessingEngine] = None,
        **kwargs,
    ):
        super().__init__(
            service_connection_config,
            ometa_client,
            entity,
            include_columns,
            exclude_columns,
            sample_config,
            partition_details,
            sample_query,
            storage_config,
            sample_data_count,
            processing_engine,
            **kwargs,
        )
        self.client = self.get_client()

    @classmethod
    def create(
        cls,
        service_connection_config: StorageConnection,
        ometa_client: OpenMetadata,
        entity: Container,
        schema_entity=None,
        database_entity=None,
        table_config=None,
        storage_config: Optional[DataStorageConfig] = None,
        default_sample_config: Optional[SampleConfig] = None,
        default_sample_data_count: int = SAMPLE_DATA_DEFAULT_COUNT,
        processing_engine: Optional[ProcessingEngine] = None,
        **kwargs,
    ) -> "StorageSampler":
        """Create storage sampler instance

        Args:
            service_connection_config: Storage service connection config
            ometa_client: OpenMetadata client
            entity: Container entity to sample
            schema_entity: Ignored for storage samplers (Table-specific)
            database_entity: Ignored for storage samplers (Table-specific)
            table_config: Ignored for storage samplers (Table-specific)
            storage_config: Optional storage config for sample data
            default_sample_config: Default sample config
            default_sample_data_count: Number of rows to sample
            processing_engine: Ignored for storage samplers (Table-specific)
            **kwargs: Additional arguments
        """
        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            sample_config=default_sample_config or SampleConfig(),
            storage_config=storage_config,
            sample_data_count=default_sample_data_count,
            processing_engine=processing_engine,
            **kwargs,
        )

    @property
    def raw_dataset(self):
        """Not used for storage samplers"""
        return None

    @abstractmethod
    def get_client(self) -> Any:
        """Get the storage client (S3, GCS, etc.)"""
        raise NotImplementedError

    @abstractmethod
    def _get_sample_file_path(self) -> Optional[str]:
        """Get a sample file path from the container"""
        raise NotImplementedError

    @abstractmethod
    def _get_bucket_name(self) -> str:
        """Extract bucket name from container FQN"""
        raise NotImplementedError

    @abstractmethod
    def _get_config_source(self):
        """Get the config source for the storage service"""
        raise NotImplementedError

    def _rdn_sample_from_user_query(self):
        """Not supported for storage samplers"""
        raise NotImplementedError("User queries not supported for storage samplers")

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Not supported for storage samplers"""
        raise NotImplementedError("User queries not supported for storage samplers")

    def get_dataset(self, **kwargs):
        """Not used for storage samplers"""
        return None

    def get_columns(self) -> List[SQALikeColumn]:
        """Get columns from container's data model"""
        if self._columns:
            return self._columns

        if not self.entity.dataModel or not self.entity.dataModel.columns:
            logger.warning(f"Container {self.entity.fullyQualifiedName.root} has no data model columns")
            return []

        self._columns = [SQALikeColumn(col.name.root, col.dataType) for col in self.entity.dataModel.columns]
        return self._columns

    def _get_file_format(self) -> Optional[SupportedTypes]:
        """Extract file format from container"""
        if not self.entity.fileFormats or len(self.entity.fileFormats) == 0:
            logger.warning(f"Container {self.entity.fullyQualifiedName.root} has no file formats")
            return None

        file_format = self.entity.fileFormats[0].value
        try:
            return SupportedTypes(file_format)
        except ValueError:
            logger.warning(f"Unsupported file format: {file_format}")
            return None

    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]]) -> TableData:
        """Fetch sample data from storage container"""
        sample_file_path = self._get_sample_file_path()
        if not sample_file_path:
            logger.warning(f"No sample file found for container {self.entity.fullyQualifiedName.root}")
            return TableData(columns=[], rows=[])

        bucket_name = self._get_bucket_name()
        file_format = self._get_file_format()
        if not file_format:
            return TableData(columns=[], rows=[])

        try:
            df_iterator = fetch_dataframe_first_chunk(
                config_source=self._get_config_source(),
                client=self.client,
                file_fqn=DatalakeTableSchemaWrapper(
                    key=sample_file_path,
                    bucket_name=bucket_name,
                    file_extension=file_format,
                ),
                fetch_raw_data=False,
            )

            if df_iterator:
                df = next(df_iterator)
                col_names = [col.name for col in columns] if columns else df.columns.tolist()
                rows = [
                    [self._truncate_cell(cell) for cell in row]
                    for row in df[col_names].values.tolist()[: self.sample_limit]
                ]
                return TableData(columns=col_names, rows=rows)

        except Exception as exc:
            logger.warning(f"Failed to fetch sample data for {self.entity.fullyQualifiedName.root}: {exc}")

        return TableData(columns=[], rows=[])

    def close(self):
        """Nothing to close for storage samplers"""
