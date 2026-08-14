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
Sampler configuration hierarchy.

Each sampler family declares its own config subclass containing only
the fields it actually needs — no database-specific types leak into the
base class or into storage/messaging samplers.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional  # noqa: UP035

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.sampler.models import SampleConfig
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT


@dataclass
class SamplerConfig:
    """Base config — fields meaningful for all sampler types."""

    sample_config: SampleConfig = field(default_factory=SampleConfig)
    sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT  # noqa: UP045
    # Config for uploading sample data to external blob storage (optional, all types).
    # Named "upload" to distinguish it from the sampler's own service connection.
    upload_sample_storage_config: Optional[DataStorageConfig] = None  # noqa: UP045


@dataclass
class DatabaseSamplerConfig(SamplerConfig):
    """Config for database-family samplers (SQL, NoSQL, Datalake).

    Holds types that are only meaningful for database entities — SQL
    partitions, user queries, column filters, processing engines.
    These are NOT imported into the base SamplerConfig or SamplerInterface.
    """

    # List[ColumnProfilerConfig] — typed as Any to avoid importing the
    # database-specific generated schema type into this base config file.
    include_columns: List[Any] = field(default_factory=list)  # noqa: UP006
    exclude_columns: List[str] = field(default_factory=list)  # noqa: UP006
    # PartitionProfilerConfig — typed as Any for the same reason.
    partition_details: Optional[Any] = None  # noqa: UP045
    sample_query: Optional[str] = None  # noqa: UP045
    # ProcessingEngine — typed as Any for the same reason.
    processing_engine: Optional[Any] = None  # noqa: UP045


@dataclass
class StorageSamplerConfig(SamplerConfig):
    """Config for storage-family samplers (S3, GCS, ADLS, …).

    Storage samplers only need the base fields — no SQL partitions,
    no user queries, no column filters.
    """


@dataclass
class MessagingSamplerConfig(SamplerConfig):
    """Config for messaging-family samplers (Kafka, Redpanda, Kinesis, Pub/Sub).

    Messaging samplers only need the base fields — no SQL partitions,
    no column filters, no database-specific config.
    """
