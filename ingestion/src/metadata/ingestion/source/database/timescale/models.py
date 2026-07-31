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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class HypertableInfo(BaseModel):
    """Information about a TimescaleDB hypertable"""

    hypertable_schema: str
    hypertable_name: str
    compression_enabled: bool
    column_name: Optional[str] = None  # noqa: UP045
    interval_length: Optional[int] = None  # noqa: UP045
    integer_interval: Optional[int] = None  # noqa: UP045
    integer_now_func: Optional[str] = None  # noqa: UP045
    num_dimensions: int = 1


class CompressionSettings(BaseModel):
    """Compression configuration for a hypertable"""

    segment_by_columns: Optional[List[str]] = Field(default_factory=list)  # noqa: UP006, UP045
    order_by_columns: Optional[List[str]] = Field(default_factory=list)  # noqa: UP006, UP045


class ContinuousAggregateInfo(BaseModel):
    """Information about a continuous aggregate"""

    view_schema: str
    view_name: str
    view_definition: Optional[str] = None  # noqa: UP045
    compression_enabled: bool = False
    materialized_only: bool = False
    materialization_hypertable_schema: Optional[str] = None  # noqa: UP045
    materialization_hypertable_name: Optional[str] = None  # noqa: UP045


class ChunkInfo(BaseModel):
    """Information about a hypertable chunk"""

    chunk_schema: str
    chunk_name: str
    range_start: Optional[str] = None  # noqa: UP045
    range_end: Optional[str] = None  # noqa: UP045
    is_compressed: bool = False
    chunk_tablespace: Optional[str] = None  # noqa: UP045
