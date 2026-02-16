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
BurstIQ LifeGraph source module for OpenMetadata
"""
import traceback
from typing import Any, Iterable, List, Optional, Tuple

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
    Constraint,
    ConstraintType,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
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
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.burstiq.client import BurstIQClient
from metadata.ingestion.source.database.burstiq.connection import get_connection
from metadata.ingestion.source.database.burstiq.models import BurstIQDictionary
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class Burstiqsource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from BurstIQ LifeGraph
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.service_connection: BurstIQConnection = (
            self.config.serviceConnection.root.config
        )
        self.client: Optional[BurstIQClient] = None
        self._current_dictionary: Optional[BurstIQDictionary] = None

        # Initialize connection and test it
        self.connection_obj = self._get_client()
        self.test_connection()

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadataConnection,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: BurstIQConnection = config.serviceConnection.root.config
        if not isinstance(connection, BurstIQConnection):
            raise InvalidSourceException(
                f"Expected BurstIQConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _get_client(self) -> BurstIQClient:
        """Get or create BurstIQ client"""
        if self.client is None:
            self.client = get_connection(self.service_connection)
        return self.client

    def _get_current_dictionary(self, table_name: str) -> Optional[BurstIQDictionary]:
        """
        Get the currently cached dictionary for the given table name

        Args:
            table_name: Name of the table to get dictionary for

        Returns:
            BurstIQDictionary if cached and matches, None otherwise
        """
        if (
            self._current_dictionary
            and self._current_dictionary.table_name == table_name
        ):
            return self._current_dictionary

        # If not cached or doesn't match, fetch from API
        logger.warning(
            f"Dictionary for table '{table_name}' not in cache, fetching from API..."
        )
        client = self._get_client()
        dict_data = client.get_dictionary_by_name(table_name)
        if dict_data:
            return BurstIQDictionary(**dict_data)
        return None

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        yield "default"

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        yield "default"

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink.

        Also, update the self.inspector value to the current db.
        """

        database_request = CreateDatabaseRequest(
            name=EntityName(database_name),
            service=FullyQualifiedEntityName(self.context.get().database_service),
        )

        yield Either(right=database_request)
        self.register_record_database_request(database_request=database_request)

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

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
        )

        yield Either(right=schema_request)
        self.register_record_schema_request(schema_request=schema_request)

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Fetch dictionaries from BurstIQ and return as table names with type
        Caches each dictionary one at a time for use in yield_table

        :return: tuples of (table_name, table_type)
        """
        schema_name = self.context.get().database_schema
        try:
            if self.source_config.includeTables:
                # Get BurstIQ client
                client = self._get_client()

                # Fetch and iterate dictionaries directly
                logger.info("Fetching dictionaries from BurstIQ LifeGraph...")

                # Iterate directly over dictionaries from API
                for dict_data in client.get_dictionaries():
                    # Clear previous dictionary cache before processing new one
                    self._current_dictionary = None

                    # Parse into Pydantic model and cache it
                    self._current_dictionary = BurstIQDictionary(**dict_data)
                    table_name = self._current_dictionary.table_name

                    # Build FQN for filtering
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                        skip_es_search=True,
                    )

                    # Apply table filter pattern
                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        (
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name
                        ),
                    ):
                        self.status.filter(
                            table_fqn,
                            "Dictionary (Table) Filtered Out",
                        )
                        continue

                    # BurstIQ dictionaries are always Regular tables
                    # Note: _current_dictionary is cached and will be used in yield_table
                    yield table_name, TableType.Regular.value

                # Clear cache after all tables processed
                self._current_dictionary = None

        except ConnectionError as err:
            # Connection errors are critical - fail fast and stop the workflow
            logger.error(
                f"Failed to connect to BurstIQ for schema {schema_name}: {err}"
            )
            logger.debug(traceback.format_exc())
            raise InvalidSourceException(
                f"Cannot connect to BurstIQ API: {err}"
            ) from err
        except Exception as err:
            # Other errors - log and re-raise to fail the workflow
            logger.error(
                f"Fetching dictionaries from BurstIQ failed for schema {schema_name}: {err}"
            )
            logger.debug(traceback.format_exc())
            raise

    def _process_attribute_to_column(
        self, attribute, table_name: str
    ) -> Optional[Column]:
        """
        Process a single BurstIQ attribute and convert it to an OpenMetadata Column

        Args:
            attribute: BurstIQ attribute object
            table_name: Name of the table (for error logging)

        Returns:
            Column object or None if processing fails
        """
        try:
            # Map BurstIQ data types to OpenMetadata data types
            datatype_str, array_element_type = self._map_burstiq_datatype(
                attribute.datatype
            )

            # Build column properties dictionary
            column_props = {
                "name": attribute.name[:256],  # Truncate to 256 chars
                "dataType": datatype_str,
                "dataLength": 1,  # Default data length
            }

            # Set arrayDataType for array columns
            if array_element_type:
                column_props["arrayDataType"] = array_element_type

            # Add precision if available
            if attribute.precision:
                column_props["precision"] = attribute.precision

            # Add description if available
            if attribute.description:
                column_props["description"] = Markdown(attribute.description)

            # Set constraint if field is required (not null)
            if attribute.required:
                column_props["constraint"] = Constraint.NOT_NULL

            # Process nested attributes (children) for OBJECT_ARRAY and OBJECT types
            if attribute.nodeAttributes and len(attribute.nodeAttributes) > 0:
                children = []
                for nested_attr in attribute.nodeAttributes:
                    child_column = self._process_attribute_to_column(
                        nested_attr, table_name
                    )
                    if child_column:
                        children.append(child_column)
                if children:
                    column_props["children"] = children

            # Create and return column
            return Column(**column_props)

        except Exception as exc:
            logger.warning(
                f"Error processing column {attribute.name} for table {table_name}: {exc}"
            )
            logger.debug(traceback.format_exc())
            return None

    def get_columns(
        self, table_name: str, dictionary: BurstIQDictionary
    ) -> Iterable[Column]:
        """
        Process BurstIQ dictionary attributes and convert them to OpenMetadata columns

        Args:
            table_name: Name of the table
            dictionary: BurstIQ dictionary model

        Returns:
            Iterable of Column objects
        """
        for attribute in dictionary.attributes:
            column = self._process_attribute_to_column(attribute, table_name)
            if column:
                yield column

    def _map_burstiq_datatype(self, burstiq_type: str) -> Tuple[str, Optional[str]]:
        """
        Map BurstIQ data types to OpenMetadata/SQL data types

        Args:
            burstiq_type: BurstIQ data type (e.g., INTEGER, STRING, DATETIME, BOOLEAN_ARRAY, etc.)

        Returns:
            Tuple of (mapped_data_type, array_element_type)
            - mapped_data_type: The OpenMetadata data type
            - array_element_type: The element type for arrays (None for non-array types)
        """
        # BurstIQ to OpenMetadata datatype mapping
        type_mapping = {
            "STRING": "VARCHAR",
            "INTEGER": "INT",
            "LONG": "BIGINT",
            "DOUBLE": "DOUBLE",
            "FLOAT": "FLOAT",
            "BOOLEAN": "BOOLEAN",
            "DATETIME": "TIMESTAMP",
            "DATE": "DATE",
            "TIME": "TIME",
            "BINARY": "BINARY",
            "DECIMAL": "DECIMAL",
            "UUID": "VARCHAR",  # UUID stored as string
            "ENUM": "VARCHAR",  # Enum stored as string
            "JSON": "JSON",
            "ARRAY": "ARRAY",
            "OBJECT": "STRUCT",
        }

        # Handle array types - extract element type
        # e.g., BOOLEAN_ARRAY -> (ARRAY, BOOLEAN)
        # e.g., STRING_ARRAY -> (ARRAY, VARCHAR)
        # e.g., OBJECT_ARRAY -> (ARRAY, STRUCT)
        if burstiq_type.endswith("_ARRAY"):
            base_type = burstiq_type.replace("_ARRAY", "")
            element_type = type_mapping.get(base_type, "VARCHAR")
            return ("ARRAY", element_type)

        # Regular types - no array element type
        return (type_mapping.get(burstiq_type, "VARCHAR"), None)

    def get_table_constraints(
        self, dictionary: BurstIQDictionary
    ) -> Optional[List[TableConstraint]]:
        """
        Get all table constraints (primary key, unique, and foreign key) from BurstIQ dictionary

        Args:
            dictionary: BurstIQ dictionary model

        Returns:
            List of table constraints or None if empty
        """
        table_constraints = []

        # Process indexes for primary keys and unique constraints
        for index in dictionary.indexes:
            if index.type == "PRIMARY" and index.attributes:
                table_constraints.append(
                    TableConstraint(
                        constraintType=ConstraintType.PRIMARY_KEY,
                        columns=index.attributes,
                    )
                )
            elif index.type == "UNIQUE" and index.attributes:
                table_constraints.append(
                    TableConstraint(
                        constraintType=ConstraintType.UNIQUE,
                        columns=index.attributes,
                    )
                )

        # Process attributes for foreign keys (reference relationships)
        for attribute in dictionary.attributes:
            if attribute.referenceDictionaryName:
                # Build FQN for the referred table first
                referred_table_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                    table_name=attribute.referenceDictionaryName,
                )

                # Build column FQN by appending column name to table FQN
                if referred_table_fqn:
                    col_fqn = fqn._build(  # pylint: disable=protected-access
                        referred_table_fqn, attribute.name, quote=False
                    )
                    if col_fqn:
                        table_constraints.append(
                            TableConstraint(
                                constraintType=ConstraintType.FOREIGN_KEY,
                                columns=[attribute.name],
                                referredColumns=[FullyQualifiedEntityName(col_fqn)],
                            )
                        )

        return table_constraints if table_constraints else None

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        schema_name = self.context.get().database_schema
        db_name = self.context.get().database

        try:
            # Get the cached dictionary for this table
            dictionary = self._get_current_dictionary(table_name)

            if not dictionary:
                error_msg = f"Dictionary not found for table {table_name}"
                logger.error(error_msg)
                yield Either(
                    left=StackTraceError(
                        name=table_name,
                        error=error_msg,
                        stackTrace=traceback.format_exc(),
                    )
                )
                return

            # Get columns from dictionary attributes
            columns = list(self.get_columns(table_name, dictionary))

            # Get all table constraints (primary, unique, foreign keys)
            table_constraints = self.get_table_constraints(dictionary)

            # Get description from dictionary
            description = (
                Markdown(dictionary.description) if dictionary.description else None
            )

            # Create table request
            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=description,
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=db_name,
                        schema_name=schema_name,
                    )
                ),
            )

            yield Either(right=table_request)

            # Register the request that we'll handle during the deletion checks
            self.register_record(table_request=table_request)

        except Exception as exc:
            error = (
                f"Unexpected exception to yield table "
                f"(database=[{db_name}], schema=[{schema_name}], table=[{table_name}]): {exc}"
            )
            logger.error(error)
            logger.debug(traceback.format_exc())
            yield Either(
                left=StackTraceError(
                    name=table_name, error=error, stackTrace=traceback.format_exc()
                )
            )

    def get_stored_procedures(self) -> Iterable[Any]:
        """
        BurstIQ does not support stored procedures
        """
        return []

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """
        BurstIQ does not support stored procedures
        """
        return []

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        BurstIQ does not support tags at this time
        """
        return []

    def close(self):
        """
        Clean up resources
        """
        # Clear cached dictionary
        self._current_dictionary = None
        # Close client if needed (currently no cleanup required for requests.Session)
        if self.client:
            self.client = None
