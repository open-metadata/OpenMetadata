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
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaType,
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLType,
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
from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    ImpalaType,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBType,
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
from metadata.generated.schema.entity.services.connections.database.singleStoreConnection import (
    SingleStoreType,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeType,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteType,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataType,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    DatabricksType as UnityCatalogType,
)
from metadata.utils.singleton import Singleton


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
    IMPALA = "impala"
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
    MARIADB = "mariadb"


MAP_CONNECTION_TYPE_DIALECT: Dict[str, Dialect] = {
    str(AthenaType.Athena.value): Dialect.ATHENA,
    str(BigqueryType.BigQuery.value): Dialect.BIGQUERY,
    str(ClickhouseType.Clickhouse.value): Dialect.CLICKHOUSE,
    str(DatabricksType.Databricks.value): Dialect.DATABRICKS,
    str(UnityCatalogType.UnityCatalog.value): Dialect.DATABRICKS,
    str(Db2Type.Db2.value): Dialect.DB2,
    str(HiveType.Hive.value): Dialect.HIVE,
    str(ImpalaType.Impala.value): Dialect.IMPALA,
    str(MySQLType.Mysql.value): Dialect.MYSQL,
    str(OracleType.Oracle.value): Dialect.ORACLE,
    str(PostgresType.Postgres.value): Dialect.POSTGRES,
    str(RedshiftType.Redshift.value): Dialect.REDSHIFT,
    str(SnowflakeType.Snowflake.value): Dialect.SNOWFLAKE,
    str(DeltaLakeType.DeltaLake.value): Dialect.SPARKSQL,
    str(SQLiteType.SQLite.value): Dialect.SQLITE,
    str(MssqlType.Mssql.value): Dialect.TSQL,
    str(AzureSQLType.AzureSQL.value): Dialect.TSQL,
    str(TeradataType.Teradata.value): Dialect.TERADATA,
    str(MariaDBType.MariaDB.value): Dialect.MARIADB,
    str(SingleStoreType.SingleStore.value): Dialect.MYSQL,
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


class QueryParsingError(BaseModel):
    """
    Represents an error that occurs during query parsing.

    Attributes:
        query (str): The query text of the failed query.
        error (str): The error message of the failed query.
    """

    model_config = ConfigDict(
        extra="forbid",
    )

    query: str = Field(..., description="query text of the failed query")
    error: Optional[str] = Field(None, description="error message of the failed query")


class QueryParsingFailures(metaclass=Singleton):
    """Tracks the Queries that failed to parse."""

    def __init__(self):
        """Initializes the list of parsing failures."""
        self._query_list: List[QueryParsingError] = []

    def add(self, parsing_error: QueryParsingError):
        self._query_list.append(parsing_error)

    def __iter__(self):
        return iter(self._query_list)
