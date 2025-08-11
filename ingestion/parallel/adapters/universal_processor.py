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
Universal Processor Adapter that wraps OpenMetadata Processor components
"""
from typing import Any, Dict, Optional, Type

from ingestion.parallel.om_adapters import ProcessedRecord, ProcessorAdapter, Record
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Processor
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UniversalProcessorAdapter(ProcessorAdapter):
    """
    Universal adapter that wraps any OpenMetadata Processor.
    Handles the conversion between Record format and OpenMetadata entities.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.processor_config = config.get("processor_config", {})
        self.processor_type = config.get("processor_type")
        self._processor_instance: Optional[Processor] = None

    def _initialize_processor(self) -> Optional[Processor]:
        """Initialize the wrapped processor if configured"""
        if not self.processor_type or self._processor_instance:
            return self._processor_instance

        try:
            # Import processor class
            processor_class: Type[Processor] = import_from_module(
                f"metadata.ingestion.processor.{self.processor_type}"
            )

            # Create processor instance
            self._processor_instance = processor_class.create(
                self.processor_config,
                metadata=None,  # Processor typically doesn't need metadata client
                pipeline_name=self.config.get("pipeline_name", "parallel-ingestion"),
            )

            return self._processor_instance
        except Exception as e:
            logger.warning(f"Could not initialize processor {self.processor_type}: {e}")
            return None

    def process(self, record: Record) -> ProcessedRecord:
        """
        Process a record using the wrapped processor (if any).
        If no processor is configured, pass through the data.
        """
        processor = self._initialize_processor()

        # Extract entity from record
        entity_data = record.data.get("entity")
        entity_type = record.data.get("entity_type")

        if processor and entity_data:
            try:
                # Reconstruct the entity object
                # This would use the entity type to create the proper object
                # For now, we'll pass the data through

                # Create Either wrapper expected by processor
                entity_either = Either(right=entity_data)

                # Process entity
                processed_either = processor.run(entity_either)

                if processed_either and processed_either.right:
                    # Successfully processed
                    return ProcessedRecord(
                        record_id=record.record_id,
                        data={
                            "entity_type": entity_type,
                            "entity": processed_either.right,
                            "processed": True,
                            "shard_id": record.data.get("shard_id"),
                        },
                        metadata=record.metadata,
                    )
                else:
                    # Processing failed
                    error = (
                        processed_either.left if processed_either else "Unknown error"
                    )
                    logger.error(f"Processor error for {record.record_id}: {error}")
                    return ProcessedRecord(
                        record_id=record.record_id,
                        data={**record.data, "processed": False, "error": str(error)},
                        metadata=record.metadata,
                    )
            except Exception as e:
                logger.error(f"Error processing record {record.record_id}: {e}")
                return ProcessedRecord(
                    record_id=record.record_id,
                    data={**record.data, "processed": False, "error": str(e)},
                    metadata=record.metadata,
                )
        else:
            # No processor configured - pass through
            return ProcessedRecord(
                record_id=record.record_id,
                data={**record.data, "processed": False, "processor_skipped": True},
                metadata=record.metadata,
            )

    def close(self):
        """Clean up resources"""
        if self._processor_instance:
            self._processor_instance.close()


class PiiProcessorAdapter(UniversalProcessorAdapter):
    """Specialized processor for PII detection"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        if not config:
            config = {}
        config["processor_type"] = "pii"
        super().__init__(config)


class QueryParserProcessorAdapter(UniversalProcessorAdapter):
    """Specialized processor for query parsing in lineage/usage"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        if not config:
            config = {}
        config["processor_type"] = "query_parser"
        super().__init__(config)


class ProfilerProcessorAdapter(ProcessorAdapter):
    """
    Special processor for profiler workflow.
    Since profiling generates new data rather than transforming,
    we handle it differently.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.profiler_config = config.get("profiler_config", {})

    def process(self, record: Record) -> ProcessedRecord:
        """
        For profiler, we don't actually process here.
        The profiling happens in the sink adapter.
        """
        # Mark record for profiling
        return ProcessedRecord(
            record_id=record.record_id,
            data={
                **record.data,
                "needs_profiling": True,
                "profiler_config": self.profiler_config,
            },
            metadata=record.metadata,
        )


class DataQualityProcessorAdapter(ProcessorAdapter):
    """
    Processor for data quality checks.
    Prepares entities for quality validation.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.test_suite_config = config.get("test_suite_config", {})

    def process(self, record: Record) -> ProcessedRecord:
        """
        Prepare record for data quality testing.
        """
        return ProcessedRecord(
            record_id=record.record_id,
            data={
                **record.data,
                "test_suite_config": self.test_suite_config,
                "needs_quality_check": True,
            },
            metadata=record.metadata,
        )
