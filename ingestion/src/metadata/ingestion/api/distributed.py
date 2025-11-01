#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Distributed execution framework for OpenMetadata ingestion.

Enables parallel processing of entities across multiple containers/pods
using Argo Workflows or similar orchestrators.
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.models import Either


class ExecutionMode(Enum):
    """Execution mode for workflow"""

    SEQUENTIAL = "sequential"
    DISTRIBUTED = "distributed"


class EntityDescriptor(BaseModel):
    """
    Lightweight descriptor for an entity to be processed.

    Used during discovery phase to identify entities without
    fetching full metadata.
    """

    id: str = Field(..., description="Unique identifier for this entity")
    type: str = Field(..., description="Entity type (table, dashboard, chart, etc.)")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Minimal metadata needed to fetch full entity",
    )
    priority: int = Field(
        default=0, description="Processing priority (higher = process first)"
    )


class ProcessingResult(BaseModel):
    """Result of processing a single entity"""

    entity_id: str
    entity_type: str
    success: bool
    error: Optional[str] = None
    entities_created: int = 0
    processing_time_seconds: Optional[float] = None


class DiscoverableSource(ABC):
    """
    Base class for sources that support distributed execution.

    Sources implementing this interface can have their entities
    discovered and processed in parallel across multiple pods/containers.

    The pattern is:
    1. Discovery phase: Call discover_entities() to get list of EntityDescriptors
    2. Processing phase: For each descriptor, call process_entity() in separate pod
    """

    @abstractmethod
    def discover_entities(self, entity_type: str) -> List[EntityDescriptor]:
        """
        Lightweight discovery of entities to process.

        This should be FAST - only fetch IDs and minimal metadata.
        Do NOT fetch full entity details or perform expensive operations.

        Args:
            entity_type: Type of entities to discover (e.g., "table", "dashboard")

        Returns:
            List of EntityDescriptor with just enough info to process later

        Example for database source:
            ```python
            def discover_entities(self, entity_type: str):
                if entity_type == "table":
                    entities = []
                    for schema in self.get_database_schema_names():
                        for table_name in self.inspector.get_table_names(schema):
                            entities.append(EntityDescriptor(
                                id=f"{schema}.{table_name}",
                                type="table",
                                metadata={"schema": schema, "table": table_name}
                            ))
                    return entities
            ```
        """
        pass

    @abstractmethod
    def process_entity(
        self, descriptor: EntityDescriptor
    ) -> Iterable[Either[Any]]:
        """
        Process a single entity and yield creation requests.

        This should be STATELESS - can run in any pod with no shared state.
        All information needed to process must be in the descriptor.

        Args:
            descriptor: Entity descriptor from discover_entities()

        Yields:
            Either objects containing entity creation requests or errors

        Example:
            ```python
            def process_entity(self, descriptor: EntityDescriptor):
                if descriptor.type == "table":
                    table_name = descriptor.metadata["table"]
                    schema = descriptor.metadata["schema"]

                    # Fetch full table metadata (columns, constraints, etc.)
                    columns = self.inspector.get_columns(table_name, schema)
                    pk = self.inspector.get_pk_constraint(table_name, schema)

                    # Create request
                    yield Either(right=CreateTableRequest(...))
            ```
        """
        pass

    @abstractmethod
    def get_parallelizable_entity_types(self) -> List[str]:
        """
        Return entity types that can be processed in parallel.

        Returns:
            List of entity type names

        Examples:
            - Database source: ["table", "stored_procedure", "database_schema"]
            - Dashboard source: ["dashboard", "chart", "datamodel"]
            - Pipeline source: ["pipeline", "task"]
        """
        pass

    def get_entity_type_dependencies(self) -> Dict[str, List[str]]:
        """
        Return dependencies between entity types.

        If entity type A depends on entity type B, then B must be
        processed before A.

        Returns:
            Dict mapping entity type to list of dependencies

        Example:
            ```python
            {
                "chart": ["dashboard"],  # Charts depend on dashboards
                "table": ["database_schema"],  # Tables depend on schemas
            }
            ```

        Default: No dependencies (all can run in parallel)
        """
        return {}

    def supports_distributed_execution(self) -> bool:
        """
        Check if this source supports distributed execution.

        Returns True by default for sources implementing DiscoverableSource.
        """
        return True

    def estimate_entity_processing_time(self, entity_type: str) -> float:
        """
        Estimate average processing time per entity in seconds.

        Used for:
        - Workflow planning (chunk sizing)
        - Progress estimation
        - Resource allocation

        Args:
            entity_type: Type of entity

        Returns:
            Estimated seconds per entity

        Default: 1.0 second per entity
        """
        return 1.0

    def get_discovery_filters(self) -> Dict[str, Any]:
        """
        Get filters to apply during discovery.

        Can include schema patterns, database filters, etc.

        Returns:
            Dict of filter configuration
        """
        return {}


class DistributedWorkflowMetrics(BaseModel):
    """Metrics for distributed workflow execution"""

    total_entities: int = 0
    processed_entities: int = 0
    failed_entities: int = 0
    skipped_entities: int = 0
    total_processing_time_seconds: float = 0.0
    average_processing_time_seconds: float = 0.0
    parallelism: int = 1
    worker_count: int = 0


class WorkflowPhase(Enum):
    """Phase of workflow execution"""

    DISCOVERY = "discovery"
    PROCESSING = "processing"
    AGGREGATION = "aggregation"
    COMPLETED = "completed"
    FAILED = "failed"
