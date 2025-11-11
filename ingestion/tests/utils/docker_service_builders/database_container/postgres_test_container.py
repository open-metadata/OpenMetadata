#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Postgres test container for integration tests"""

import json

from testcontainers.postgres import PostgresContainer

from .database_test_container import DataBaseTestContainer


class PostgresTestContainer(DataBaseTestContainer):
    def __init__(self):
        self.postgres_container = PostgresContainer("postgres:latest")
        self.postgres_container.with_env("TC_POOLING_INTERVAL", "3")
        self.start()
        self.connection_url = self.postgres_container.get_connection_url()
        super().__init__()

    def start(self):
        self.postgres_container.start()

    def stop(self):
        self.postgres_container.stop()

    def get_connection_url(self) -> str:
        return self.connection_url

    def get_config(self) -> str:
        return json.dumps(
            {
                "authType": {"password": "test"},
                "hostPort": f"localhost:{self.postgres_container.get_exposed_port(5432)}",
                "username": "test",
                "type": "Postgres",
                "database": "test",
            }
        )

    def get_source_config(self) -> str:
        return json.dumps(
            {
                "schemaFilterPattern": {
                    "includes": ["public"],
                }
            }
        )

    @property
    def container(self) -> PostgresContainer:
        return self.postgres_container

    @property
    def connector_type(self) -> str:
        return "postgres"
