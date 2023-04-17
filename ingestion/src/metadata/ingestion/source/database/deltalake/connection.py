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
from typing import Optional

import pyspark
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
    MetastoreDbConnection,
)
from metadata.ingestion.connections.builders import get_connection_args_common
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata


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

    if isinstance(connection.metastoreConnection, MetastoreDbConnection):
        if connection.metastoreConnection.metastoreDb:
            builder.config(
                "spark.hadoop.javax.jdo.option.ConnectionURL",
                connection.metastoreConnection.metastoreDb,
            )
        if connection.metastoreConnection.jdbcDriverClassPath:
            builder.config(
                "sparks.driver.extraClassPath",
                connection.metastoreConnection.jdbcDriverClassPath,
            )
        if connection.metastoreConnection.username:
            builder.config(
                "spark.hadoop.javax.jdo.option.ConnectionUserName",
                connection.metastoreConnection.metastoreDb,
            )
        if connection.metastoreConnection.password:
            builder.config(
                "spark.hadoop.javax.jdo.option.ConnectionPassword",
                connection.metastoreConnection.password.get_secret_value(),
            )
        if connection.metastoreConnection.driverName:
            builder.config(
                "spark.hadoop.javax.jdo.option.ConnectionDriverName",
                connection.metastoreConnection.driverName,
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


def test_connection(
    metadata: OpenMetadata,
    spark: SparkSession,
    service_connection: DeltaLakeConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        for database in spark.catalog.listDatabases():
            if database:
                spark.catalog.listTables(database[0])
                break

    test_fn = {
        "GetDatabases": spark.catalog.listDatabases,
        "GetTables": custom_executor,
    }

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
