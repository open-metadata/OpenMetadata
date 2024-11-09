#  Copyright 2024 Collate
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
AlationSink constants module
"""

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.source.metadata.alationsink.models import (
    CreateColumnRequest,
    CreateColumnRequestList,
    CreateDatasourceRequest,
    CreateSchemaRequest,
    CreateSchemaRequestList,
    CreateTableRequest,
    CreateTableRequestList,
)

ROUTES = {
    CreateDatasourceRequest: "/datasource",
    CreateSchemaRequest: "/schema",
    CreateSchemaRequestList: "/schema",
    CreateTableRequest: "/table",
    CreateTableRequestList: "/table",
    CreateColumnRequest: "/column",
    CreateColumnRequestList: "/column",
}

SERVICE_TYPE_MAPPER = {
    DatabaseServiceType.Oracle: "Oracle OCF connector",
    DatabaseServiceType.Trino: "Starburst Trino OCF Connector",
    DatabaseServiceType.Databricks: "Databricks OCF Connector",
    DatabaseServiceType.UnityCatalog: "Databricks Unity Catalog OCF Connector",
    DatabaseServiceType.Snowflake: "Snowflake OCF connector",
    DatabaseServiceType.Mssql: "SQL Server OCF Connector",
    DatabaseServiceType.Postgres: "PostgreSQL OCF Connector",
    DatabaseServiceType.Mysql: "MySQL OCF Connector",
    DatabaseServiceType.AzureSQL: "Azure SQL DB OCF Connector",
    DatabaseServiceType.SapHana: "Saphana OCF connector",
    DatabaseServiceType.Db2: "DB2 OCF Connector",
    DatabaseServiceType.Glue: "AWS Glue OCF Connector",
    DatabaseServiceType.BigQuery: "BigQuery OCF Connector",
}

TABLE_TYPE_MAPPER = {TableType.View: "VIEW", TableType.Regular: "TABLE"}

# Value is used for pagination by setting a upper limit on the total records to be fetched
# since the alation apis do not give us total count of the records
TOTAL_RECORDS = 100000000
