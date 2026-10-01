# Derived from https://github.com/TIKI-Institut/openmetadata-dremio-connector
# Copyright TIKI GmbH, licensed under the Apache License, Version 2.0.
# Imported unchanged as the starting point of the Dremio connector; see the
# following commits for the adaptations made to it.

import traceback
from collections.abc import Iterable

from sqlalchemy.engine import Inspector

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, TableConstraint, TableType
from metadata.generated.schema.entity.services.connections.database.dremioConnection import (
    DremioConnection as DremioConnectionConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService, TableNameAndType
from metadata.ingestion.source.database.dremio.dialect import quote_path
from metadata.ingestion.source.database.dremio.queries import (
    DREMIO_GET_DATABASES,
    DREMIO_GET_SCHEMAS,
    DREMIO_GET_TABLES,
    DREMIO_GET_VIEWS,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DremioSource(CommonDbSourceService, MultiDBSource):
    """
    Dremio has following design:
    <Space>.<Folder>(.<Folder+N>).<Relation>
    In this connector / source implementation we mapped this design as follow:
    - Space = Database
    - Folders = Schema
    - Relation = Table / View name etc.
    But dremio interprets spaces and folders as schematas, so we have to handle them specially:
    - Only select spaces when retrieving databases
    - Remove spaces from schemas, like in get_raw_database_schema_names
    - Readd database to schema when querying tables / views, because dremio expects the full path
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.database = None

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None) -> "DremioSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DremioConnectionConfig = config.serviceConnection.root.config
        if not isinstance(connection, DremioConnectionConfig):
            raise InvalidSourceException(f"Expected DremioConnection, but got {connection}")
        return cls(config, metadata)

    # ------------------------------------------------------------------------------------------------------------------
    # ############################
    # ### extend MultiDBSource ###
    # ############################
    def get_configured_database(self) -> str | None:
        return self.service_connection.database

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(DREMIO_GET_DATABASES)

    # ------------------------------------------------------------------------------------------------------------------
    # ### ################################
    # ### Extend CommonDbSourceService ###
    # ### ################################
    def get_database_names(self) -> Iterable[str]:
        configured_database = self.get_configured_database()  # pylint: disable=assignment-from-none
        if configured_database:
            self.set_inspector(database_name=configured_database)
            yield configured_database
        else:
            for new_database in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_database,
                )
                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    database_fqn if self.source_config.useFqnForFiltering else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue
                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as exc:
                    logger.error(traceback.format_exc())
                    logger.warning("Error trying to process database %s: %s", new_database, exc)

    @staticmethod
    def get_table_description(schema_name: str, table_name: str, inspector: Inspector) -> str:
        # Dremio has no table comment to read through SQL: the description of a dataset is its wiki,
        # which is only available from the REST API.
        return ""

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.database is not None:
            schemas = self._execute_database_query(
                DREMIO_GET_SCHEMAS.format(database_name=self._escape_literal(self.database))
            )
        else:
            schemas = self.inspector.get_schema_names()

        for schema_name in schemas:
            cleaned_schema_name = self._remove_database_from_schema_name(schema_name)

            yield cleaned_schema_name

    def _remove_database_from_schema_name(self, schema_name: str) -> str:
        """
        `<database>.<folder>` is the schema `<folder>`. The objects at the root of the
        database are in a schema that has the name of the database.
        """
        if self.database is not None and schema_name.startswith(self.database + "."):
            return schema_name[len(self.database) + 1 :]
        return schema_name

    def _add_database_to_schema_name(self, schema_name: str) -> str:
        if self.database is not None:
            if schema_name is None or schema_name.strip() == "" or schema_name == self.database:
                return self.database
            return self.database + "." + schema_name
        return schema_name

    @staticmethod
    def _escape_literal(value: str) -> str:
        return value.replace("'", "''")

    def get_columns_and_constraints(  # pylint: disable=too-many-locals
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType = None,
    ) -> tuple[list[Column] | None, list[TableConstraint] | None, list[dict] | None]:
        return super().get_columns_and_constraints(
            self._add_database_to_schema_name(schema_name), table_name, db_name, inspector, table_type
        )

    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        """
        The SQL of a view is stored as a `CREATE VIEW` statement, as the other
        connectors do. Without a target, the lineage parser links the view to
        its source tables but derives no column lineage.
        """
        view_definition = super().get_schema_definition(
            table_type, table_name, self._add_database_to_schema_name(schema_name), inspector
        )

        if view_definition and table_type == TableType.View:
            return f"CREATE VIEW {quote_path(None, table_name)} AS {view_definition}"
        return view_definition

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        # sqlalchemy-dremio has only implemented get_table_names but also returns Views in this implementation.
        # Instead of using this implementation we created our own query to return only TABLES and in the method query_view_names_and_types only VIEWS
        return [
            TableNameAndType(name=table_name)
            for table_name in self._execute_database_query(
                DREMIO_GET_TABLES.format(
                    schema_name=self._escape_literal(self._add_database_to_schema_name(schema_name))
                )
            )
            or []
        ]

    def query_view_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        return [
            TableNameAndType(name=table_name, type_=TableType.View)
            for table_name in self._execute_database_query(
                DREMIO_GET_VIEWS.format(
                    schema_name=self._escape_literal(self._add_database_to_schema_name(schema_name))
                )
            )
            or []
        ]

    def set_inspector(self, database_name: str) -> None:
        # The parent rebuilds the engine for the new database. We also keep the
        # database name, since Dremio expects it as the first part of the
        # schema path (see the class docstring).
        super().set_inspector(database_name)
        self.database = database_name
