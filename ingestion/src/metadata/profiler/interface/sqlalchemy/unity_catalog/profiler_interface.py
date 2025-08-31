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

from sqlalchemy import event
from sqlalchemy.orm import scoped_session, sessionmaker

from metadata.ingestion.source.database.databricks.connection import (
    get_connection as databricks_get_connection,
)
from metadata.profiler.interface.sqlalchemy.databricks.profiler_interface import (
    DatabricksProfilerInterface,
)


class UnityCatalogProfilerInterface(DatabricksProfilerInterface):
    def create_session(self):
        self.connection = databricks_get_connection(self.service_connection_config)

        # Create custom session factory with after_begin event to set catalog
        session_maker = sessionmaker(bind=self.connection)

        @event.listens_for(session_maker, "after_begin")
        def set_catalog(session, transaction, connection):
            # Safely quote the catalog name to prevent SQL injection
            quoted_catalog = connection.dialect.identifier_preparer.quote(
                self.service_connection_config.catalog
            )
            connection.execute(f"USE CATALOG {quoted_catalog};")

        self.session_factory = scoped_session(session_maker)
        self.session = self.session_factory()
