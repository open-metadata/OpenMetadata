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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""


from typing import List, Optional

from sqlalchemy import Column, MetaData, inspect
from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeType,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_SESSION_TAG_QUERY,
)
from metadata.profiler.orm.converter.base import ometa_to_sqa_orm
from metadata.utils.collaborative_super import Root
from metadata.utils.constants import NON_SQA_DATABASE_CONNECTIONS


class SQAInterfaceMixin(Root):
    """SQLAlchemy interface mixin grouping shared methods between sequential and threaded executor"""

    def _get_engine(self):
        """Get engine for database

        Args:
            service_connection_config: connection details for the specific service
        Returns:
            sqlalchemy engine
        """
        engine = get_connection(super().service_connection_config)

        return engine

    def get_columns(self) -> Column:
        """get columns from an orm object"""
        return inspect(super().table).c

    def set_session_tag(self, session) -> None:
        """
        Set session query tag for snowflake

        Args:
            service_connection_config: connection details for the specific service
        """
        if (
            self.service_connection_config.type.value == SnowflakeType.Snowflake.value
            and hasattr(self.service_connection_config, "queryTag")
            and self.service_connection_config.queryTag
        ):
            session.execute(
                SNOWFLAKE_SESSION_TAG_QUERY.format(
                    query_tag=self.service_connection_config.queryTag
                )
            )

    def set_catalog(self, session) -> None:
        """Set the catalog or database for the session.

        Args:
            session (Session): sqa session object
        """
        if isinstance(
            self.service_connection_config,
            (UnityCatalogConnection, DatabricksConnection),
        ):
            session.get_bind().execute(
                "USE CATALOG %(catalog)s;",
                {"catalog": self.service_connection_config.catalog},
            ).first()

        if isinstance(
            self.service_connection_config, (MysqlConnection, MariaDBConnection)
        ):
            session.get_bind().execute(
                f"USE {self.table_entity.databaseSchema.name};",
            )

    def close(self):
        """close session"""
        self.session.close()

    def _get_sample_columns(self) -> List[str]:
        """Get the list of columns to use for the sampler"""
        return [
            column.name
            for column in self.table.__table__.columns
            if column.name in {col.name.root for col in self.table_entity.columns}
        ]

    def build_table_orm(
        self, table: Table, service_conn_config: BaseModel, ometa_client: OpenMetadata
    ) -> Optional[DeclarativeMeta]:
        """Build the ORM table if needed for the sampler and profiler interfaces"""
        if service_conn_config.type.value not in NON_SQA_DATABASE_CONNECTIONS:
            orm_obj = ometa_to_sqa_orm(table, ometa_client, MetaData())
            return orm_obj
        return None
