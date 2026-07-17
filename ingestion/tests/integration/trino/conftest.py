import os.path
import random
import uuid
from pathlib import Path

import docker
import pandas as pd
import pytest
import testcontainers.core.network
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import OperationalError
from tenacity import retry, retry_if_exception_type, stop_after_delay, wait_fixed
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

from ..conftest import ingestion_config as base_ingestion_config  # noqa: F401, TID252


class TrinoTableNotReadyError(RuntimeError):
    pass


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

            def _exec(sql):
                with engine.connect() as conn:
                    return conn.execute(text(sql))

            # Scan a real catalog, not system.runtime.nodes: for the first seconds after startup
            # trino accepts queries but cannot yet schedule one against a catalog
            # (NO_NODES_AVAILABLE), while the system connector, registered on every active node,
            # already answers. Any catalog proves the rest -- one announcement lists them all.
            retry(wait=wait_fixed(1), stop=stop_after_delay(120))(_exec)(
                "SELECT count(*) FROM tpch.tiny.nation"
            ).fetchall()
        finally:
            engine.dispose()

    def _configure(self) -> None:
        pass

    def stop(self, force=True, delete_volume=True) -> None:
        super().stop(force, delete_volume)
        self._docker.client.images.remove(self._built_image)

    def get_connection_url(self) -> str:
        return (
            f"trino://{self.user}:@{self.get_container_host_ip()}:{self.get_exposed_port(self.port)}/?http_scheme=http"
        )

    def build(self):
        docker_client = docker.from_env()
        docker_client.images.build(
            path=os.path.dirname(__file__) + "/trino",  # noqa: PTH120
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
            path=os.path.dirname(__file__) + "/hive",  # noqa: PTH120
            tag=self._built_image,
            buildargs={
                "BASE_IMAGE": self.image,
            },
            rm=True,
        )


@pytest.fixture(scope="package")
def docker_network():
    with testcontainers.core.network.Network() as network:
        yield network


@pytest.fixture(scope="package")
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


@pytest.fixture(scope="package")
def mysql_container(docker_network):
    container = (
        MySqlContainer("mariadb:10.6.16", username="admin", password="admin", dbname="metastore_db")
        .with_network(docker_network)
        .with_network_aliases("mariadb")
    )
    with try_bind(container, container.port, container.port + 1) as mysql:
        yield mysql


@pytest.fixture(scope="package")
def hive_metastore_container(mysql_container, minio_container, docker_network):
    with (
        HiveMetaStoreContainer("bitsondatadev/hive-metastore:latest")
        .with_network(docker_network)
        .with_network_aliases("metastore")
        .with_env("METASTORE_DB_HOSTNAME", "mariadb")
        .with_env("METASTORE_DB_PORT", str(mysql_container.port))
        .with_env(
            "JDBC_CONNECTION_URL",
            f"jdbc:mysql://mariadb:{mysql_container.port}/{mysql_container.dbname}",
        )
        .with_env(
            "MINIO_ENDPOINT",
            f"http://minio:{minio_container.port}",
        ) as hive
    ):
        yield hive


@pytest.fixture(scope="package")
def minio_container(docker_network):
    container = MinioContainer().with_network(docker_network).with_network_aliases("minio")
    with try_bind(container, container.port, container.port) as minio:
        client = minio.get_client()
        client.make_bucket("hive-warehouse")
        yield minio


@pytest.fixture(scope="package")
def create_test_data(trino_container):
    engine = create_engine(make_url(trino_container.get_connection_url()).set(database="minio"))

    def _execute_with_connect(sql):
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            conn.commit()
            return result

    retry(wait=wait_fixed(2), stop=stop_after_delay(60))(_execute_with_connect)(
        "SELECT 1 FROM minio.information_schema.schemata LIMIT 1"
    ).fetchall()

    _execute_with_connect("create schema minio.my_schema WITH (location = 's3a://hive-warehouse/')")
    data_dir = os.path.dirname(__file__) + "/data"  # noqa: PTH120
    for file in os.listdir(data_dir):  # noqa: PTH208
        file_path = Path(os.path.join(data_dir, file))  # noqa: PTH118

        if file_path.suffix == ".sql":
            expected_rows = create_test_data_from_sql(engine, file_path)
        else:
            expected_rows = create_test_data_from_parquet(engine, file_path)

        wait_for_table_data(engine, file_path.stem, expected_rows)
        _execute_with_connect("ANALYZE " + f'minio."my_schema"."{file_path.stem}"')
    _execute_with_connect("CALL system.drop_stats(schema_name => 'my_schema', table_name => 'empty')")
    return


def create_test_data_from_parquet(engine: Engine, file_path: Path) -> int:
    df = pd.read_parquet(file_path)

    # Convert data types
    for col in df.columns:
        if pd.api.types.is_datetime64tz_dtype(df[col]):
            df[col] = df[col].dt.tz_convert(None)

    df.to_sql(
        Path(file_path).stem,
        engine,
        schema="my_schema",
        if_exists="fail",
        index=False,
        method=custom_insert,
    )
    return len(df.index)


def create_test_data_from_sql(engine: Engine, file_path: Path) -> None:
    with open(file_path, "r") as f:  # noqa: PTH123
        sql = f.read()

    sql = sql.format(catalog="minio", schema="my_schema", table_name=file_path.stem)
    with engine.connect() as conn:
        for statement in sql.split(";"):
            if statement.strip() == "":
                continue
            conn.execute(text(statement))
        conn.commit()


@retry(
    retry=retry_if_exception_type(TrinoTableNotReadyError),
    wait=wait_fixed(1),
    stop=stop_after_delay(30),
    reraise=True,
)
def wait_for_table_data(engine: Engine, table_name: str, expected_rows: int | None) -> None:
    try:
        with engine.connect() as conn:
            row_count = conn.execute(text(f'SELECT COUNT(*) FROM "my_schema"."{table_name}"')).scalar_one()
    except OperationalError as exc:
        error_message = str(exc)
        if "HIVE_CANNOT_OPEN_SPLIT" not in error_message or "File does not exist" not in error_message:
            raise
        raise TrinoTableNotReadyError(f"Trino data files for [{table_name}] are not readable yet") from exc

    if expected_rows is not None and row_count != expected_rows:
        raise TrinoTableNotReadyError(
            f"Trino table [{table_name}] contains [{row_count}] rows; expected [{expected_rows}]"
        )


def custom_insert(self, conn, keys: list[str], data_iter):
    """Drain Trino DML results before SQLAlchemy can cancel the Hive write."""
    rows = list(data_iter)
    if not rows:
        return 0

    identifier_preparer = conn.dialect.identifier_preparer
    table_name = identifier_preparer.format_table(self.table)
    column_names = ", ".join(identifier_preparer.quote(key) for key in keys)
    row_placeholders = f"({', '.join('?' for _ in keys)})"
    values_clause = ", ".join(row_placeholders for _ in rows)
    statement = f"INSERT INTO {table_name} ({column_names}) VALUES {values_clause}"
    parameters = tuple(value for row in rows for value in row)
    with conn.connection.driver_connection.cursor() as cursor:
        cursor.execute(statement, parameters)
        cursor.fetchall()
        inserted_rows = cursor.rowcount

    if inserted_rows != len(rows):
        raise RuntimeError(
            f"Trino inserted [{inserted_rows}] rows into [{self.schema}.{self.name}]; expected [{len(rows)}]"
        )
    return inserted_rows


@pytest.fixture(scope="module")
def create_service_request(trino_container):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_trino_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Trino,
        connection=DatabaseConnection(
            config=TrinoConnection(
                username=trino_container.user,
                hostPort="localhost:" + trino_container.get_exposed_port(trino_container.port),
                catalog="minio",
                connectionArguments={"http_scheme": "http"},
            )
        ),
    )


@pytest.fixture(scope="module")
def ingestion_config(db_service, sink_config, workflow_config, base_ingestion_config):  # noqa: F811
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
