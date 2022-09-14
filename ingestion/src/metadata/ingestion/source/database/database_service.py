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
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Set, Tuple

from pydantic import BaseModel

try:
    from sqlalchemy.engine import Inspector
except ImportError:
    logging.warning("Cannot import Inspector. Used for typing only.")

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.models.table_metadata import DeleteTable
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.dbt_source import DBTMixin
from metadata.utils import fqn
from metadata.utils.dbt_config import get_dbt_details
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DataModelLink(BaseModel):
    """
    Tmp model to handle data model ingestion
    """

    fqn: FullyQualifiedEntityName
    datamodel: DataModel


class DatabaseServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Database Services.
    service -> db -> schema -> table.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DatabaseService,
                context="database_service",
                processor="yield_database_service",
            )
        ],
        children=["database"],
        post_process="create_dbt_lineage",
    )
    database = TopologyNode(
        producer="get_database_names",
        stages=[
            NodeStage(
                type_=Database,
                context="database",
                processor="yield_database",
                consumer=["database_service"],
            )
        ],
        children=["databaseSchema"],
        post_process="mark_tables_as_deleted",
    )
    databaseSchema = TopologyNode(
        producer="get_database_schema_names",
        stages=[
            NodeStage(
                type_=DatabaseSchema,
                context="database_schema",
                processor="yield_database_schema",
                consumer=["database_service", "database"],
            ),
            NodeStage(
                type_=OMetaTagAndCategory,
                context="tags",
                processor="yield_tag_details",
                ack_sink=False,
                nullable=True,
                cache_all=True,
            ),
        ],
        children=["table"],
    )
    table = TopologyNode(
        producer="get_tables_name_and_type",
        stages=[
            NodeStage(
                type_=Table,
                context="table",
                processor="yield_table",
                consumer=["database_service", "database", "database_schema"],
            ),
            NodeStage(
                type_=AddLineageRequest,
                context="view_lineage",
                processor="yield_view_lineage",
                ack_sink=False,
                nullable=True,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="yield_datamodel",
                ack_sink=False,
            ),
        ],
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
        logger.info(f"Scanned [{record}]")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered [{record}] due to {err}")


class DatabaseServiceSource(DBTMixin, TopologyRunnerMixin, Source, ABC):
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
    inspector: "Inspector"

    topology = DatabaseServiceTopology()
    context = create_source_context(topology)

    def __init__(self):
        dbt_details = get_dbt_details(self.source_config.dbtConfigSource)
        self.dbt_catalog = dbt_details[0] if dbt_details else None
        self.dbt_manifest = dbt_details[1] if dbt_details else None
        self.data_models = {}

    def prepare(self):
        self._parse_data_model()

    def get_status(self) -> SourceStatus:
        return self.status

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_database_service(self, config: WorkflowSource):
        yield self.metadata.get_create_service_from_source(
            entity=DatabaseService, config=config
        )

    @abstractmethod
    def get_database_names(self) -> Iterable[str]:
        """
        Prepares the database name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def get_database_schema_names(self) -> Iterable[str]:
        """
        Prepares the database schema name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Prepares the table name to be sent to stage.
        Filtering happens here.
        """

    @abstractmethod
    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        """
        From topology. To be run for each schema
        """

    def yield_tag_details(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        """
        From topology. To be run for each schema
        """
        if self.source_config.includeTags:
            yield from self.yield_tag(schema_name) or []

    @abstractmethod
    def yield_view_lineage(
        self, table_name_and_type: Tuple[str, str]
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        From topology.
        Parses view definition to get lineage information
        """

    @abstractmethod
    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[CreateTableRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    def yield_datamodel(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[DataModelLink]:
        """
        Gets the current table being processed, fetches its data model
        and sends it ot the sink
        """

        table_name, _ = table_name_and_type
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service.name.__root__,
            database_name=self.context.database.name.__root__,
            schema_name=self.context.database_schema.name.__root__,
            table_name=table_name,
        )
        datamodel = self.get_data_model(table_fqn)
        if datamodel:
            yield DataModelLink(
                fqn=table_fqn,
                datamodel=datamodel,
            )

    def get_tag_by_fqn(self, entity_fqn: str) -> Optional[List[TagLabel]]:
        """
        Pick up the tags registered in the context
        searching by entity FQN
        """
        return [
            TagLabel(
                tagFQN=fqn.build(
                    self.metadata,
                    entity_type=Tag,
                    tag_category_name=tag_and_category.category_name.name.__root__,
                    tag_name=tag_and_category.category_details.name.__root__,
                ),
                labelType=LabelType.Automated,
                state=State.Suggested,
                source=TagSource.Tag,
            )
            for tag_and_category in self.context.tags or []
            if tag_and_category.fqn.__root__ == entity_fqn
        ] or None

    def get_tag_labels(self, table_name: str) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service.name.__root__,
            database_name=self.context.database.name.__root__,
            schema_name=self.context.database_schema.name.__root__,
            table_name=table_name,
        )
        return self.get_tag_by_fqn(entity_fqn=table_fqn)

    def get_column_tag_labels(
        self, table_name: str, column: dict
    ) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        col_fqn = fqn.build(
            self.metadata,
            entity_type=Column,
            service_name=self.context.database_service.name.__root__,
            database_name=self.context.database.name.__root__,
            schema_name=self.context.database_schema.name.__root__,
            table_name=table_name,
            column_name=column["name"],
        )
        return self.get_tag_by_fqn(entity_fqn=col_fqn)

    def register_record(self, table_request: CreateTableRequest) -> None:
        """
        Mark the table record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service.name.__root__,
            database_name=self.context.database.name.__root__,
            schema_name=self.context.database_schema.name.__root__,
            table_name=table_request.name.__root__,
        )

        self.database_source_state.add(table_fqn)
        self.status.scanned(table_fqn)

    def delete_database_tables(self, database_fqn: str) -> Iterable[DeleteTable]:
        """
        Returns Deleted tables
        """
        database_state = self.metadata.list_all_entities(
            entity=Table, params={"database": database_fqn}
        )
        for table in database_state:
            if str(table.fullyQualifiedName.__root__) not in self.database_source_state:
                yield DeleteTable(table=table)

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        if self.source_config.markDeletedTables:
            logger.info(
                f"Mark Deleted Tables set to True. Processing database [{self.context.database.name.__root__}]"
            )
            databse_fqn = fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.config.serviceName,
                database_name=self.context.database.name.__root__,
            )
            yield from self.delete_database_tables(databse_fqn)
