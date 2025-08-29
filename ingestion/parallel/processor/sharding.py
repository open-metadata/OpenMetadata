"""
Sharding module for distributing workload across parallel workers.
Leverages OpenMetadata's existing source implementations.
"""

import json
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List

from metadata.utils.importer import import_from_module

logger = logging.getLogger(__name__)


class ShardingStrategy(ABC):
    """Base class for workload distribution strategies."""

    def __init__(self, workflow_config: Dict[str, Any]):
        """Initialize with workflow configuration."""
        self.workflow_config = workflow_config
        self.source_config = workflow_config.get("source", {})
        self.service_connection = self.source_config.get("serviceConnection", {})

    @abstractmethod
    def discover_shards(self) -> List[Dict[str, Any]]:
        """Discover work units for parallel processing."""
        pass

    @abstractmethod
    def configure_shard(
        self, base_config: Dict[str, Any], shard: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Configure workflow for specific shard."""
        pass


class DatabaseSchemaSharding(ShardingStrategy):
    """Distribute work by database schemas using OpenMetadata's source classes."""

    def discover_shards(self) -> List[Dict[str, Any]]:
        """Discover database schemas for parallel processing using OpenMetadata sources."""
        try:
            source_type = self.source_config.get("type", "").lower()

            source_module_key = (
                f"metadata.ingestion.source.database.{source_type}.metadata"
            )

            source_class_name = "".join(
                [s.capitalize() for s in source_type.replace("-", "_").split("_")]
            )

            possible_names = [
                f"{source_class_name}Source",
                f"{source_class_name}MetadataSource",
                f"{source_type.capitalize()}Source",
            ]

            source_class = None
            for class_name in possible_names:
                try:
                    source_class = import_from_module(
                        f"{source_module_key}:{class_name}"
                    )
                    logger.info(f"Successfully imported {class_name} for {source_type}")
                    break
                except Exception:
                    continue

            if source_class is None:
                logger.warning(
                    f"Could not import specific source for {source_type}, trying direct import"
                )
                try:
                    if source_type == "postgres":
                        from metadata.ingestion.source.database.postgres.metadata import (
                            PostgresSource,
                        )

                        source_class = PostgresSource
                    elif source_type == "mysql":
                        from metadata.ingestion.source.database.mysql.metadata import (
                            MysqlSource,
                        )

                        source_class = MysqlSource
                    elif source_type == "snowflake":
                        from metadata.ingestion.source.database.snowflake.metadata import (
                            SnowflakeSource,
                        )

                        source_class = SnowflakeSource
                    else:
                        from metadata.ingestion.source.database.database_service import (
                            DatabaseServiceSource,
                        )

                        source_class = DatabaseServiceSource
                except Exception as e:
                    logger.error(f"Failed to import source: {e}")
                    return []

            from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
                OpenMetadataConnection,
            )
            from metadata.ingestion.ometa.ometa_api import OpenMetadata

            server_config = self.workflow_config.get("workflowConfig", {}).get(
                "openMetadataServerConfig", {}
            )
            metadata_config = OpenMetadataConnection(
                hostPort=server_config.get("hostPort", "http://localhost:8585/api"),
                authProvider=server_config.get("authProvider", "openmetadata"),
                securityConfig=server_config.get("securityConfig", {}),
            )

            metadata_client = OpenMetadata(metadata_config)

            try:
                from metadata.generated.schema.metadataIngestion.workflow import Source

                source_config = Source(**self.source_config)

                if source_type == "snowflake":
                    from metadata.ingestion.source.database.incremental_metadata_extraction import (
                        IncrementalConfig,
                    )

                    source_instance = source_class(
                        source_config,
                        metadata_client,
                        pipeline_name="discovery",
                        incremental_configuration=IncrementalConfig(enabled=False),
                    )
                else:
                    source_instance = source_class(source_config, metadata_client)

                source_instance.prepare()

                db_schema_pairs = []

                if hasattr(source_instance, "get_database_names"):
                    try:
                        for database_name in source_instance.get_database_names():
                            if hasattr(source_instance, "set_inspector"):
                                source_instance.set_inspector(database_name)

                            if hasattr(source_instance, "get_database_schema_names"):
                                for (
                                    schema_name
                                ) in source_instance.get_database_schema_names():
                                    db_schema_pairs.append(
                                        {
                                            "database": database_name,
                                            "schema": schema_name,
                                        }
                                    )
                    except Exception as e:
                        logger.warning(f"Error getting database schemas: {e}")
                else:
                    database_name = self.service_connection.get("config", {}).get(
                        "database", "default"
                    )

                    if hasattr(source_instance, "get_database_schema_names"):
                        for schema_name in source_instance.get_database_schema_names():
                            db_schema_pairs.append(
                                {"database": database_name, "schema": schema_name}
                            )
                    elif hasattr(source_instance, "inspector"):
                        schemas = source_instance.inspector.get_schema_names()
                        for schema_name in schemas:
                            db_schema_pairs.append(
                                {"database": database_name, "schema": schema_name}
                            )

                if hasattr(source_instance, "close"):
                    source_instance.close()

            except Exception as e:
                logger.error(f"Error during discovery: {e}")
                return []

            # Create shard descriptors with database.schema as unique identifier
            shards = []
            for pair in db_schema_pairs:
                database = pair["database"]
                schema = pair["schema"]
                # Create unique ID that includes both database and schema
                shard_id = (
                    f"{database}.{schema}"
                    if database and database != "default"
                    else schema
                )

                shards.append(
                    {
                        "id": shard_id,
                        "type": "schema",
                        "metadata": {
                            "database": database,
                            "schema": schema,
                            "service": self.source_config.get("serviceName"),
                        },
                    }
                )

            logger.info(f"Discovered {len(shards)} schema shards for processing")
            return shards

        except Exception as e:
            logger.error(f"Error discovering shards: {e}", exc_info=True)
            return []

    def configure_shard(
        self, base_config: Dict[str, Any], shard: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Configure workflow for specific database.schema combination."""
        config = json.loads(json.dumps(base_config))

        database_name = shard["metadata"].get("database")
        schema_name = shard["metadata"].get("schema")

        if "sourceConfig" not in config["source"]:
            config["source"]["sourceConfig"] = {"config": {}}

        config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
            "includes": [f"^{re.escape(schema_name)}$"]
        }

        source_type = config["source"].get("type", "").lower()
        if source_type in ["mysql", "mssql", "snowflake", "bigquery", "redshift"]:
            config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
                "includes": [f"^{re.escape(database_name)}$"]
            }

        return config

    def _matches_database_filter(self, database: str, source_instance: Any) -> bool:
        """Check if database matches configured database filter pattern."""
        if hasattr(source_instance, "source_config") and hasattr(
            source_instance.source_config, "databaseFilterPattern"
        ):
            database_filter = source_instance.source_config.databaseFilterPattern
            return self._matches_filter(database, database_filter)

        return True

    def _matches_schema_filter(self, schema: str, source_instance: Any) -> bool:
        """Check if schema matches configured schema filter pattern."""
        if hasattr(source_instance, "source_config") and hasattr(
            source_instance.source_config, "schemaFilterPattern"
        ):
            schema_filter = source_instance.source_config.schemaFilterPattern
            return self._matches_filter(schema, schema_filter)

        return True

    def _apply_filters(self, schemas: List[str], source_instance: Any) -> List[str]:
        """Apply filters using OpenMetadata's built-in filter logic."""
        filtered = []

        if hasattr(source_instance, "source_config") and hasattr(
            source_instance.source_config, "schemaFilterPattern"
        ):
            schema_filter = source_instance.source_config.schemaFilterPattern
            for schema in schemas:
                if hasattr(source_instance, "filter_entities"):
                    if source_instance.filter_entities([schema], schema_filter):
                        filtered.append(schema)
                else:
                    if self._matches_filter(schema, schema_filter):
                        filtered.append(schema)
        else:
            for schema in schemas:
                filtered.append(schema)

        return filtered

    def _matches_filter(self, schema: str, filter_pattern: Any) -> bool:
        """Check if schema matches filter pattern."""
        if not filter_pattern:
            return True

        if hasattr(filter_pattern, "excludes") and filter_pattern.excludes:
            for pattern in filter_pattern.excludes:
                if re.match(pattern, schema):
                    return False

        if hasattr(filter_pattern, "includes") and filter_pattern.includes:
            for pattern in filter_pattern.includes:
                if re.match(pattern, schema):
                    return True
            return False

        return True


class TimeWindowSharding(ShardingStrategy):
    """Distribute work by time windows for usage/lineage workflows."""

    def __init__(
        self,
        workflow_config: Dict[str, Any],
        window_hours: int = 24,
        days_back: int = 7,
    ):
        """Initialize with time window parameters."""
        super().__init__(workflow_config)
        self.window_hours = window_hours
        self.days_back = days_back

    def discover_shards(self) -> List[Dict[str, Any]]:
        """Create time-based shards for processing."""
        shards = []

        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=self.days_back)

        current = start_time
        while current < end_time:
            window_end = min(current + timedelta(hours=self.window_hours), end_time)

            shards.append(
                {
                    "id": f"{current.isoformat()}_{window_end.isoformat()}",
                    "type": "time_window",
                    "metadata": {
                        "start": current.isoformat(),
                        "end": window_end.isoformat(),
                        "service": self.source_config.get("serviceName"),
                    },
                }
            )

            current = window_end

        logger.info(f"Created {len(shards)} time window shards")
        return shards

    def configure_shard(
        self, base_config: Dict[str, Any], shard: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Configure workflow for specific time window."""
        config = json.loads(json.dumps(base_config))

        if "sourceConfig" not in config["source"]:
            config["source"]["sourceConfig"] = {"config": {}}

        source_config = config["source"]["sourceConfig"]["config"]
        source_config["queryLogStartDate"] = shard["metadata"]["start"]
        source_config["queryLogEndDate"] = shard["metadata"]["end"]

        return config


class ShardingFactory:
    """Factory for creating appropriate sharding strategy."""

    @staticmethod
    def create(workflow_config: Dict[str, Any]) -> ShardingStrategy:
        """Create sharding strategy based on workflow configuration."""
        source_config = workflow_config.get("source", {})
        source_type = source_config.get("type", "").lower()

        workflow_type = (
            source_config.get("sourceConfig", {}).get("config", {}).get("type", "")
        )

        if workflow_type in ["DatabaseUsage", "DatabaseLineage"]:
            return TimeWindowSharding(workflow_config)

        elif workflow_type == "DatabaseMetadata":
            return DatabaseSchemaSharding(workflow_config)

        else:
            logger.info(
                f"Using default schema sharding for workflow type: {workflow_type}"
            )
            return DatabaseSchemaSharding(workflow_config)
