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

import json
import sys

import docker
from testcontainers.oracle import OracleDbContainer

from .database_test_container import DataBaseTestContainer


class OracleTestContainer(DataBaseTestContainer):
    def __init__(self):
        self.username = "test"
        self.password = "test"
        self.host = "localhost"
        self.port = 1521
        self.exposed_port = 11521
        self.dbname = "test"

        self.image = "gvenzl/oracle-free:23-slim-faststart"

        self.oracle_container = OracleDbContainer(
            image=self.image,
            oracle_password=self.password,
            username=self.username,
            password=self.password,
            port=self.port,
            dbname=self.dbname,
        )
        self.oracle_container.with_bind_ports(self.port, self.exposed_port)
        self.start()

        self.connection_url = self.get_connection_url()
        # Skip parent __init__ to avoid cx_Oracle dependency

    def start(self):
        self.oracle_container.start()

    def stop(self):
        self.oracle_container.stop()

    def get_connection_url(self) -> str:
        """
        Override testcontainers' get_connection_url to have correct dialect
        for different SQLAlchemy versions.

        # SQLAlchemy 1.4 with python-oracledb or cx_Oracle
        engine = create_engine('oracle://...

        # SQLAlchemy 2.0 with python-oracledb
        engine = create_engine(
            "oracle+oracledb://...

        ref:
        https://stackoverflow.com/questions/74093231/nosuchmoduleerror-cant-load-plugin-sqlalchemy-dialectsoracle-oracledb
        """
        dialect = "oracle+oracledb"
        if sqlalchemy_vers := sys.modules.get("sqlalchemy"):
            if sqlalchemy_vers.__version__.startswith("1."):
                dialect = "oracle"

        return self.oracle_container._create_connection_url(
            dialect=dialect,
            username=self.username,
            password=self.password,
            port=self.port,
        ) + "/?service_name={}".format(self.dbname)

    def get_config(self) -> str:
        return json.dumps(
            {
                "password": self.password,
                "hostPort": f"localhost:{self.exposed_port}",
                "username": self.username,
                "type": "Oracle",
                "oracleConnectionType": {
                    "oracleServiceName": self.dbname,
                },
            }
        )

    def get_source_config(self) -> str:
        return json.dumps({})

    def raw_connection(self):
        """Get direct oracledb connection without SQLAlchemy."""
        import oracledb

        return oracledb.connect(
            user=self.username,
            password=self.password,
            host=self.host,
            port=self.exposed_port,
            service_name=self.dbname,
        )

    @property
    def container(self) -> OracleDbContainer:
        return self.oracle_container

    @property
    def connector_type(self) -> str:
        return "oracle"

    def delete_image(self):
        """
        Delete the Docker image used by the Oracle test container.

        We need to cleanup the images created by testcontainers to avoid
        no space left on device issues during tests in CI. Only stopping
        containers is not sufficient as the images remain on disk.
        """
        client = docker.from_env()
        client.images.remove(self.image, force=True, noprune=False)
        client.close()
