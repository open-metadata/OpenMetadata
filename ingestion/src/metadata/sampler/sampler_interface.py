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
from functools import cached_property
from typing import Any, List, Optional  # noqa: UP035

from metadata.generated.schema.configuration.profilerConfiguration import (
    SampleDataIngestionConfig,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.types import ClassifiableEntityType
from metadata.profiler.processor.sample_data_handler import upload_sample_data
from metadata.sampler.config import resolve_static_sampling_config
from metadata.sampler.sampler_config import SamplerConfig
from metadata.utils.constants import (
    SAMPLE_DATA_DEFAULT_COUNT,
    SAMPLE_DATA_MAX_CELL_LENGTH,
)
from metadata.utils.logger import sampler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = sampler_logger()


class SamplerInterface(ABC):
    """Sampler interface
    This should be the entrypoint for computing any metrics that are required downstream for
    data quality, profiling, etc.
    """

    def __init__(
        self,
        service_connection_config: Any,
        ometa_client: OpenMetadata,
        entity: ClassifiableEntityType,
        config: Optional[SamplerConfig] = None,  # noqa: UP045
        **__,
    ):
        resolved_config = config or SamplerConfig()
        self.ometa_client = ometa_client
        self.entity = entity
        self.service_connection_config = service_connection_config
        self.sample_config = resolved_config.sample_config
        self.sample_limit = resolved_config.sample_data_count or SAMPLE_DATA_DEFAULT_COUNT
        self.upload_sample_storage_config = resolved_config.upload_sample_storage_config
        self._columns: List[SQALikeColumn] = []  # noqa: UP006
        self._row_count = None
        self._sample_config: StaticSamplingConfig | None = None
        self.partition_details: Any = None
        self.sample_query: Optional[str] = None  # noqa: UP045

    @classmethod
    def create(
        cls,
        service_connection_config: Any,
        ometa_client: OpenMetadata,
        entity: ClassifiableEntityType,
        config: Optional[SamplerConfig] = None,  # noqa: UP045
        **kwargs,
    ) -> "SamplerInterface":
        """Create sampler from a pre-built SamplerConfig."""
        return cls(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            config=config or SamplerConfig(),
            **kwargs,
        )

    @cached_property
    def _resolve_sample_config(self) -> StaticSamplingConfig | None:
        """Get the static sampling config. Use cached_property to cache the
        result since it can be used multiple times during the sampling process
        and contains a potentially expensive computation.
        """
        self._sample_config = resolve_static_sampling_config(
            sample_config=self.sample_config.profileSampleConfig,
            row_count=(
                self._get_asset_row_count()
                if (
                    self.sample_config.profileSampleConfig
                    and self.sample_config.profileSampleConfig.sampleConfigType == SampleConfigType.DYNAMIC
                )
                else None
            ),
        )
        return self._sample_config

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
    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]]) -> TableData:  # noqa: UP006, UP045
        """Fetch sample data"""
        raise NotImplementedError

    @abstractmethod
    def get_columns(self) -> List[SQALikeColumn]:  # noqa: UP006
        """get columns"""
        raise NotImplementedError

    def _get_asset_row_count(self) -> int:
        """Default row-count implementation: returns 0. Override where row count is available."""
        logger.info(
            "Row count fetching is not implemented for this sampler. "
            "Returning 0 as default row count. Dynamic sampling will be ignored."
        )
        return self._row_count or 0

    @staticmethod
    def _truncate_cell(value: Any) -> Any:
        """Truncate string values that exceed the max cell length."""
        if isinstance(value, str) and len(value) > SAMPLE_DATA_MAX_CELL_LENGTH:
            return value[:SAMPLE_DATA_MAX_CELL_LENGTH]
        return value

    def generate_sample_data(self, sample_data_config: Optional[SampleDataIngestionConfig] = None) -> TableData:  # noqa: UP045
        """Fetch and ingest sample data

        Returns:
            TableData: sample data
        """
        if sample_data_config is None:
            # if there is no global config, default to storing and reading sample data to ensure backward compatibility
            # and availability of sample data for downstream steps
            sample_data_config = SampleDataIngestionConfig(storeSampleData=True, readSampleData=True)

        if not sample_data_config.storeSampleData and not sample_data_config.readSampleData:
            logger.info("Both storing and reading of sample data are disabled. Skipping sample data generation.")
            return TableData(rows=[], columns=[])
        try:
            if sample_data_config.readSampleData or sample_data_config.storeSampleData:
                logger.debug(f"Fetching sample data for {self.entity.fullyQualifiedName.root}...")
                table_data = self.fetch_sample_data(self.columns)
                table_data.rows = [
                    [self._truncate_cell(cell) for cell in row]
                    for row in table_data.rows[: min(SAMPLE_DATA_DEFAULT_COUNT, self.sample_limit)]
                ]
                if self.upload_sample_storage_config and sample_data_config.storeSampleData:
                    upload_sample_data(
                        data=table_data,
                        entity=self.entity,
                        sample_storage_config=self.upload_sample_storage_config,
                    )
                return table_data

            return TableData(rows=[], columns=[])

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching sample data: {err}")
            raise err  # noqa: TRY201

    @property
    def columns(self) -> List[SQALikeColumn]:  # noqa: UP006
        """Return the sampled columns list. Subclasses with include/exclude
        column filtering (database samplers) override this property."""
        if not self._columns:
            self._columns = self.get_columns()
        return self._columns

    def close(self):  # noqa: B027
        """Default noop"""
