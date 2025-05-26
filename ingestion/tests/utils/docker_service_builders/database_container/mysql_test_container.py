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
"""MySQL test container for integration tests"""

import json

from testcontainers.mysql import MySqlContainer

from .database_test_container import DataBaseTestContainer


class MySQLTestContainer(DataBaseTestContainer):
    def __init__(self):
        self.mysql_container = MySqlContainer("mysql:latest")
        self.mysql_container.with_env("TC_POOLING_INTERVAL", "3")
        self.start()
        self.connection_url = self.mysql_container.get_connection_url()
        super().__init__()

    def start(self):
        self.mysql_container.start()

    def stop(self):
        self.mysql_container.stop()

    def get_connection_url(self) -> str:
        return self.connection_url

    def get_config(self) -> str:
        return json.dumps(
            {
                "authType": {"password": "test"},
                "hostPort": f"localhost:{self.mysql_container.get_exposed_port(3306)}",
                "username": "test",
                "type": "Mysql",
                "databaseSchema": "test",
            }
        )

    def get_source_config(self) -> str:
        return json.dumps({})

    @property
    def container(self) -> MySqlContainer:
        return self.mysql_container

    @property
    def connector_type(self) -> str:
        """OM Connector type"""
        return "mysql"
