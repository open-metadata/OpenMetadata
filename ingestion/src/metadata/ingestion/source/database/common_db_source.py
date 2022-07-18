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
Generic source to build SQL connectors.
"""

import traceback
from abc import ABC
from copy import deepcopy
from logging.config import DictConfigurator
from typing import Iterable, Optional, Tuple

from sqlalchemy.engine import Connection
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin
from metadata.ingestion.source.database.sqlalchemy_source import SqlAlchemySource
from metadata.utils import fqn
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_lineage import (
    get_lineage_by_query,
    get_lineage_via_table_entity,
)

logger = ingestion_logger()


class CommonDbSourceService(
    DatabaseServiceSource, SqlColumnHandlerMixin, SqlAlchemySource, ABC
):
    """
    - fetch_column_tags implemented at SqlColumnHandler. Sources should override this when needed
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        # It will be one of the Unions. We don't know the specific type here.
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SQLSourceStatus()

        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)

        self.engine: Engine = get_connection(self.service_connection)
        self.test_connection()

        self._connection = None  # Lazy init as well
        self.data_models = {}
        self.table_constraints = None
        self.database_source_state = set()
        super().__init__()

    def set_inspector(self, database_name: str) -> None:
        """
        When sources override `get_database_names`, they will need
        to setup multiple inspectors. They can use this function.
        :param database_name: new database to set
        """
        logger.info(f"Ingesting from database: {database_name}")

        new_service_connection = deepcopy(self.service_connection)
        new_service_connection.database = database_name
        self.engine = get_connection(new_service_connection)
        self.inspector = inspect(self.engine)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """

        database_name = self.service_connection.__dict__.get("database", "default")
        # By default, set the inspector on the created engine
        self.inspector = inspect(self.engine)
        yield database_name

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """

        yield CreateDatabaseRequest(
            name=database_name,
            service=EntityReference(
                id=self.context.database_service.id,
                type="databaseService",
            ),
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema

        else:
            for schema_name in self.inspector.get_schema_names():

                if filter_by_schema(
                    self.source_config.schemaFilterPattern, schema_name=schema_name
                ):
                    self.status.filter(schema_name, "Schema pattern not allowed")
                    continue

                yield schema_name

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=EntityReference(id=self.context.database.id, type="database"),
        )

    @staticmethod
    def get_table_description(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
        # Catch any exception without breaking the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.warning(f"Table Description Error : {str(err)}")
        else:
            description = table_info["text"]
        return description

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        if self.source_config.includeTables:
            for table_name in self.inspector.get_table_names(schema_name):
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table pattern not allowed",
                    )
                    continue

                if self.is_partition(
                    table_name=table_name,
                    schema_name=schema_name,
                    inspector=self.inspector,
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table_name}",
                        "Table is partition",
                    )
                    continue
                table_name = self.standardize_table_name(schema_name, table_name)
                yield table_name, TableType.Regular

        if self.source_config.includeViews:
            for view_name in self.inspector.get_view_names(schema_name):
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=view_name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{view_name}",
                        "Table pattern not allowed for view",
                    )
                    continue

                view_name = self.standardize_table_name(schema_name, view_name)
                yield view_name, TableType.View

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:

        if table_type == TableType.View:
            try:
                view_definition = inspector.get_view_definition(table_name, schema_name)
                view_definition = (
                    "" if view_definition is None else str(view_definition)
                )
                return view_definition

            except NotImplementedError:
                logger.error("View definition not implemented")
                return ""

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.debug(err)
                logger.error(f"Failed to fetch view definition for {table_name}")
                return ""

    def is_partition(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> bool:
        return False

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        schema_name = self.context.database_schema.name.__root__
        db_name = self.context.database.name.__root__
        try:

            columns, table_constraints = self.get_columns_and_constraints(
                schema_name=schema_name,
                table_name=table_name,
                db_name=db_name,
                inspector=self.inspector,
            )

            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description=self.get_table_description(
                    schema_name=schema_name,
                    table_name=table_name,
                    inspector=self.inspector,
                ),
                columns=columns,
                viewDefinition=self.get_view_definition(
                    table_type=table_type,
                    table_name=table_name,
                    schema_name=schema_name,
                    inspector=self.inspector,
                ),
                tableConstraints=table_constraints if table_constraints else None,
                databaseSchema=EntityReference(
                    id=self.context.database_schema.id,
                    type="databaseSchema",
                ),
                tags=self.get_tag_labels(
                    table_name=table_name
                ),  # Pick tags from context info, if any
            )

            yield table_request

            self.register_record(table_request=table_request)

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)
            self.status.failures.append(
                "{}.{}".format(self.config.serviceName, table_name)
            )

    def yield_view_lineage(
        self, table_name_and_type: Tuple[str, str]
    ) -> Optional[Iterable[AddLineageRequest]]:
        table_name, table_type = table_name_and_type
        table_entity: Table = self.context.table
        schema_name = self.context.database_schema.name.__root__
        db_name = self.context.database.name.__root__
        view_definition = self.get_view_definition(
            table_type=table_type,
            table_name=table_name,
            schema_name=schema_name,
            inspector=self.inspector,
        )
        if table_type != TableType.View or not view_definition:
            return
        # Prevent sqllineage from modifying the logger config
        # Disable the DictConfigurator.configure method while importing LineageRunner
        configure = DictConfigurator.configure
        DictConfigurator.configure = lambda _: None
        from sqllineage.runner import LineageRunner

        # Reverting changes after import is done
        DictConfigurator.configure = configure

        try:
            result = LineageRunner(view_definition)
            if result.source_tables and result.target_tables:
                yield from get_lineage_by_query(
                    self.metadata,
                    query=view_definition,
                    service_name=self.context.database_service.name.__root__,
                    database_name=db_name,
                    schema_name=schema_name,
                ) or []

            else:
                yield from get_lineage_via_table_entity(
                    self.metadata,
                    table_entity=table_entity,
                    service_name=self.context.database_service.name.__root__,
                    database_name=db_name,
                    schema_name=schema_name,
                    query=view_definition,
                ) or []
        except Exception:
            logger.debug(traceback.format_exc())
            logger.debug(f"Query : {view_definition}")
            logger.warning("Could not parse query: Ingesting lineage failed")

    def test_connection(self) -> None:
        """
        Used a timed-bound function to test that the engine
        can properly reach the source
        """
        test_connection(self.engine)

    @property
    def connection(self) -> Connection:
        """
        Return the SQLAlchemy connection
        """
        if not self._connection:
            self._connection = self.engine.connect()

        return self._connection

    def close(self):
        if self.connection is not None:
            self.connection.close()

    def fetch_table_tags(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> None:
        """
        Method to fetch tags associated with table
        """
        pass

    def standardize_table_name(self, schema: str, table: str) -> str:
        return table

    def yield_table_tag(self) -> Iterable[OMetaTagAndCategory]:
        pass
