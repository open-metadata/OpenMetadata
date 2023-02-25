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
Source connection handler
"""
import pyspark
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession

from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.ingestion.connections.builders import get_connection_args_common
from metadata.ingestion.connections.test_connections import SourceConnectionException


def get_connection(connection: DeltaLakeConnection) -> SparkSession:
    """
    Create connection
    """

    builder = (
        pyspark.sql.SparkSession.builder.appName(connection.appName or "OpenMetadata")
        .enableHiveSupport()
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
        # Download delta-core jars when creating the SparkSession
        .config("spark.jars.packages", "io.delta:delta-core_2.12:2.0.0")
    )

    # Check that the attribute exists and is properly informed
    if (
        hasattr(connection.metastoreConnection, "metastoreHostPort")
        and connection.metastoreConnection.metastoreHostPort
    ):
        builder.config(
            "hive.metastore.uris",
            f"thrift://{connection.metastoreConnection.metastoreHostPort}",
        )

    if (
        hasattr(connection.metastoreConnection, "metastoreDb")
        and connection.metastoreConnection.metastoreDb
    ):
        builder.config(
            "spark.hadoop.javax.jdo.option.ConnectionURL",
            connection.metastoreConnection.metastoreDb,
        )

    if (
        hasattr(connection.metastoreConnection, "metastoreFilePath")
        and connection.metastoreConnection.metastoreFilePath
    ):
        # From https://stackoverflow.com/questions/38377188/how-to-get-rid-of-derby-log-metastore-db-from-spark-shell
        # derby.system.home is the one in charge of the path for `metastore_db` dir and `derby.log`
        # We can use this option to control testing, as well as to properly point to the right
        # local database when ingesting data
        builder.config(
            "spark.driver.extraJavaOptions",
            f"-Dderby.system.home={connection.metastoreConnection.metastoreFilePath}",
        )

    for key, value in get_connection_args_common(connection).items():
        builder.config(key, value)

    return configure_spark_with_delta_pip(builder).getOrCreate()


def test_connection(spark: SparkSession) -> None:
    """
    Test connection
    """
    try:
        spark.catalog.listDatabases()
    except Exception as exc:
        msg = f"Unknown error connecting with {spark}: {exc}."
        raise SourceConnectionException(msg) from exc
