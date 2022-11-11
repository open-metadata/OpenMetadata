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
from typing import Iterable, List, Optional, Set, Tuple

from pydantic import BaseModel
from sqlalchemy.engine import Inspector

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createLocation import CreateLocationRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.location import Location
from metadata.generated.schema.entity.data.table import (
    Column,
    DataModel,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
)
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.storage import StorageServiceType
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


class TableLocationLink(BaseModel):
    """
    Model to handle table and location link
    """

    table_fqn: FullyQualifiedEntityName
    location_fqn: FullyQualifiedEntityName


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
            NodeStage(
                type_=StorageService,
                context="storage_service",
                processor="yield_storage_service",
                nullable=True,
            ),
        ],
        children=["database"],
        post_process=[
            "process_dbt_lineage_and_descriptions",
            "create_dbt_tests_suite_definition",
            "create_dbt_test_cases",
            "yield_view_lineage",
        ],
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
        post_process=["mark_tables_as_deleted"],
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
                type_=Location,
                context="location",
                processor="yield_location",
                consumer=["storage_service"],
                nullable=True,
            ),
            NodeStage(
                type_=DataModelLink,
                processor="yield_datamodel",
                ack_sink=False,
            ),
            NodeStage(
                type_=TableLocationLink,
                processor="yield_table_location_link",
                ack_sink=False,
                nullable=True,
            ),
        ],
    )


class SQLSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    success: List[str] = []
    failures: List[str] = []
    warnings: List[str] = []
    filtered: List[str] = []

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.debug(f"Scanned [{record}]")

    def filter(self, key: str, reason: str) -> None:
        logger.debug(f"Filtered [{key}] due to {reason}")
        self.filtered.append({key: reason})


class DatabaseServiceSource(
    DBTMixin, TopologyRunnerMixin, Source, ABC
):  # pylint: disable=too-many-public-methods
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    status: SQLSourceStatus
    source_config: DatabaseServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    database_source_state: Set = set()
    # Big union of types we want to fetch dynamically
    service_connection: DatabaseConnection.__fields__["config"].type_

    # When processing the database, the source will update the inspector if needed
    inspector: Inspector

    topology = DatabaseServiceTopology()
    context = create_source_context(topology)

    # Initialize DBT structures for all Databases
    data_models = {}
    dbt_tests = {}

    def __init__(self):

        if (
            hasattr(self.source_config.dbtConfigSource, "dbtSecurityConfig")
            and self.source_config.dbtConfigSource.dbtSecurityConfig is None
        ):
            logger.info("dbtConfigSource is not configured")
            self.dbt_catalog = None
            self.dbt_manifest = None
            self.dbt_run_results = None
            self.data_models = {}
        else:
            dbt_details = get_dbt_details(self.source_config.dbtConfigSource)
            if dbt_details:
                self.dbt_catalog = dbt_details[0] if len(dbt_details) == 3 else None
                self.dbt_manifest = dbt_details[1] if len(dbt_details) == 3 else None
                self.dbt_run_results = dbt_details[2] if len(dbt_details) == 3 else None
                self.data_models = {}

    def prepare(self):
        self._parse_data_model()

    def get_status(self) -> SourceStatus:
        return self.status

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_database_service(self, config: WorkflowSource):
        yield self.metadata.get_create_service_from_source(
            entity=DatabaseService, config=config
        )

    def yield_storage_service(self, config: WorkflowSource):
        if hasattr(self.service_connection, "storageServiceName"):
            service_json = {
                "name": self.service_connection.storageServiceName,
                "serviceType": StorageServiceType.S3,
            }
            storage_service = CreateStorageServiceRequest(**service_json)
            yield storage_service

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
    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        """
        From topology.
        Parses view definition to get lineage information
        """

    @abstractmethod
    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[CreateTableRequest]:
        """
        From topology.
        Prepare a table request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

    def yield_location(
        self,
        table_name_and_type: Tuple[str, TableType],  # pylint: disable=unused-argument
    ) -> Iterable[CreateLocationRequest]:
        """
        From topology.
        Prepare a location request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """
        return

    def get_raw_database_schema_names(self) -> Iterable[str]:
        """
        fetch all schema names without any filtering.
        """
        yield from self.get_database_schema_names()

    def yield_datamodel(
        self, table_name_and_type: Tuple[str, TableType]
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

        dbt_tag_labels = None
        if datamodel:
            logger.info("Processing DBT Tags")
            dbt_tag_labels = datamodel.tags
            if not dbt_tag_labels:
                dbt_tag_labels = []
            for column in datamodel.columns:
                if column.tags:
                    dbt_tag_labels.extend(column.tags)
            if dbt_tag_labels:
                for tag_label in dbt_tag_labels:
                    yield OMetaTagAndCategory(
                        category_name=CreateTagCategoryRequest(
                            name="DBTTags",
                            description="",
                        ),
                        category_details=CreateTagRequest(
                            name=tag_label.tagFQN.__root__.split(".")[1],
                            description="DBT Tags",
                        ),
                    )
            yield DataModelLink(
                fqn=table_fqn,
                datamodel=datamodel,
            )

    def yield_table_location_link(
        self,
        table_name_and_type: Tuple[str, TableType],  # pylint: disable=unused-argument
    ) -> Iterable[TableLocationLink]:
        """
        Gets the current location being processed, fetches its data model
        and sends it ot the sink
        """
        return

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

    def delete_schema_tables(self, schema_fqn: str) -> Iterable[DeleteTable]:
        """
        Returns Deleted tables
        """
        database_state = self.metadata.list_all_entities(
            entity=Table, params={"database": schema_fqn}
        )
        for table in database_state:
            if str(table.fullyQualifiedName.__root__) not in self.database_source_state:
                yield DeleteTable(table=table)

    def fetch_all_schema_and_delete_tables(self):
        """
        Fetch all schemas and delete tables
        """
        database_fqn = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.config.serviceName,
            database_name=self.context.database.name.__root__,
        )
        schema_list = self.metadata.list_all_entities(
            entity=DatabaseSchema, params={"database": database_fqn}
        )
        for schema in schema_list:
            yield from self.delete_schema_tables(schema.fullyQualifiedName.__root__)

    def mark_tables_as_deleted(self):
        """
        Use the current inspector to mark tables as deleted
        """
        if self.source_config.markDeletedTables:
            logger.info(
                f"Mark Deleted Tables set to True. Processing database [{self.context.database.name.__root__}]"
            )
            if self.source_config.markDeletedTablesFromFilterOnly:
                schema_names_list = self.get_database_schema_names()
                for schema_name in schema_names_list:
                    schema_fqn = fqn.build(
                        self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.config.serviceName,
                        database_name=self.context.database.name.__root__,
                        schema_name=schema_name,
                    )

                    yield from self.delete_schema_tables(schema_fqn)
            else:
                yield from self.fetch_all_schema_and_delete_tables()
