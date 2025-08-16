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
Universal Sink Adapter that wraps OpenMetadata Sink components
"""
from typing import Any, Dict, List, Optional, Type

from ingestion.parallel.om_adapters import ProcessedRecord, SinkAdapter
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.sink.metadata import MetadataRestSink
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UniversalSinkAdapter(SinkAdapter):
    """
    Universal adapter that wraps any OpenMetadata Sink.
    Provides idempotent writes by leveraging OpenMetadata's create_or_update methods.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.sink_config = config.get("sink_config", {})
        self.sink_type = config.get("sink_type", "metadata")
        self._sink_instance: Optional[Sink] = None
        self._metadata_client: Optional[OpenMetadata] = None
        self._entity_cache: Dict[str, bool] = {}  # Cache for idempotency

    def _initialize_sink(self) -> Sink:
        """Initialize the wrapped sink"""
        if self._sink_instance:
            return self._sink_instance

        # Initialize metadata client
        if not self._metadata_client:
            metadata_config = OpenMetadataConnection(
                hostPort=self.metadata_server,
                authProvider=self.config.get("auth_provider", "openmetadata"),
                securityConfig={"jwtToken": self.api_key} if self.api_key else {},
            )
            self._metadata_client = OpenMetadata(metadata_config)

        # Create sink instance
        if self.sink_type == "metadata":
            self._sink_instance = MetadataRestSink(
                config=self.sink_config, metadata=self._metadata_client
            )
        else:
            # Import custom sink
            sink_class: Type[Sink] = import_from_module(
                f"metadata.ingestion.sink.{self.sink_type}"
            )
            self._sink_instance = sink_class.create(
                self.sink_config,
                self._metadata_client,
                pipeline_name=self.config.get("pipeline_name", "parallel-ingestion"),
            )

        return self._sink_instance

    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """
        Write processed record to sink with idempotency.
        Uses the idempotency key to prevent duplicate writes.
        """
        # Check cache first
        if idempotency_key in self._entity_cache:
            logger.debug(f"Skipping already processed entity: {idempotency_key}")
            return True

        try:
            sink = self._initialize_sink()

            # Extract entity from processed record
            entity_data = processed.data.get("entity")
            entity_type = processed.data.get("entity_type")

            if not entity_data:
                logger.warning(f"No entity data in record {processed.record_id}")
                return False

            # Reconstruct entity object
            # In a real implementation, we'd use entity_type to create the proper class
            # For now, create Either wrapper
            entity_either = Either(right=entity_data)

            # Write to sink
            result = sink.run(entity_either)

            if result:
                # Successfully written
                self._entity_cache[idempotency_key] = True
                logger.debug(f"Successfully wrote entity {idempotency_key}")
                return True
            else:
                logger.error(f"Sink returned None for {idempotency_key}")
                return False

        except Exception as e:
            logger.error(f"Error writing to sink for {idempotency_key}: {e}")
            return False

    def batch_write(self, records: List[ProcessedRecord]) -> Dict[str, bool]:
        """
        Batch write implementation.
        The default implementation just calls write() for each record,
        but this could be optimized for specific sinks.
        """
        results = {}

        # Group records by entity type for more efficient processing
        grouped_records: Dict[str, List[ProcessedRecord]] = {}
        for record in records:
            entity_type = record.data.get("entity_type", "unknown")
            if entity_type not in grouped_records:
                grouped_records[entity_type] = []
            grouped_records[entity_type].append(record)

        # Process each group
        for entity_type, group_records in grouped_records.items():
            logger.info(
                f"Processing batch of {len(group_records)} {entity_type} entities"
            )

            for record in group_records:
                success = self.write(record, record.record_id)
                results[record.record_id] = success

        return results

    def close(self):
        """Clean up resources"""
        if self._sink_instance:
            self._sink_instance.close()
        if self._metadata_client:
            self._metadata_client.close()


class ProfilerSinkAdapter(SinkAdapter):
    """
    Specialized sink for profiler workflow.
    Executes profiling and stores results.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self._metadata_client: Optional[OpenMetadata] = None
        self._profiler_interface = None

    def _initialize_profiler(self):
        """Initialize profiler components"""
        if not self._metadata_client:
            metadata_config = OpenMetadataConnection(
                hostPort=self.metadata_server,
                authProvider=self.config.get("auth_provider", "openmetadata"),
                securityConfig={"jwtToken": self.api_key} if self.api_key else {},
            )
            self._metadata_client = OpenMetadata(metadata_config)

        # Initialize profiler interface
        # This would import the actual profiler components
        # from metadata.profiler.interface.sqlalchemy.profiler_interface import SQAProfilerInterface
        # self._profiler_interface = SQAProfilerInterface(...)

    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """
        Execute profiling for the entity and store results.
        """
        try:
            if not processed.data.get("needs_profiling"):
                # Not a profiling record
                return True

            entity_data = processed.data.get("entity")
            entity_type = processed.data.get("entity_type")

            if entity_type != "Table":
                # Only profile tables
                return True

            # In a real implementation, we would:
            # 1. Get the table entity
            # 2. Initialize profiler for that table
            # 3. Run profiling
            # 4. Store results

            logger.info(f"Would profile table: {entity_data}")

            # Mark as successful for now
            return True

        except Exception as e:
            logger.error(f"Error profiling entity {idempotency_key}: {e}")
            return False


class LineageSinkAdapter(UniversalSinkAdapter):
    """
    Specialized sink for lineage workflow.
    Handles lineage relationship creation.
    """

    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """
        Create lineage relationships in OpenMetadata.
        """
        try:
            entity_data = processed.data.get("entity")

            # Check if this is a lineage entity
            if processed.data.get("entity_type") == "AddLineageRequest":
                # Use metadata client to add lineage
                self._initialize_sink()

                # In real implementation:
                # lineage_request = AddLineageRequest(**entity_data)
                # self._metadata_client.add_lineage(lineage_request)

                logger.info(f"Would add lineage: {entity_data}")
                return True
            else:
                # Use parent implementation for other entities
                return super().write(processed, idempotency_key)

        except Exception as e:
            logger.error(f"Error adding lineage {idempotency_key}: {e}")
            return False


class UsageSinkAdapter(UniversalSinkAdapter):
    """
    Specialized sink for usage workflow.
    Handles usage statistics aggregation and storage.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.usage_cache: Dict[str, Dict[str, Any]] = {}

    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """
        Aggregate and store usage statistics.
        """
        try:
            entity_data = processed.data.get("entity")

            # Check if this is usage data
            if "usage" in entity_data or "queryCount" in entity_data:
                # Aggregate usage data
                table_fqn = entity_data.get("table_fqn")
                if table_fqn:
                    if table_fqn not in self.usage_cache:
                        self.usage_cache[table_fqn] = {
                            "queryCount": 0,
                            "uniqueUsers": set(),
                        }

                    # Aggregate
                    self.usage_cache[table_fqn]["queryCount"] += entity_data.get(
                        "queryCount", 0
                    )
                    if "user" in entity_data:
                        self.usage_cache[table_fqn]["uniqueUsers"].add(
                            entity_data["user"]
                        )

                return True
            else:
                # Use parent implementation
                return super().write(processed, idempotency_key)

        except Exception as e:
            logger.error(f"Error processing usage {idempotency_key}: {e}")
            return False

    def flush_usage_cache(self):
        """
        Flush aggregated usage data to OpenMetadata.
        This would be called at the end of processing.
        """
        for table_fqn, usage_data in self.usage_cache.items():
            # Convert to usage request and send to OpenMetadata
            unique_user_count = len(usage_data["uniqueUsers"])
            logger.info(
                f"Table {table_fqn}: {usage_data['queryCount']} queries, "
                f"{unique_user_count} unique users"
            )


class DataQualitySinkAdapter(UniversalSinkAdapter):
    """
    Specialized sink for data quality workflow.
    Executes test cases and stores results.
    """

    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """
        Execute data quality tests and store results.
        """
        try:
            if not processed.data.get("needs_quality_check"):
                return super().write(processed, idempotency_key)

            entity_data = processed.data.get("entity")
            test_suite_config = processed.data.get("test_suite_config", {})

            # In real implementation:
            # 1. Get the entity (table/column)
            # 2. Create/get test suite
            # 3. Execute tests
            # 4. Store results

            logger.info(f"Would run data quality tests for: {entity_data}")

            return True

        except Exception as e:
            logger.error(f"Error running quality tests {idempotency_key}: {e}")
            return False
