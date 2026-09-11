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
TimescaleDB models for metadata extraction
"""

from pydantic import BaseModel, Field


class HypertableInfo(BaseModel):
    """Information about a TimescaleDB hypertable"""

    hypertable_schema: str
    hypertable_name: str
    compression_enabled: bool
    column_name: str | None = None
    interval_length: int | None = None
    integer_interval: int | None = None
    integer_now_func: str | None = None
    num_dimensions: int = 1


class CompressionSettings(BaseModel):
    """Compression configuration for a hypertable"""

    segment_by_columns: list[str] | None = Field(default_factory=list)
    order_by_columns: list[str] | None = Field(default_factory=list)


class ContinuousAggregateInfo(BaseModel):
    """Information about a continuous aggregate"""

    view_schema: str
    view_name: str
    view_definition: str | None = None
    compression_enabled: bool = False
    materialized_only: bool = False
    materialization_hypertable_schema: str | None = None
    materialization_hypertable_name: str | None = None


class ChunkInfo(BaseModel):
    """Information about a hypertable chunk"""

    chunk_schema: str
    chunk_name: str
    range_start: str | None = None
    range_end: str | None = None
    is_compressed: bool = False
    chunk_tablespace: str | None = None
