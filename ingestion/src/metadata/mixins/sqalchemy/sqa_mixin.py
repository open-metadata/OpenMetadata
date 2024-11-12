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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""


from typing import List

from sqlalchemy import Column, inspect

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeType,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_SESSION_TAG_QUERY,
)


class SQAInterfaceMixin:
    """SQLAlchemy interface mixin grouping shared methods between sequential and threaded executor"""

    def _get_engine(self):
        """Get engine for database

        Args:
            service_connection_config: connection details for the specific service
        Returns:
            sqlalchemy engine
        """
        engine = get_connection(self.service_connection_config)

        return engine

    def get_columns(self) -> Column:
        """get columns from an orm object"""
        return inspect(self.table).c

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
        """Set catalog for the session. Right now only databricks and unity catalog requires it

        Args:
            session (Session): sqa session object
        """
        if not isinstance(
            self.service_connection_config,
            (UnityCatalogConnection, DatabricksConnection),
        ):
            return
        bind = session.get_bind()
        bind.execute(
            "USE CATALOG %(catalog)s;",
            {"catalog": self.service_connection_config.catalog},
        ).first()

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
