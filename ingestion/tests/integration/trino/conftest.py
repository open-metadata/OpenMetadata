import os.path
import random
from time import sleep

import docker
import pandas as pd
import pytest
import testcontainers.core.network
from sqlalchemy import create_engine, insert
from sqlalchemy.engine import make_url
from tenacity import retry, stop_after_delay, wait_fixed
from testcontainers.core.container import DockerContainer
from testcontainers.core.generic import DbContainer
from testcontainers.minio import MinioContainer
from testcontainers.mysql import MySqlContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)

from ..conftest import ingestion_config as base_ingestion_config


class TrinoContainer(DbContainer):
    def __init__(
        self,
        image: str = "trinodb/trino",
        port=8080,
        **kwargs,
    ):
        super().__init__(image, **kwargs)
        self.user = "admin"
        self.port = port
        self.with_exposed_ports(port)
        self._built_image = f"trino:{random.randint(0, 10000)}"

    def start(self) -> "DbContainer":
        self.build()
        self.image = self._built_image
        return super().start()

    def _connect(self) -> None:
        super()._connect()
        engine = create_engine(self.get_connection_url())
        try:
            retry(wait=wait_fixed(1), stop=stop_after_delay(120))(engine.execute)(
                "select system.runtime.nodes.node_id from system.runtime.nodes"
            ).fetchall()
        finally:
            engine.dispose()

    def _configure(self) -> None:
        pass

    def stop(self, force=True, delete_volume=True) -> None:
        super().stop(force, delete_volume)
        self._docker.client.images.remove(self._built_image)

    def get_connection_url(self) -> str:
        return f"trino://{self.user}:@{self.get_container_host_ip()}:{self.get_exposed_port(self.port)}/?http_scheme=http"

    def build(self):
        docker_client = docker.from_env()
        docker_client.images.build(
            path=os.path.dirname(__file__) + "/trino",
            tag=self._built_image,
            buildargs={"BASE_IMAGE": self.image},
            rm=True,
        )


class HiveMetaStoreContainer(DockerContainer):
    def __init__(
        self,
        image: str = "apache/hive",
        port=9083,
        **kwargs,
    ):
        super().__init__(image, **kwargs)
        self.port = port
        self.with_exposed_ports(port)
        self._build_args = {}
        self._built_image = f"hive:{random.randint(0, 10000)}"

    def start(self) -> "DockerContainer":
        self.build()
        self.image = self._built_image
        return super().start()

    def with_build_args(self, key, value) -> "HiveMetaStoreContainer":
        self._build_args.update({key: value})
        return self

    def stop(self, force=True, delete_volume=True) -> None:
        super().stop(force, delete_volume)
        self._docker.client.images.remove(self._built_image)

    def build(self):
        docker_client = docker.from_env()
        docker_client.images.build(
            path=os.path.dirname(__file__) + "/hive",
            tag=self._built_image,
            buildargs={
                "BASE_IMAGE": self.image,
            },
            rm=True,
        )


@pytest.fixture(scope="session")
def docker_network():
    with testcontainers.core.network.Network() as network:
        yield network


@pytest.fixture(scope="session")
def trino_container(hive_metastore_container, minio_container, docker_network):
    container = (
        TrinoContainer(image="trinodb/trino:418")
        .with_network(docker_network)
        .with_env(
            "HIVE_METASTORE_URI",
            f"thrift://metastore:{hive_metastore_container.port}",
        )
        .with_env(
            "MINIO_ENDPOINT",
            f"http://minio:{minio_container.port}",
        )
    )
    with try_bind(container, container.port, container.port + 1) as trino:
        yield trino


@pytest.fixture(scope="session")
def mysql_container(docker_network):
    container = (
        MySqlContainer(
            "mariadb:10.6.16", username="admin", password="admin", dbname="metastore_db"
        )
        .with_network(docker_network)
        .with_network_aliases("mariadb")
    )
    with try_bind(container, container.port, container.port + 1) as mysql:
        yield mysql


@pytest.fixture(scope="session")
def hive_metastore_container(mysql_container, minio_container, docker_network):
    with HiveMetaStoreContainer("bitsondatadev/hive-metastore:latest").with_network(
        docker_network
    ).with_network_aliases("metastore").with_env(
        "METASTORE_DB_HOSTNAME", "mariadb"
    ).with_env(
        "METASTORE_DB_PORT", str(mysql_container.port)
    ).with_env(
        "JDBC_CONNECTION_URL",
        f"jdbc:mysql://mariadb:{mysql_container.port}/{mysql_container.dbname}",
    ).with_env(
        "MINIO_ENDPOINT",
        f"http://minio:{minio_container.port}",
    ) as hive:
        yield hive


@pytest.fixture(scope="session")
def minio_container(docker_network):
    container = (
        MinioContainer().with_network(docker_network).with_network_aliases("minio")
    )
    with try_bind(container, container.port, container.port) as minio:
        client = minio.get_client()
        client.make_bucket("hive-warehouse")
        yield minio


@pytest.fixture(scope="session")
def create_test_data(trino_container):
    engine = create_engine(
        make_url(trino_container.get_connection_url()).set(database="minio")
    )
    engine.execute(
        "create schema minio.my_schema WITH (location = 's3a://hive-warehouse/')"
    )
    data_dir = os.path.dirname(__file__) + "/data"
    for file in os.listdir(data_dir):
        df = pd.read_parquet(f"{data_dir}/{file}")
        for col in df.columns:
            if pd.api.types.is_datetime64tz_dtype(df[col]):
                df[col] = df[col].dt.tz_convert(None)
        df.to_sql(
            file.replace(".parquet", ""),
            engine,
            schema="my_schema",
            if_exists="fail",
            index=False,
            method=custom_insert,
        )
        sleep(1)
        engine.execute(
            "ANALYZE " + f'minio."my_schema"."{file.replace(".parquet", "")}"'
        )
    engine.execute(
        "CALL system.drop_stats(schema_name => 'my_schema', table_name => 'empty')"
    )
    return


def custom_insert(self, conn, keys: list[str], data_iter):
    """
    Hack pandas.io.sql.SQLTable._execute_insert_multi to retry untill rows are inserted.
    This is required becauase using trino with pd.to_sql in our setup us unreliable.
    """
    rowcount = 0
    max_tries = 10
    try_num = 0
    data = [dict(zip(keys, row)) for row in data_iter]
    while rowcount != len(data):
        if try_num >= max_tries:
            raise RuntimeError(f"Failed to insert data after {max_tries} tries")
        try_num += 1
        stmt = insert(self.table).values(data)
        conn.execute(stmt)
        rowcount = conn.execute(
            "SELECT COUNT(*) FROM " + f'"{self.schema}"."{self.name}"'
        ).scalar()
    return rowcount


@pytest.fixture(scope="module")
def create_service_request(trino_container, tmp_path_factory):
    return CreateDatabaseServiceRequest(
        name="docker_test_" + tmp_path_factory.mktemp("trino").name,
        serviceType=DatabaseServiceType.Trino,
        connection=DatabaseConnection(
            config=TrinoConnection(
                username=trino_container.user,
                hostPort="localhost:"
                + trino_container.get_exposed_port(trino_container.port),
                catalog="minio",
                connectionArguments={"http_scheme": "http"},
            )
        ),
    )


@pytest.fixture(scope="module")
def ingestion_config(db_service, sink_config, workflow_config, base_ingestion_config):
    base_ingestion_config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": [
            "^information_schema$",
        ],
    }
    return base_ingestion_config


@pytest.fixture(scope="module")
def unmask_password():
    def patch_password(service: DatabaseService):
        return service

    return patch_password
