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

"""Connection to the Apache Cloudberry coordinator."""

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.cloudberryConnection import (
    CloudberryConnection as CloudberryConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.strategies import BasicAuthStrategy
from metadata.ingestion.source.database.postgres.connection import PostgresChecks

SYSTEM_SCHEMAS = PostgresChecks.SYSTEM_SCHEMAS | {"gp_toolkit", "pg_aoseg", "pg_bitmapindex"}


class CloudberryChecks(PostgresChecks):
    SYSTEM_SCHEMAS = SYSTEM_SCHEMAS


class CloudberryConnection(BaseConnection[CloudberryConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        engine = BasicAuthStrategy(self.service_connection).build()
        self._on_close(engine.dispose)
        return engine

    def checks(self) -> CloudberryChecks:
        return CloudberryChecks(self.borrow(), query_statement_source=None)
