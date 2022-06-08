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
Base class for ingesting database services
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterable, List, Set

from sqlalchemy.engine import Inspector

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabaseServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Database Services.
    service -> db -> schema -> table.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        type_=DatabaseService,
        context="database_service",
        producer="yield_database_service",
        children=["database"],
    )
    database = TopologyNode(
        type_=Database,
        context="database",
        producer="yield_database",
        children=["databaseSchema"],
        consumer=["database_service"],
        post_process="mark_tables_as_deleted",
    )
    databaseSchema = TopologyNode(
        type_=DatabaseSchema,
        context="database_schema",
        producer="yield_database_schema",
        children=["table"],
        consumer=["database_service", "database"],
    )
    table = TopologyNode(
        type_=Table,
        context="table",
        producer="yield_table",
        consumer=["database_service", "database", "database_schema"],
    )


@dataclass
class SQLSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    success: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    filtered: List[str] = field(default_factory=list)

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Table Scanned: {record}")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered Table {record} due to {err}")


class DatabaseServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    status: SQLSourceStatus
    source_config: DatabaseServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    database_source_state: Set
    # Big union of types we want to fetch dynamically
    service_connection: DatabaseConnection.__fields__["config"].type_

    # When processing the database, the source will update the inspector if needed
    inspector: Inspector

    topology = DatabaseServiceTopology()
    context = create_source_context(topology)

    def yield_database_service(self):
        yield self.metadata.get_create_service_from_source(
            entity=DatabaseService, config=self.config
        )

    @abstractmethod
    def yield_database(self) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_database_schema(self) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_table(self) -> Iterable[CreateTableRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """
