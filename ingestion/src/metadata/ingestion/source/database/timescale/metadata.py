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
TimescaleDB source module
"""
import traceback
from typing import Iterable, Optional, Tuple

from sqlalchemy.engine import Inspector

from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    Table,
    TablePartition,
)
from metadata.generated.schema.entity.services.connections.database.timescaleConnection import (
    TimescaleConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.ingestion.source.database.timescale.models import (
    CompressionSettings,
    HypertableInfo,
)
from metadata.ingestion.source.database.timescale.queries import (
    TIMESCALE_CHECK_EXTENSION,
    TIMESCALE_GET_COMPRESSION_SETTINGS,
    TIMESCALE_GET_HYPERTABLE_INFO,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TimescaleSource(PostgresSource):
    """
    Implements the necessary methods to extract
    Database metadata from TimescaleDB Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.timescaledb_installed = False

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: TimescaleConnection = config.serviceConnection.root.config
        if not isinstance(connection, TimescaleConnection):
            raise InvalidSourceException(
                f"Expected TimescaleConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """
        Check if TimescaleDB extension is installed
        """
        super().prepare()
        try:
            result = self.engine.execute(TIMESCALE_CHECK_EXTENSION).first()
            if result:
                self.timescaledb_installed = result.timescaledb_installed
                logger.info(
                    f"TimescaleDB extension installed: {self.timescaledb_installed}"
                )
        except Exception as exc:
            logger.warning(f"Could not check TimescaleDB extension: {exc}")
            self.timescaledb_installed = False

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Either[Table]]:
        """
        Override to add TimescaleDB-specific metadata
        """
        for either_table in super().yield_table(table_name_and_type):
            if either_table.right and self.timescaledb_installed:
                try:
                    self._add_timescale_metadata(either_table.right)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error adding TimescaleDB metadata for table {either_table.right.name}: {exc}"
                    )
            yield either_table

    def _add_timescale_metadata(self, table: Table) -> None:
        """
        Add compression and hypertable metadata to the table
        """
        try:
            schema_name = table.databaseSchema.root
            table_name = table.name.root

            hypertable = self._get_hypertable_info(table_name, schema_name)

            if hypertable:
                logger.debug(f"Found hypertable: {schema_name}.{table_name}")

                table.compressionEnabled = hypertable.compression_enabled

                if hypertable.compression_enabled:
                    compression = self._get_compression_settings(
                        table_name, schema_name
                    )

                    if compression:
                        table.compressionCodec = "TimescaleDB Native"
                        table.compressionStrategy = {
                            "compressionType": "POLICY_BASED",
                            "segmentColumns": compression.segment_by_columns or [],
                            "orderColumns": compression.order_by_columns or [],
                        }

                partition_info = self._build_hypertable_partition(hypertable)
                if partition_info:
                    table.tablePartition = partition_info

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error processing TimescaleDB metadata for {table.name}: {exc}"
            )

    def _get_hypertable_info(
        self, table_name: str, schema_name: str
    ) -> Optional[HypertableInfo]:
        """
        Query timescaledb_information.hypertables for metadata
        """
        try:
            result = self.engine.execute(
                TIMESCALE_GET_HYPERTABLE_INFO,
                {"table_name": table_name, "schema_name": schema_name},
            ).first()

            if result:
                return HypertableInfo.model_validate(dict(result._mapping))
            return None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(
                f"Could not get hypertable info for {schema_name}.{table_name}: {exc}"
            )
            return None

    def _get_compression_settings(
        self, table_name: str, schema_name: str
    ) -> Optional[CompressionSettings]:
        """
        Query timescaledb_information.compression_settings for compression config
        """
        try:
            result = self.engine.execute(
                TIMESCALE_GET_COMPRESSION_SETTINGS,
                {"table_name": table_name, "schema_name": schema_name},
            ).first()

            if result:
                return CompressionSettings.model_validate(dict(result._mapping))
            return None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(
                f"Could not get compression settings for {schema_name}.{table_name}: {exc}"
            )
            return None

    def _build_hypertable_partition(
        self, hypertable: HypertableInfo
    ) -> Optional[TablePartition]:
        """
        Build partition details from hypertable information
        """
        if not hypertable.column_name:
            return None

        if hypertable.interval_length:
            interval_type = PartitionIntervalTypes.TIME_UNIT
            interval = f"{hypertable.interval_length} microseconds"
        elif hypertable.integer_interval:
            interval_type = PartitionIntervalTypes.INTEGER_RANGE
            interval = str(hypertable.integer_interval)
        else:
            interval_type = PartitionIntervalTypes.COLUMN_VALUE
            interval = None

        return TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName=hypertable.column_name,
                    intervalType=interval_type,
                    interval=interval,
                )
            ]
        )

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, Optional[TablePartition]]:
        """
        Override to check for hypertables first, then fall back to PostgreSQL partitioning
        """
        if self.timescaledb_installed:
            hypertable = self._get_hypertable_info(table_name, schema_name)
            if hypertable:
                partition = self._build_hypertable_partition(hypertable)
                return (True, partition) if partition else (False, None)

        return super().get_table_partition_details(table_name, schema_name, inspector)
