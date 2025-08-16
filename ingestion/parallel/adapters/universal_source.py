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
Universal Source Adapter that wraps any OpenMetadata Source connector
without requiring modifications to the connector code.
"""
import hashlib
from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List, Optional, Type

from ingestion.parallel.om_adapters import Record, ShardDescriptor, SourceAdapter
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ShardingStrategy(ABC):
    """Base class for different sharding strategies"""

    @abstractmethod
    def discover_shards(
        self, source: Source, context: Dict[str, Any]
    ) -> List[ShardDescriptor]:
        """Discover shards based on the strategy"""
        pass

    @abstractmethod
    def filter_entities(
        self, entities: Iterable[Either], shard: ShardDescriptor
    ) -> Iterable[Either]:
        """Filter entities belonging to a specific shard"""
        pass


class DatabaseShardingStrategy(ShardingStrategy):
    """Shard by database - each database is a separate shard"""

    def discover_shards(
        self, source: Source, context: Dict[str, Any]
    ) -> List[ShardDescriptor]:
        shards = []

        # For database sources, we can inspect the topology
        if hasattr(source, "get_services"):
            # Get all databases from the source
            for service in source.get_services():
                if service.right:
                    # Mock getting databases - in real implementation,
                    # we'd call the appropriate method
                    databases = self._get_databases_for_service(source, service.right)
                    for db in databases:
                        shards.append(
                            ShardDescriptor(
                                type="database",
                                id=db.fullyQualifiedName or db.name.root,
                                metadata={
                                    "database_name": db.name.root,
                                    "service_name": service.right.name.root,
                                },
                            )
                        )

        return shards

    def _get_databases_for_service(
        self, source: Source, service: Any
    ) -> List[Database]:
        """Extract databases from service"""
        databases = []
        # This would use the source's topology to get databases
        # For now, return empty list
        return databases

    def filter_entities(
        self, entities: Iterable[Either], shard: ShardDescriptor
    ) -> Iterable[Either]:
        """Filter entities belonging to the database shard"""
        database_name = shard.metadata.get("database_name")

        for entity in entities:
            if entity.right:
                # Check if entity belongs to this database
                if hasattr(entity.right, "database") and entity.right.database:
                    if entity.right.database.name == database_name:
                        yield entity
                elif (
                    hasattr(entity.right, "databaseSchema")
                    and entity.right.databaseSchema
                ):
                    # For schema-level entities
                    if entity.right.databaseSchema.database.name == database_name:
                        yield entity
                else:
                    # For database-level entities
                    if (
                        hasattr(entity.right, "name")
                        and entity.right.name.root == database_name
                    ):
                        yield entity
            else:
                yield entity  # Pass through errors


class SchemaShardingStrategy(ShardingStrategy):
    """Shard by schema - each schema is a separate shard"""

    def discover_shards(
        self, source: Source, context: Dict[str, Any]
    ) -> List[ShardDescriptor]:
        shards = []

        # This would enumerate all schemas
        # For demonstration, return a simple example
        return [
            ShardDescriptor(
                type="schema",
                id="default.public",
                metadata={"database": "default", "schema": "public"},
            )
        ]

    def filter_entities(
        self, entities: Iterable[Either], shard: ShardDescriptor
    ) -> Iterable[Either]:
        schema_name = shard.metadata.get("schema")

        for entity in entities:
            if entity.right and hasattr(entity.right, "databaseSchema"):
                if entity.right.databaseSchema.name.root == schema_name:
                    yield entity
            else:
                yield entity


class TableCountShardingStrategy(ShardingStrategy):
    """Shard by table count - distribute tables evenly across shards"""

    def __init__(self, tables_per_shard: int = 100):
        self.tables_per_shard = tables_per_shard

    def discover_shards(
        self, source: Source, context: Dict[str, Any]
    ) -> List[ShardDescriptor]:
        # This would count tables and create appropriate shards
        # For now, create fixed shards
        num_shards = context.get("estimated_tables", 1000) // self.tables_per_shard
        num_shards = max(1, min(num_shards, 50))  # Cap at 50 shards

        return [
            ShardDescriptor(
                type="table_range",
                id=f"shard-{i}",
                metadata={
                    "shard_index": i,
                    "total_shards": num_shards,
                    "tables_per_shard": self.tables_per_shard,
                },
            )
            for i in range(num_shards)
        ]

    def filter_entities(
        self, entities: Iterable[Either], shard: ShardDescriptor
    ) -> Iterable[Either]:
        shard_index = shard.metadata["shard_index"]
        total_shards = shard.metadata["total_shards"]

        table_count = 0
        for entity in entities:
            if entity.right and isinstance(entity.right, Table):
                # Use hash to distribute tables
                table_hash = int(
                    hashlib.md5(entity.right.fullyQualifiedName.encode()).hexdigest(),
                    16,
                )

                if table_hash % total_shards == shard_index:
                    yield entity
                    table_count += 1
            else:
                # Pass through non-table entities
                yield entity


class TimeWindowShardingStrategy(ShardingStrategy):
    """Shard by time window - for usage/lineage workflows"""

    def __init__(self, window_hours: int = 24):
        self.window_hours = window_hours

    def discover_shards(
        self, source: Source, context: Dict[str, Any]
    ) -> List[ShardDescriptor]:
        # For usage/lineage, create time-based shards
        import datetime

        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=context.get("days_back", 7))

        shards = []
        current = start_date

        while current < end_date:
            window_end = current + datetime.timedelta(hours=self.window_hours)
            shards.append(
                ShardDescriptor(
                    type="time_window",
                    id=f"{current.isoformat()}_{window_end.isoformat()}",
                    metadata={
                        "start_time": current.isoformat(),
                        "end_time": window_end.isoformat(),
                    },
                )
            )
            current = window_end

        return shards

    def filter_entities(
        self, entities: Iterable[Either], shard: ShardDescriptor
    ) -> Iterable[Either]:
        # This would filter based on timestamp
        # For now, pass through all
        yield from entities


class UniversalSourceAdapter(SourceAdapter):
    """
    Universal adapter that wraps any OpenMetadata Source connector.
    This allows parallel execution without modifying the original connector.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.source_config = config.get("source_config", {})
        self.workflow_config = config.get("workflow_config", {})
        self.sharding_strategy = self._get_sharding_strategy(
            config.get("sharding_strategy")
        )
        self._source_instance: Optional[Source] = None
        self._metadata_client: Optional[OpenMetadata] = None

    def _get_sharding_strategy(
        self, strategy_config: Dict[str, Any]
    ) -> ShardingStrategy:
        """Initialize the appropriate sharding strategy"""
        strategy_type = strategy_config.get("type", "database")

        if strategy_type == "database":
            return DatabaseShardingStrategy()
        elif strategy_type == "schema":
            return SchemaShardingStrategy()
        elif strategy_type == "table_count":
            tables_per_shard = strategy_config.get("tables_per_shard", 100)
            return TableCountShardingStrategy(tables_per_shard)
        elif strategy_type == "time_window":
            window_hours = strategy_config.get("window_hours", 24)
            return TimeWindowShardingStrategy(window_hours)
        else:
            raise ValueError(f"Unknown sharding strategy: {strategy_type}")

    def _initialize_source(self) -> Source:
        """Initialize the wrapped OpenMetadata source"""
        if self._source_instance:
            return self._source_instance

        # Create workflow source config
        workflow_source = WorkflowSource(**self.source_config)

        # Initialize metadata client
        metadata_config = OpenMetadataConnection(
            hostPort=self.config.get("metadata_host", "http://localhost:8585"),
            authProvider=self.config.get("auth_provider", "openmetadata"),
            securityConfig=self.config.get("security_config", {}),
        )
        self._metadata_client = OpenMetadata(metadata_config)

        # Import and initialize the source class
        source_class_name = workflow_source.type.value
        source_class: Type[Source] = import_from_module(
            f"metadata.ingestion.source.{source_class_name}"
        )

        # Create source instance
        self._source_instance = source_class.create(
            workflow_source.model_dump(),
            self._metadata_client,
            pipeline_name=self.config.get("pipeline_name", "parallel-ingestion"),
        )

        # Prepare the source
        self._source_instance.prepare()

        return self._source_instance

    def discover_shards(self) -> List[ShardDescriptor]:
        """
        Discover shards based on the configured strategy.
        This analyzes the source to determine how to partition the work.
        """
        source = self._initialize_source()

        # Context for sharding strategy
        context = {
            "source_type": self.source_config.get("type"),
            "estimated_tables": self.config.get("estimated_tables", 1000),
            "days_back": self.config.get("days_back", 7),
        }

        # Use strategy to discover shards
        shards = self.sharding_strategy.discover_shards(source, context)

        logger.info(
            f"Discovered {len(shards)} shards using {type(self.sharding_strategy).__name__}"
        )

        return shards

    def iter_records(self, shard: ShardDescriptor) -> Iterable[Record]:
        """
        Iterate through records for a specific shard.
        This wraps the source's iterator and filters based on shard.
        """
        source = self._initialize_source()

        # Get entities from source
        entities = source.run()  # This returns an iterator

        # Filter entities for this shard
        filtered_entities = self.sharding_strategy.filter_entities(entities, shard)

        # Convert to Records
        for entity in filtered_entities:
            if entity and entity.right:
                # Generate stable record ID
                record_id = self._generate_entity_id(entity.right, shard)

                # Convert entity to record
                yield Record(
                    record_id=record_id,
                    data={
                        "entity_type": type(entity.right).__name__,
                        "entity": entity.right.model_dump()
                        if hasattr(entity.right, "model_dump")
                        else str(entity.right),
                        "shard_id": shard.id,
                    },
                    metadata={
                        "shard": shard.model_dump(),
                        "source_type": self.source_config.get("type"),
                    },
                )
            elif entity and entity.left:
                # Handle errors
                logger.error(f"Source error in shard {shard.id}: {entity.left}")

    def _generate_entity_id(self, entity: Any, shard: ShardDescriptor) -> str:
        """Generate a stable ID for an entity"""
        if hasattr(entity, "fullyQualifiedName"):
            content = f"{shard.id}:{entity.fullyQualifiedName}"
        elif hasattr(entity, "id"):
            content = f"{shard.id}:{entity.id}"
        else:
            content = f"{shard.id}:{type(entity).__name__}:{str(entity)}"

        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def close(self):
        """Clean up resources"""
        if self._source_instance:
            self._source_instance.close()
        if self._metadata_client:
            self._metadata_client.close()


# Specialized adapters for different workflow types


class MetadataSourceAdapter(UniversalSourceAdapter):
    """Specialized adapter for metadata ingestion workflows"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Default to database sharding for metadata
        if not config:
            config = {}
        if "sharding_strategy" not in config:
            config["sharding_strategy"] = {"type": "database"}
        super().__init__(config)


class LineageSourceAdapter(UniversalSourceAdapter):
    """Specialized adapter for lineage workflows"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Default to time window sharding for lineage
        if not config:
            config = {}
        if "sharding_strategy" not in config:
            config["sharding_strategy"] = {
                "type": "time_window",
                "window_hours": 6,  # 6-hour windows
            }
        super().__init__(config)


class UsageSourceAdapter(UniversalSourceAdapter):
    """Specialized adapter for usage workflows"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Default to time window sharding for usage
        if not config:
            config = {}
        if "sharding_strategy" not in config:
            config["sharding_strategy"] = {
                "type": "time_window",
                "window_hours": 24,  # Daily windows
            }
        super().__init__(config)


class ProfilerSourceAdapter(UniversalSourceAdapter):
    """Specialized adapter for profiler workflows"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Default to table count sharding for profiler
        if not config:
            config = {}
        if "sharding_strategy" not in config:
            config["sharding_strategy"] = {
                "type": "table_count",
                "tables_per_shard": 50,  # Profile 50 tables per shard
            }
        super().__init__(config)


class DataQualitySourceAdapter(UniversalSourceAdapter):
    """Specialized adapter for data quality workflows"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Default to schema sharding for data quality
        if not config:
            config = {}
        if "sharding_strategy" not in config:
            config["sharding_strategy"] = {"type": "schema"}
        super().__init__(config)
