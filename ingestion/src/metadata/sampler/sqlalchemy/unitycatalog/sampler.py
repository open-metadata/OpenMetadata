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
from sqlalchemy.orm import sessionmaker, scoped_session
from metadata.sampler.sqlalchemy.databricks.sampler import DatabricksSamplerInterface


class UnityCatalogSamplerInterface(DatabricksSamplerInterface):
    """
    Unity Catalog Sampler Interface
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Create custom session with after_begin event to set catalog
        session_maker = sessionmaker(bind=self.connection)
        
        @event.listens_for(session_maker, "after_begin")
        def set_catalog(session, transaction, connection):
            connection.execute(
                "USE CATALOG %(catalog)s;",
                {"catalog": self.service_connection_config.catalog}
            )
        
        self.session_factory = scoped_session(session_maker)