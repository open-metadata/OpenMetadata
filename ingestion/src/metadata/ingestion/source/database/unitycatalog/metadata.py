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
Databricks Unity Catalog Source source methods.
"""
import json
import traceback
from typing import Any, Iterable, List, Optional, Tuple

from databricks.sdk.service.catalog import ColumnInfo
from databricks.sdk.service.catalog import TableConstraint as DBTableConstraint

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ConstraintType,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.external_table_lineage_mixin import (
    ExternalTableLineageMixin,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.ingestion.source.database.unitycatalog.client import UnityCatalogClient
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_connection,
    get_sqlalchemy_connection,
)
from metadata.ingestion.source.database.unitycatalog.models import (
    ColumnJson,
    ElementType,
    ForeignConstrains,
    Type,
)
from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_GET_ALL_SCHEMA_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS,
    UNITY_CATALOG_GET_ALL_TABLE_TAGS,
    UNITY_CATALOG_GET_CATALOGS_TAGS,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification

logger = ingestion_logger()

UNITY_CATALOG_TAG = "UNITY CATALOG TAG"
UNITY_CATALOG_TAG_CLASSIFICATION = "UNITY CATALOG TAG CLASSIFICATION"

# pylint: disable=protected-access
class UnitycatalogSource(
    ExternalTableLineageMixin, DatabaseServiceSource, MultiDBSource
):
    """
    Implements the necessary methods to extract
    Database metadata from Databricks Source using
    the unity catalog source
    """

    @retry_with_docker_host()
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection: UnityCatalogConnection = (
            self.config.serviceConnection.root.config
        )
        self.external_location_map = {}
        self.client = get_connection(self.service_connection)
        self.api_client = UnityCatalogClient(self.service_connection)
        self.connection_obj = self.client
        self.table_constraints = []
        self.context.storage_location = None
        self.test_connection()

    def get_configured_database(self) -> Optional[str]:
        return self.service_connection.catalog

    def get_database_names_raw(self) -> Iterable[str]:
        for catalog in self.client.catalogs.list():
            yield catalog.name

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: UnityCatalogConnection = config.serviceConnection.root.config
        if not isinstance(connection, UnityCatalogConnection):
            raise InvalidSourceException(
                f"Expected UnityCatalogConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.

        Catalog ID -> Database
        """
        if self.service_connection.catalog:
            yield self.service_connection.catalog
        else:
            for catalog_name in self.get_database_names_raw():
                try:
                    database_fqn = fqn.build(
                        self.metadata,
                        entity_type=Database,
                        service_name=self.context.get().database_service,
                        database_name=catalog_name,
                    )
                    if filter_by_database(
                        self.config.sourceConfig.config.databaseFilterPattern,
                        (
                            database_fqn
                            if self.config.sourceConfig.config.useFqnForFiltering
                            else catalog_name
                        ),
                    ):
                        self.status.filter(
                            database_fqn,
                            "Database (Catalog ID) Filtered Out",
                        )
                        continue
                    yield catalog_name
                except Exception as exc:
                    self.status.failed(
                        StackTraceError(
                            name=catalog_name,
                            error=f"Unexpected exception to get database name [{catalog_name}]: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        catalog = self.client.catalogs.get(database_name)
        database_request = CreateDatabaseRequest(
            name=database_name,
            service=self.context.get().database_service,
            owners=self.get_owner_ref(catalog.owner),
            description=catalog.comment,
            tags=self.get_database_tag_labels(database_name),
        )
        yield Either(right=database_request)
        self.register_record_database_request(database_request=database_request)

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        catalog_name = self.context.get().database
        for schema in self.client.schemas.list(catalog_name=catalog_name):
            try:
                schema_fqn = fqn.build(
                    self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=schema.name,
                )
                if filter_by_schema(
                    self.config.sourceConfig.config.schemaFilterPattern,
                    (
                        schema_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else schema.name
                    ),
                ):
                    self.status.filter(schema_fqn, "Schema Filtered Out")
                    continue
                yield schema.name
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=schema.name,
                        error=f"Unexpected exception to get database schema [{schema.name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        schema = self.client.schemas.get(
            full_name=f"{self.context.get().database}.{schema_name}"
        )
        schema_request = CreateDatabaseSchemaRequest(
            name=EntityName(schema_name),
            database=FullyQualifiedEntityName(
                fqn.build(
                    metadata=self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                )
            ),
            description=schema.comment,
            owners=self.get_owner_ref(schema.owner),
            tags=self.get_schema_tag_labels(schema_name),
        )
        yield Either(right=schema_request)
        self.register_record_schema_request(schema_request=schema_request)

    def get_tables_name_and_type(self) -> Iterable[Tuple[str, str]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.get().database_schema
        catalog_name = self.context.get().database
        for table in self.client.tables.list(
            catalog_name=catalog_name,
            schema_name=schema_name,
        ):
            try:
                table_name = table.name
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                    table_name=table_name,
                )
                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern,
                    (
                        table_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else table_name
                    ),
                ):
                    self.status.filter(
                        table_fqn,
                        "Table Filtered Out",
                    )
                    continue
                table_type: TableType = TableType.Regular
                if table.table_type:
                    if table.table_type.value.lower() == TableType.View.value.lower():
                        table_type: TableType = TableType.View
                    if table.table_type.value.lower() == "materialized_view":
                        table_type: TableType = TableType.MaterializedView
                    elif (
                        table.table_type.value.lower()
                        == TableType.External.value.lower()
                    ):
                        table_type: TableType = TableType.External
                self.context.get().table_data = table
                yield table_name, table_type
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name=table.name,
                        error=f"Unexpected exception to get table [{table.name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        table = self.client.tables.get(self.context.get().table_data.full_name)
        schema_name = self.context.get().database_schema
        db_name = self.context.get().database
        if table.storage_location and not table.storage_location.startswith("dbfs"):
            self.external_location_map[
                (db_name, schema_name, table_name)
            ] = table.storage_location
        try:
            columns = list(self.get_columns(table_name, table.columns))
            (
                primary_constraints,
                foreign_constraints,
            ) = self.get_table_constraints(table.table_constraints)

            table_constraints = self.update_table_constraints(
                primary_constraints, foreign_constraints, columns
            )

            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=table.comment,
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                    )
                ),
                owners=self.get_owner_ref(table.owner),
                tags=self.get_tag_labels(table_name),
            )
            yield Either(right=table_request)

            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception to yield table [{table_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_table_constraints(
        self, constraints: List[DBTableConstraint]
    ) -> Tuple[List[TableConstraint], List[ForeignConstrains]]:
        """
        Function to handle table constraint for the current table and add it to context
        """

        primary_constraints = []
        foreign_constraints = []
        for constraint in constraints:
            if constraint.primary_key_constraint:
                primary_constraints.append(
                    TableConstraint(
                        constraintType=ConstraintType.PRIMARY_KEY,
                        columns=constraint.primary_key_constraint.child_columns,
                    )
                )
            if constraint.foreign_key_constraint:
                foreign_constraints.append(
                    ForeignConstrains(
                        child_columns=constraint.foreign_key_constraint.child_columns,
                        parent_columns=constraint.foreign_key_constraint.parent_columns,
                        parent_table=constraint.foreign_key_constraint.parent_table,
                    )
                )
        return primary_constraints, foreign_constraints

    def _get_foreign_constraints(self, foreign_columns) -> List[TableConstraint]:
        """
        Search the referred table for foreign constraints
        and get referred column fqn
        """

        table_constraints = []
        for column in foreign_columns:
            referred_column_fqns = []
            ref_table_fqn = column.parent_table
            table_fqn_list = fqn.split(ref_table_fqn)

            referred_table_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                table_name=table_fqn_list[2],
                schema_name=table_fqn_list[1],
                database_name=table_fqn_list[0],
                service_name=self.context.get().database_service,
            )
            if referred_table_fqn:
                for parent_column in column.parent_columns:
                    col_fqn = fqn._build(referred_table_fqn, parent_column, quote=False)
                    if col_fqn:
                        referred_column_fqns.append(FullyQualifiedEntityName(col_fqn))
            else:
                continue

            table_constraints.append(
                TableConstraint(
                    constraintType=ConstraintType.FOREIGN_KEY,
                    columns=column.child_columns,
                    referredColumns=referred_column_fqns,
                )
            )

        return table_constraints

    # pylint: disable=arguments-differ
    def update_table_constraints(
        self, table_constraints, foreign_columns, columns
    ) -> List[TableConstraint]:
        """
        From topology.
        process the table constraints of all tables
        """
        foreign_table_constraints = self._get_foreign_constraints(foreign_columns)
        if foreign_table_constraints:
            if table_constraints:
                table_constraints.extend(foreign_table_constraints)
            else:
                table_constraints = foreign_table_constraints
        return table_constraints

    def prepare(self):
        """Nothing to prepare"""

    def add_complex_datatype_descriptions(
        self, column: Column, column_json: ColumnJson
    ):
        """
        Method to add descriptions to complex datatypes
        """
        try:
            if column.children is None:
                if column_json.metadata and column_json.metadata.comment:
                    column.description = Markdown(column_json.metadata.comment)
            else:
                for i, child in enumerate(column.children):
                    if column_json.metadata and column_json.metadata.comment:
                        column.description = Markdown(column_json.metadata.comment)
                    if (
                        column_json.type
                        and isinstance(column_json.type, Type)
                        and column_json.type.fields
                    ):
                        self.add_complex_datatype_descriptions(
                            child, column_json.type.fields[i]
                        )
                    if (
                        column_json.type
                        and isinstance(column_json.type, Type)
                        and column_json.type.type.lower() == "array"
                        and isinstance(column_json.type.elementType, ElementType)
                    ):
                        self.add_complex_datatype_descriptions(
                            child,
                            column_json.type.elementType.fields[i],
                        )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to add description to complex datatypes for column [{column.name}]: {exc}"
            )

    def get_columns(
        self, table_name: str, column_data: List[ColumnInfo]
    ) -> Iterable[Column]:
        """
        process table regular columns info
        """
        for column in column_data:
            parsed_string = {}
            if column.type_text:
                if column.type_text.lower().startswith("union"):
                    column.type_text = column.type_text.replace(" ", "")
                if (
                    column.type_text.lower() == "struct"
                    or column.type_text.lower() == "array"
                ):
                    column.type_text = column.type_text.lower() + "<>"

                parsed_string = ColumnTypeParser._parse_datatype_string(  # pylint: disable=protected-access
                    column.type_text.lower()
                )
            parsed_string["name"] = column.name[:256]
            parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
            if column.comment:
                parsed_string["description"] = Markdown(column.comment)
            parsed_string["tags"] = self.get_column_tag_labels(
                table_name=table_name, column={"name": column.name}
            )
            parsed_column = Column(**parsed_string)
            self.add_complex_datatype_descriptions(
                column=parsed_column,
                column_json=ColumnJson.model_validate(json.loads(column.type_json)),
            )
            yield parsed_column

    def yield_database_tag(
        self, database_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Get Unity Catalog database/catalog tags using SQL query"""
        query_tag_fqn_builder_mapping = (
            (
                UNITY_CATALOG_GET_CATALOGS_TAGS.format(database=database_name),
                lambda tag: [self.context.get().database_service, database_name],
            ),
            (
                UNITY_CATALOG_GET_ALL_SCHEMA_TAGS.format(database=database_name),
                lambda tag: [
                    self.context.get().database_service,
                    database_name,
                    tag.schema_name,
                ],
            ),
        )
        try:
            with get_sqlalchemy_connection(
                self.service_connection
            ).connect() as connection:
                for query, tag_fqn_builder in query_tag_fqn_builder_mapping:
                    for tag in connection.execute(query):
                        if tag.tag_value:
                            yield from get_ometa_tag_and_classification(
                                tag_fqn=FullyQualifiedEntityName(
                                    fqn._build(*tag_fqn_builder(tag))
                                ),
                                tags=[tag.tag_value],
                                classification_name=tag.tag_name,
                                tag_description=UNITY_CATALOG_TAG,
                                classification_description=UNITY_CATALOG_TAG_CLASSIFICATION,
                                metadata=self.metadata,
                                system_tags=True,
                            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error getting tags for catalog/schema {database_name}: {exc}"
            )

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Get Unity Catalog schema tags using SQL query"""
        database = self.context.get().database
        query_tag_fqn_builder_mapping = (
            (
                UNITY_CATALOG_GET_ALL_TABLE_TAGS.format(
                    database=database, schema=schema_name
                ),
                lambda tag: [
                    self.context.get().database_service,
                    database,
                    schema_name,
                    tag.table_name,
                ],
            ),
            (
                UNITY_CATALOG_GET_ALL_TABLE_COLUMNS_TAGS.format(
                    database=database, schema=schema_name
                ),
                lambda tag: [
                    self.context.get().database_service,
                    database,
                    schema_name,
                    tag.table_name,
                    tag.column_name,
                ],
            ),
        )
        try:
            with get_sqlalchemy_connection(
                self.service_connection
            ).connect() as connection:
                for query, tag_fqn_builder in query_tag_fqn_builder_mapping:
                    for tag in connection.execute(query):
                        if tag.tag_value:
                            yield from get_ometa_tag_and_classification(
                                tag_fqn=FullyQualifiedEntityName(
                                    fqn._build(*tag_fqn_builder(tag))
                                ),
                                tags=[tag.tag_value],
                                classification_name=tag.tag_name,
                                tag_description=UNITY_CATALOG_TAG,
                                classification_description=UNITY_CATALOG_TAG_CLASSIFICATION,
                                metadata=self.metadata,
                                system_tags=True,
                            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error getting tags for schema {schema_name}: {exc}")

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """Not Implemented"""

    def close(self):
        """Nothing to close"""

    # pylint: disable=arguments-renamed
    def get_owner_ref(self, owner: Optional[str]) -> Optional[EntityReferenceList]:
        """
        Method to process the table owners
        """
        if self.source_config.includeOwners is False:
            return None
        try:
            if not owner or not isinstance(owner, str):
                return None
            owner_ref = self.metadata.get_reference_by_email(email=owner)
            if owner_ref:
                return owner_ref
            owner_name = owner.split("@")[0]
            owner_ref = self.metadata.get_reference_by_name(name=owner_name)
            return owner_ref
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner {owner}: {exc}")
        return None
