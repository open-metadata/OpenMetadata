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
TimescaleDB-aware sampler that restricts profiling to uncompressed chunks
instead of scanning the entire hypertable (including compressed data that
requires expensive decompression).
"""
from datetime import datetime
from typing import Dict, Optional, Union

from pydantic import BaseModel
from sqlalchemy import Column, select, text
from sqlalchemy.orm.util import AliasedClass

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.timescale.queries import (
    TIMESCALE_GET_COMPRESSION_INFO,
    TIMESCALE_GET_TIME_DIMENSION,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.postgres.sampler import PostgresSampler
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class HypertableMeta(BaseModel):
    """Compression metadata for a TimescaleDB hypertable."""

    time_column: str
    has_compressed: bool
    uncompressed_boundary: Optional[datetime] = None


class TimescaleSampler(PostgresSampler):
    """
    TimescaleDB-aware sampler that restricts profiling to uncompressed chunks.

    The core idea: for hypertables with compressed chunks, the "effective dataset"
    is the raw table filtered to only include uncompressed data. Sampling and
    partitioning then layer on top of this filtered dataset via the base class logic.

    For non-hypertables or hypertables without compression, behaviour is identical
    to the standard PostgreSQL sampler.
    """

    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        sample_config: Optional[SampleConfig] = None,
        partition_details: Optional[Dict] = None,
        sample_query: Optional[str] = None,
        storage_config: DataStorageConfig = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ):
        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            sample_config=sample_config,
            partition_details=partition_details,
            sample_query=sample_query,
            storage_config=storage_config,
            sample_data_count=sample_data_count,
            **kwargs,
        )
        self._hypertable_meta: Optional[HypertableMeta] = None
        self._hypertable_checked = False

    def _get_hypertable_sampling_boundary(
        self,
    ) -> None:
        """Query TimescaleDB metadata to get the time dimension column and
        compression info for this hypertable.

        Sets ``_hypertable_meta`` to a tuple of
        ``(time_column, has_compressed, uncompressed_boundary)`` when the table
        is a hypertable, or leaves it as ``None`` for regular tables.

        ``has_compressed`` is True only when at least one chunk is compressed.
        ``uncompressed_boundary`` is the earliest uncompressed chunk start, or
        None when all chunks are compressed (meaning there is no uncompressed
        data to profile).
        """
        if self._hypertable_checked:
            return

        self._hypertable_checked = True
        try:
            schema_name = self.raw_dataset.__table__.schema or "public"
            table_name = self.raw_dataset.__tablename__

            with self.session_factory() as session:
                params = {"schema": schema_name, "table": table_name}

                ht_result = session.execute(
                    text(TIMESCALE_GET_TIME_DIMENSION), params
                ).first()

                if not ht_result:
                    return

                time_column = ht_result[0]

                comp_result = session.execute(
                    text(TIMESCALE_GET_COMPRESSION_INFO), params
                ).first()

                has_compressed = (
                    comp_result.has_compressed
                    if comp_result and comp_result.has_compressed
                    else False
                )
                boundary_ts = (
                    comp_result.uncompressed_boundary
                    if comp_result and comp_result.uncompressed_boundary
                    else None
                )

                self._hypertable_meta = HypertableMeta(
                    time_column=time_column,
                    has_compressed=has_compressed,
                    uncompressed_boundary=boundary_ts,
                )
                logger.debug(
                    "Hypertable %s.%s: %s",
                    schema_name,
                    table_name,
                    self._hypertable_meta,
                )

        except Exception:
            logger.debug(
                "Could not detect hypertable info for %s, "
                "falling back to standard PostgreSQL sampling",
                self.raw_dataset.__tablename__,
            )

    def _has_compressed_chunks(self) -> bool:
        """Return True only when the hypertable has at least one compressed chunk."""
        self._get_hypertable_sampling_boundary()
        return (
            self._hypertable_meta is not None
            and self._hypertable_meta.has_compressed is True
        )

    def _get_uncompressed_dataset(self):
        """Return raw_dataset filtered to uncompressed chunks only.

        If the table is not a hypertable, has no compressed chunks, or all
        chunks are compressed (no uncompressed boundary), returns raw_dataset
        unchanged.
        """
        if not self._has_compressed_chunks() or self._hypertable_meta is None:
            return self.raw_dataset

        if self._hypertable_meta.uncompressed_boundary is None:
            logger.debug(
                "All chunks are compressed for %s — skipping uncompressed "
                "filter, profiling will require decompression",
                self.raw_dataset.__tablename__,
            )
            return self.raw_dataset

        stmt = select(self.raw_dataset).where(
            self.raw_dataset.__table__.c[self._hypertable_meta.time_column]
            >= self._hypertable_meta.uncompressed_boundary
        )
        return stmt.cte(f"{self.get_sampler_table_name()}_uncompressed")

    def get_dataset(self, column=None, **kwargs) -> Union[type, AliasedClass]:
        """Return the effective dataset, substituting raw_dataset with the
        uncompressed-only CTE when the hypertable has compressed chunks.

        Sampling and partitioning are delegated to the base class; only the
        no-sampling / no-partitioning path is intercepted here.
        """
        dataset = super().get_dataset(column=column, **kwargs)
        if dataset is self.raw_dataset:
            return self._get_uncompressed_dataset()
        return dataset

    def _base_sample_query(self, column: Optional[Column], label=None):
        """Add an uncompressed-chunks filter when sampling is active.

        The base class builds the sampling query from ``raw_dataset.__table__``.
        We call super() to keep TABLESAMPLE / partition logic intact, then
        append a WHERE predicate that restricts rows to uncompressed chunks.
        """
        query = super()._base_sample_query(column, label)
        if not self._has_compressed_chunks():
            return query

        if self._hypertable_meta.uncompressed_boundary is None:
            return query

        time_column = self.raw_dataset.__table__.c[self._hypertable_meta.time_column]
        return query.filter(time_column >= self._hypertable_meta.uncompressed_boundary)
