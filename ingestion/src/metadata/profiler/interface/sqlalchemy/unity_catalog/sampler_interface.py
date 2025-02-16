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
from metadata.ingestion.source.database.databricks.connection import (
    get_connection as databricks_get_connection,
)
from metadata.sampler.sqlalchemy.sampler import SQASampler


class UnityCatalogSamplerInterface(SQASampler):
    def get_client(self):
        """client is the session for SQA"""
        self.connection = databricks_get_connection(self.service_connection_config)
        self.client = super().get_client()
        self.set_catalog(self.client)

        return self.client
