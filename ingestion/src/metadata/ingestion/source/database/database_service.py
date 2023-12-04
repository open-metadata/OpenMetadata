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
from typing import Any, Iterable, List, Optional, Set, Tuple, Union

from pydantic import BaseModel
from sqlalchemy.engine import Inspector

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    Table,
    TableConstraint,
    TableType,
)
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
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.life_cycle import OMetaLifeCycleData
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.source.connections import get_test_connection_fn
from metadata.utils import fqn
from metadata.utils.filters import filter_by_schema
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_tag_label

logger = ingestion_logger()


class DataModelLink(BaseModel):
    """
    Tmp model to handle data model ingestion
    """

    table_entity: Table
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
                processor="yield_create_request_database_service",
                overwrite=False,
                must_return=True,
            ),
        ],
        children=["database"],
        # Note how we have `yield_view_lineage` and `yield_stored_procedure_lineage`
        # as post_processed. This is because we cannot ensure proper lineage processing
        # until we have finished ingesting all the metadata from the source.
        post_process=["yield_view_lineage", "yield_procedure_lineage_and_queries"],
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
    )
    databaseSchema = TopologyNode(
        producer="get_database_schema_names",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_database_schema_tag_details",
                nullable=True,
                cache_all=True,
            ),
            NodeStage(
                type_=DatabaseSchema,
                context="database_schema",
                processor="yield_database_schema",
                consumer=["database_service", "database"],
            ),
        ],
        children=["table", "stored_procedure"],
        post_process=["mark_tables_as_deleted", "mark_stored_procedures_as_deleted"],
    )
    table = TopologyNode(
        producer="get_tables_name_and_type",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_table_tag_details",
                nullable=True,
                cache_all=True,
            ),
            NodeStage(
                type_=Table,
                context="table",
                processor="yield_table",
                consumer=["database_service", "database", "database_schema"],
            ),
            NodeStage(
                type_=OMetaLifeCycleData,
                processor="yield_life_cycle_data",
                nullable=True,
            ),
        ],
    )
    stored_procedure = TopologyNode(
        producer="get_stored_procedures",
        stages=[
            NodeStage(
                type_=StoredProcedure,
                context="stored_procedures",
                processor="yield_stored_procedure",
                consumer=["database_service", "database", "database_schema"],
                cache_all=True,
            ),
        ],
    )


class DatabaseServiceSource(
    TopologyRunnerMixin, Source, ABC
):  # pylint: disable=too-many-public-methods
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    source_config: DatabaseServiceMetadataPipeline
    config: WorkflowSource
    database_source_state: Set = set()
    stored_procedure_source_state: Set = set()
    # Big union of types we want to fetch dynamically
    service_connection: DatabaseConnection.__fields__["config"].type_

    # When processing the database, the source will update the inspector if needed
    inspector: Inspector

    topology = DatabaseServiceTopology()
    context = create_source_context(topology)

    def prepare(self):
        """By default, there is no preparation needed"""

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_database_service(
        self, config: WorkflowSource
    ) -> Iterable[Either[CreateDatabaseServiceRequest]]:
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=DatabaseService, config=config
            )
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
    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each schema
        """

    def yield_table_tags(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology. To be run for each table
        """

    def yield_table_tag_details(
        self, table_name_and_type: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each table
        """
        if self.source_config.includeTags:
            yield from self.yield_table_tags(table_name_and_type) or []

    def yield_database_schema_tag_details(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each schema
        """
        if self.source_config.includeTags:
            yield from self.yield_tag(schema_name) or []

    @abstractmethod
    def yield_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        From topology.
        Parses view definition to get lineage information
        """

    def update_table_constraints(
        self, table_constraints: List[TableConstraint], foreign_columns: []
    ) -> List[TableConstraint]:
        """
        process the table constraints of all tables
        transform SQLAlchemy returned foreign_columns into list of TableConstraint.
        """

    @abstractmethod
    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    @abstractmethod
    def get_stored_procedures(self) -> Iterable[Any]:
        """List stored procedures to process"""

    @abstractmethod
    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Process the stored procedure information"""

    @abstractmethod
    def yield_procedure_lineage_and_queries(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """Extracts the lineage information from Stored Procedures"""

    def get_raw_database_schema_names(self) -> Iterable[str]:
        """
        fetch all schema names without any filtering.
        """
        yield from self.get_database_schema_names()

    def get_tag_by_fqn(self, entity_fqn: str) -> Optional[List[TagLabel]]:
        """
        Pick up the tags registered in the context
        searching by entity FQN
        """

        tag_labels = []
        for tag_and_category in self.context.tags or []:
            if tag_and_category.fqn and tag_and_category.fqn.__root__ == entity_fqn:
                tag_label = get_tag_label(
                    metadata=self.metadata,
                    tag_name=tag_and_category.tag_request.name.__root__,
                    classification_name=tag_and_category.classification_request.name.__root__,
                )
                if tag_label:
                    tag_labels.append(tag_label)
        return tag_labels or None

    def get_tag_labels(self, table_name: str) -> Optional[List[TagLabel]]:
        """
        This will only get executed if the tags context
        is properly informed
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            table_name=table_name,
            skip_es_search=True,
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
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            table_name=table_name,
            column_name=column["name"],
        )
        return self.get_tag_by_fqn(entity_fqn=col_fqn)

    def register_record_table_request(self, table_request: CreateTableRequest) -> None:
        """
        Mark the table record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            table_name=table_request.name.__root__,
            skip_es_search=True,
        )

        self.database_source_state.add(table_fqn)

    def register_record_stored_proc_request(
        self, stored_proc_request: CreateStoredProcedureRequest
    ) -> None:
        """
        Mark the table record as scanned and update the database_source_state
        """
        table_fqn = fqn.build(
            self.metadata,
            entity_type=StoredProcedure,
            service_name=self.context.database_service,
            database_name=self.context.database,
            schema_name=self.context.database_schema,
            procedure_name=stored_proc_request.name.__root__,
            skip_es_search=True,
        )

        self.database_source_state.add(table_fqn)

    def _get_filtered_schema_names(
        self, return_fqn: bool = False, add_to_status: bool = True
    ) -> Iterable[str]:
        for schema_name in self.get_raw_database_schema_names():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service,
                database_name=self.context.database,
                schema_name=schema_name,
            )
            if filter_by_schema(
                self.source_config.schemaFilterPattern,
                schema_fqn if self.source_config.useFqnForFiltering else schema_name,
            ):
                if add_to_status:
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                continue
            yield schema_fqn if return_fqn else schema_name

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        if self.source_config.markDeletedTables:
            logger.info(
                f"Mark Deleted Tables set to True. Processing database [{self.context.database}]"
            )
            schema_fqn_list = self._get_filtered_schema_names(
                return_fqn=True, add_to_status=False
            )

            for schema_fqn in schema_fqn_list:
                yield from delete_entity_from_source(
                    metadata=self.metadata,
                    entity_type=Table,
                    entity_source_state=self.database_source_state,
                    mark_deleted_entity=self.source_config.markDeletedTables,
                    params={"database": schema_fqn},
                )

    def mark_stored_procedures_as_deleted(self):
        """
        Use the current inspector to mark Stored Procedures as deleted
        """
        if self.source_config.markDeletedStoredProcedures:
            logger.info(
                f"Mark Deleted Stored Procedures Processing database [{self.context.database}]"
            )

            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=StoredProcedure,
                entity_source_state=self.stored_procedure_source_state,
                mark_deleted_entity=self.source_config.markDeletedStoredProcedures,
                params={"databaseSchema": self.context.stored_procedures},
            )

    def yield_life_cycle_data(self, _) -> Iterable[Either[OMetaLifeCycleData]]:
        """
        Get the life cycle data of the table
        """

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.connection_obj, self.service_connection)
