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
Postgres source module
"""
import traceback
from collections import namedtuple
from typing import Iterable, Optional, Tuple

from sqlalchemy import sql
from sqlalchemy.dialects.postgresql.base import PGDialect, ischema_names
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    IntervalType,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.teams.team import Team
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_ALL_TABLE_PG_POLICY,
    POSTGRES_GET_DB_NAMES,
    POSTGRES_GET_TABLE_NAMES,
    POSTGRES_PARTITION_DETAILS,
    POSTGRES_TABLE_OWNERS,
)
from metadata.ingestion.source.database.postgres.utils import (
    get_column_info,
    get_columns,
    get_table_comment,
    get_view_definition,
)
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)
from metadata.utils.tag_utils import get_ometa_tag_and_classification

TableKey = namedtuple("TableKey", ["schema", "table_name"])

logger = ingestion_logger()


INTERVAL_TYPE_MAP = {
    "list": IntervalType.COLUMN_VALUE.value,
    "hash": IntervalType.COLUMN_VALUE.value,
    "range": IntervalType.TIME_UNIT.value,
}

RELKIND_MAP = {
    "r": TableType.Regular,
    "p": TableType.Partitioned,
    "f": TableType.Foreign,
}

GEOMETRY = create_sqlalchemy_type("GEOMETRY")
POINT = create_sqlalchemy_type("POINT")
POLYGON = create_sqlalchemy_type("POLYGON")

ischema_names.update(
    {
        "geometry": GEOMETRY,
        "point": POINT,
        "polygon": POLYGON,
        "box": create_sqlalchemy_type("BOX"),
        "circle": create_sqlalchemy_type("CIRCLE"),
        "line": create_sqlalchemy_type("LINE"),
        "lseg": create_sqlalchemy_type("LSEG"),
        "path": create_sqlalchemy_type("PATH"),
        "pg_lsn": create_sqlalchemy_type("PG_LSN"),
        "pg_snapshot": create_sqlalchemy_type("PG_SNAPSHOT"),
        "tsquery": create_sqlalchemy_type("TSQUERY"),
        "txid_snapshot": create_sqlalchemy_type("TXID_SNAPSHOT"),
        "xml": create_sqlalchemy_type("XML"),
    }
)


PGDialect.get_all_table_comments = get_all_table_comments
PGDialect.get_table_comment = get_table_comment
PGDialect._get_column_info = get_column_info  # pylint: disable=protected-access
PGDialect.get_view_definition = get_view_definition
PGDialect.get_columns = get_columns
PGDialect.get_all_view_definitions = get_all_view_definitions

PGDialect.ischema_names = ischema_names


class PostgresSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Postgres Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: PostgresConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PostgresConnection):
            raise InvalidSourceException(
                f"Expected PostgresConnection, but got {connection}"
            )
        return cls(config, metadata)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Overwrite the inspector implementation to handle partitioned
        and foreign types
        """
        result = self.connection.execute(
            sql.text(POSTGRES_GET_TABLE_NAMES),
            {"schema": schema_name},
        )

        return [
            TableNameAndType(
                name=name, type_=RELKIND_MAP.get(relkind, TableType.Regular)
            )
            for name, relkind in result
        ]

    def get_database_names(self) -> Iterable[str]:
        if not self.config.serviceConnection.__root__.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.__root__.config.database
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            results = self.connection.execute(POSTGRES_GET_DB_NAMES)
            for res in results:
                row = list(res)
                new_database = row[0]
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
                    database_name=new_database,
                )

                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    database_fqn
                    if self.source_config.useFqnForFiltering
                    else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {new_database}: {exc}"
                    )

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> Tuple[bool, TablePartition]:
        result = self.engine.execute(
            POSTGRES_PARTITION_DETAILS.format(
                table_name=table_name, schema_name=schema_name
            )
        ).all()
        if result:
            partition_details = TablePartition(
                intervalType=INTERVAL_TYPE_MAP.get(
                    result[0].partition_strategy, IntervalType.COLUMN_VALUE.value
                ),
                columns=[row.column_name for row in result if row.column_name],
            )
            return True, partition_details
        return False, None

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Fetch Tags
        """
        try:
            result = self.engine.execute(
                POSTGRES_GET_ALL_TABLE_PG_POLICY.format(
                    database_name=self.context.database.name.__root__,
                    schema_name=schema_name,
                )
            ).all()
            for res in result:
                row = list(res)
                fqn_elements = [name for name in row[2:] if name]
                yield from get_ometa_tag_and_classification(
                    tag_fqn=fqn._build(  # pylint: disable=protected-access
                        self.context.database_service.name.__root__, *fqn_elements
                    ),
                    tags=[row[1]],
                    classification_name=self.service_connection.classificationName,
                    tag_description="Postgres Tag Value",
                    classification_description="Postgres Tag Name",
                )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Tags and Classification",
                    error=f"Skipping Policy Tag: {exc}",
                    stack_trace=traceback.format_exc(),
                )
            )

    def get_table_owner(self, table_name, schema=None):

        result = self.connection.execute(POSTGRES_TABLE_OWNERS)
        for table in result:
            self.all_table_owners[(table[1], table[0])] = table[2]
        return self.all_table_owners.get((table_name, schema))

    def get_owner_detail(self, schema_name: str, table_name: str) -> Optional[str]:
        """Get database owner
        Args
        schema_name, table_name
        Returns:
            Optional[EntityReference]
        """
        owner = None
        owner_name = self.get_table_owner(table_name, schema_name)
        user_owner_fqn = fqn.build(
            self.metadata, entity_type=User, user_name=owner_name
        )
        if user_owner_fqn:
            owner = self.metadata.get_entity_reference(entity=User, fqn=user_owner_fqn)
        else:
            team_owner_fqn = fqn.build(
                self.metadata, entity_type=Team, team_name=owner_name
            )
            if team_owner_fqn:
                owner = self.metadata.get_entity_reference(
                    entity=Team, fqn=team_owner_fqn
                )
            else:
                logger.warning(
                    "Unable to ingest owner from Postgres since no user or"
                    f" team was found with name {owner_name}"
                )
        return owner

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        schema_name = self.context.database_schema.name.__root__
        try:
            (
                columns,
                table_constraints,
                foreign_columns,
            ) = self.get_columns_and_constraints(
                schema_name=schema_name,
                table_name=table_name,
                db_name=self.context.database.name.__root__,
                inspector=self.inspector,
            )

            view_definition = self.get_view_definition(
                table_type=table_type,
                table_name=table_name,
                schema_name=schema_name,
                inspector=self.inspector,
            )
            table_constraints = self.update_table_constraints(
                table_constraints, foreign_columns
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
                tableConstraints=table_constraints,
                viewDefinition=view_definition,
                databaseSchema=self.context.database_schema.fullyQualifiedName,
                tags=self.get_tag_labels(
                    table_name=table_name
                ),  # Pick tags from context info, if any
                sourceUrl=self.get_source_url(
                    table_name=table_name,
                    schema_name=schema_name,
                    database_name=self.context.database.name.__root__,
                    table_type=table_type,
                ),
                owner=self.get_owner_detail(schema_name, table_name),
            )

            is_partitioned, partition_details = self.get_table_partition_details(
                table_name=table_name, schema_name=schema_name, inspector=self.inspector
            )
            if is_partitioned:
                table_request.tableType = TableType.Partitioned.value
                table_request.tablePartition = partition_details

            yield Either(right=table_request)

            # Register the request that we'll handle during the deletion checks
            self.register_record(table_request=table_request)

            # Flag view as visited
            if table_type == TableType.View or view_definition:
                table_view = TableView.parse_obj(
                    {
                        "table_name": table_name,
                        "schema_name": schema_name,
                        "db_name": self.context.database.name.__root__,
                        "view_definition": view_definition,
                    }
                )
                self.context.table_views.append(table_view)

        except Exception as exc:
            error = f"Unexpected exception to yield table [{table_name}]: {exc}"
            yield Either(
                left=StackTraceError(
                    name=table_name, error=error, stack_trace=traceback.format_exc()
                )
            )

    def process_owner(self, table_name_and_type: Tuple[str, str]):
        try:
            if self.source_config.includeOwners:
                schema_name = self.context.database_schema.name.__root__
                table_name = table_name_and_type[0]
                owner = self.get_owner_detail(schema_name, table_name)

                if owner:
                    self.metadata.patch_owner(
                        entity=Database,
                        source=self.context.database,
                        owner=owner,
                        force=False,
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner for table {table_name}: {exc}")
