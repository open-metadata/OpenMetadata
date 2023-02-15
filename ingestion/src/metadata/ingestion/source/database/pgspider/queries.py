#  Copyright(c) 2023, TOSHIBA CORPORATION
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
SQL Queries used during ingestion
"""

import textwrap

PGSPIDER_GET_MULTI_TENANT_TABLES = textwrap.dedent(
    """
      SELECT
        c.relname, ns.nspname, current_database() as database
      FROM
        pg_class c
        JOIN pg_namespace ns ON c.relnamespace = ns.oid
        JOIN pg_foreign_table ft ON c.oid = ft.ftrelid
        JOIN pg_foreign_server fs ON ft.ftserver = fs.oid
        JOIN pg_foreign_data_wrapper fdw ON fs.srvfdw = fdw.oid
      WHERE
        fdw.fdwname = 'pgspider_core_fdw'
    """
)

PGSPIDER_GET_CHILD_TABLES = textwrap.dedent(
    """
      WITH srv AS 
        (SELECT srvname FROM pg_foreign_table ft
        JOIN pg_foreign_server fs ON ft.ftserver = fs.oid GROUP BY srvname ORDER BY srvname),
        regex_pattern AS 
            (SELECT '^' || relname || '\\_\\_' || srv.srvname  || '\\_\\_[0-9]+$' regex FROM pg_class
            CROSS JOIN srv where relname = '{multi_tenant_table}')
            SELECT relname FROM pg_class
            WHERE (relname ~ (SELECT string_agg(regex, '|') FROM regex_pattern))
            AND (relname NOT LIKE '%%\\_%%\\_seq')
            ORDER BY relname;
    """
)
