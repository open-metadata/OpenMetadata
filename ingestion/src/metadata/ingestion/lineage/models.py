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
Models related to lineage parsing
"""
from enum import Enum
from typing import Dict

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaType,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigqueryType,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseType,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksType,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Type,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeType,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveType,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlType,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MySQLType,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleType,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresType,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeType,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteType,
)


class Dialect(Enum):
    """
    Supported dialects by sqllineage
    """

    ANSI = "ansi"
    ATHENA = "athena"
    BIGQUERY = "bigquery"
    CLICKHOUSE = "clickhouse"
    DATABRICKS = "databricks"
    DB2 = "db2"
    DUCKDB = "duckdb"
    EXASOL = "exasol"
    HIVE = "hive"
    MATERIALIZE = "materialize"
    MYSQL = "mysql"
    ORACLE = "oracle"
    POSTGRES = "postgres"
    REDSHIFT = "redshift"
    SNOWFLAKE = "snowflake"
    SOQL = "soql"
    SPARKSQL = "sparksql"
    SQLITE = "sqlite"
    TERADATA = "teradata"
    TSQL = "tsql"


MAP_CONNECTION_TYPE_DIALECT: Dict[str, Dialect] = {
    str(AthenaType.Athena.value): Dialect.ATHENA,
    str(BigqueryType.BigQuery.value): Dialect.BIGQUERY,
    str(ClickhouseType.Clickhouse.value): Dialect.CLICKHOUSE,
    str(DatabricksType.Databricks.value): Dialect.DATABRICKS,
    str(Db2Type.Db2.value): Dialect.DB2,
    str(HiveType.Hive.value): Dialect.HIVE,
    str(MySQLType.Mysql.value): Dialect.MYSQL,
    str(OracleType.Oracle.value): Dialect.ORACLE,
    str(PostgresType.Postgres.value): Dialect.POSTGRES,
    str(RedshiftType.Redshift.value): Dialect.REDSHIFT,
    str(SnowflakeType.Snowflake.value): Dialect.SNOWFLAKE,
    str(DeltaLakeType.DeltaLake.value): Dialect.SPARKSQL,
    str(SQLiteType.SQLite.value): Dialect.SQLITE,
    str(MssqlType.Mssql.value): Dialect.TSQL,
}


class ConnectionTypeDialectMapper:
    """
    Auxiliary class to handle the mapping between a connection type and a dialect used to analyze lineage
    """

    @staticmethod
    def dialect_of(connection_type: str) -> Dialect:
        """
        Returns dialect for a given connection_type
        Args:
            connection_type: the connection type as string
        Returns: a dialect
        """
        return MAP_CONNECTION_TYPE_DIALECT.get(connection_type, Dialect.ANSI)
