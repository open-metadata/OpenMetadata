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
from collections import Counter
from collections.abc import Sequence
from functools import cached_property
from typing import Any

from metadata.generated.schema.configuration.profilerConfiguration import (
    SampleDataIngestionConfig,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.pii.types import ClassifiableEntityType
from metadata.sampler.config import resolve_static_sampling_config
from metadata.sampler.sampler_config import SamplerConfig
from metadata.utils.constants import (
    SAMPLE_DATA_DEFAULT_COUNT,
    SAMPLE_DATA_MAX_CELL_LENGTH,
)
from metadata.utils.logger import sampler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = sampler_logger()


class _TruncatedCell(str):
    """A sampled text value that was cut to SAMPLE_DATA_MAX_CELL_LENGTH.

    Samplers truncate while fetching, before `generate_sample_data` decides which
    rows are handed downstream. Marking the value lets that step count only the
    truncations in rows it hands off, and attribute them to the sampler rather
    than to a later step. `generate_sample_data` turns marked values back into
    plain strings before returning them.
    """

    __slots__ = ()


def _count_and_unmark_truncated_cells(rows: list[list[Any]], column_names: Sequence[str]) -> Counter[str]:
    """Count truncated values per column and turn them back into plain strings."""
    truncated: Counter[str] = Counter()
    for row in rows:
        for idx, cell in enumerate(row):
            if isinstance(cell, _TruncatedCell):
                truncated[column_names[idx] if idx < len(column_names) else str(idx)] += 1
                row[idx] = str(cell)
    return truncated


def _log_sample_data_handoff(
    entity_fqn: str,
    requested: int,
    fetched: int,
    handed_off: int,
    truncated: Counter[str],
) -> None:
    """Report how many sampled rows reach downstream steps and what was lost on the way.

    Field names may be logged, sampled values must not be.
    """
    logger.debug(
        "Sample data for [%s]: %d rows requested, %d fetched, %d handed off",
        entity_fqn,
        requested,
        fetched,
        handed_off,
    )
    # Fetching fewer rows than requested (small table) or more than requested
    # (custom sample query) is not a loss. Dropping rows we were asked for is.
    dropped = min(requested, fetched) - handed_off
    if dropped > 0:
        logger.warning(
            "Sample data for [%s]: %d rows requested and %d fetched, but only %d handed off."
            " %d rows were dropped because sample data is capped at %d rows.",
            entity_fqn,
            requested,
            fetched,
            handed_off,
            dropped,
            SAMPLE_DATA_DEFAULT_COUNT,
        )
    if truncated:
        logger.warning(
            "Sample data for [%s]: values longer than %d characters were truncated (column=count): %s",
            entity_fqn,
            SAMPLE_DATA_MAX_CELL_LENGTH,
            ", ".join(f"{name}={count}" for name, count in truncated.items()),
        )


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
        config: SamplerConfig | None = None,
        **__,
    ):
        resolved_config = config or SamplerConfig()
        self.ometa_client = ometa_client
        self.entity = entity
        self.service_connection_config = service_connection_config
        self.sample_config = resolved_config.sample_config
        self.sample_limit = resolved_config.sample_data_count or SAMPLE_DATA_DEFAULT_COUNT
        self._columns: list[SQALikeColumn] = []
        self._row_count = None
        self._sample_config: StaticSamplingConfig | None = None
        self.partition_details: Any = None
        self.sample_query: str | None = None

    @classmethod
    def create(
        cls,
        service_connection_config: Any,
        ometa_client: OpenMetadata,
        entity: ClassifiableEntityType,
        config: SamplerConfig | None = None,
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

    @classmethod
    def is_skippable_sampling_error(cls, exc: Exception) -> bool:
        """Whether sampling can skip this error and continue with the next entity."""
        return False

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
    def applies_sampling(self) -> bool:
        """Whether reading the dataset returns a subset of the asset rather than all of it.

        A configured sample amount does not answer that on its own: a 100% percentage that is
        not randomized resolves to the asset itself. `get_dataset` is the authority on that, so
        both implementations read this rather than repeating the rule, and so does the data
        quality evaluation scope, which reports the sample a verdict was measured on.
        """
        if self.sample_query:
            return True

        static = self._resolve_sample_config
        if not static or not static.profileSample:
            return False

        return not (
            static.profileSampleType == ProfileSampleType.PERCENTAGE
            and static.profileSample == 100
            and self.sample_config.randomizedSample is not True
        )

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
    def fetch_sample_data(self, columns: list[SQALikeColumn] | None) -> TableData:
        """Fetch sample data"""
        raise NotImplementedError

    @abstractmethod
    def get_columns(self) -> list[SQALikeColumn]:
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
            return _TruncatedCell(value[:SAMPLE_DATA_MAX_CELL_LENGTH])
        return value

    def generate_sample_data(self, sample_data_config: SampleDataIngestionConfig | None = None) -> TableData:
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
                fetched_rows = len(table_data.rows or [])
                table_data.rows = [
                    [self._truncate_cell(cell) for cell in row]
                    for row in table_data.rows[: min(SAMPLE_DATA_DEFAULT_COUNT, self.sample_limit)]
                ]
                truncated = _count_and_unmark_truncated_cells(
                    table_data.rows, [model_str(column) for column in table_data.columns or []]
                )
                _log_sample_data_handoff(
                    entity_fqn=model_str(self.entity.fullyQualifiedName),
                    requested=self.sample_limit,
                    fetched=fetched_rows,
                    handed_off=len(table_data.rows),
                    truncated=truncated,
                )
                return table_data

            return TableData(rows=[], columns=[])

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching sample data: {err}")
            raise err  # noqa: TRY201

    @property
    def columns(self) -> list[SQALikeColumn]:
        """Return the sampled columns list. Subclasses with include/exclude
        column filtering (database samplers) override this property."""
        if not self._columns:
            self._columns = self.get_columns()
        return self._columns

    def close(self):  # noqa: B027
        """Default noop"""
