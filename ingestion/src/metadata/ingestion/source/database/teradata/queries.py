#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
SQL Queries used during ingestion
"""

TERADATA_GET_TABLE_NAMES = """
SELECT tablename, databasename from dbc.tablesvx
WHERE DataBaseName = :schema AND TableKind in ('T','V','O')
"""

TERADATA_TABLE_COMMENTS = """
    SELECT DataBaseName as schema,
            TableName as table_name,
            CommentString as table_comment
    FROM dbc.tablesvx
    WHERE TableKind in ('T','V','O')
    ORDER BY "schema", "table_name"
"""

TERADATA_GET_STORED_PROCEDURES = """
SELECT  T.DatabaseName AS database_schema,
        T.TableName AS procedure_name,
        case T.TableKind 
           when 'P' then 'SQL'
           when 'E' then 'EXTERNAL'
        END as procedure_type
FROM    DBC.TablesVX T
WHERE T.TableKind in ('P', 'E')
  and T.DatabaseName = '{schema_name}'
"""

TERADATA_SHOW_STORED_PROCEDURE = """
SHOW PROCEDURE {schema_name}.{procedure_name};
"""

TERADATA_VIEW_DEFINITIONS = """
select dbase.DatabaseNameI,
tvm.TVMNameI,
tvm.CreateText
from dbc.tvm  tvm join DBC.Dbase dbase
on  tvm.DatabaseId = dbase.DatabaseId
where TableKind in ('V')
   AND tvm.tvmid NOT IN ( '00C001000000'xb, '00C002000000'xb,
                          '00C009000000'xb, '00C010000000'xb,
                          '00C017000000'xb, '000000000000'xb)
AND   (tvm.tvmid IN
         /* IDs of Tables accessible to the USER or *PUBLIC* */
         (SELECT TVMId FROM DBC.View_UserTablesExtVX)
       OR
       dbase.DatabaseId IN
         /* IDs of databases accessible to the USER or *PUBLIC* */
        (SELECT DatabaseID FROM DBC.View_UserDBsExtVX)
        )
"""

TERADATA_GET_DATABASE = """
select databasename from dbc.databasesvx
"""


TERADATA_GET_DB_NAMES = """
select databasename from dbc.databasesvx
"""

TERADATA_GET_SERVER_VERSION = """
SELECT InfoData FROM dbc.dbcinfo
where InfoKey = 'VERSION'
"""
