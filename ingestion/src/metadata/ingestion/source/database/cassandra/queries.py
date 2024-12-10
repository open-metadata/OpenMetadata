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
SQL Queries used during ingestion
"""

import textwrap

CASSANDRA_GET_RELEASE_VERSION = textwrap.dedent(
    """
    SELECT release_version FROM system.local;
    """
)

CASSANDRA_GET_KEYSPACES = textwrap.dedent(
    """
    SELECT * FROM system_schema.keyspaces
    """
)

CASSANDRA_GET_KEYSPACE_TABLES = textwrap.dedent(
    """
    SELECT * FROM system_schema.tables WHERE keyspace_name = %s
    """
)

CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS = textwrap.dedent(
    """
    SELECT * FROM system_schema.views WHERE keyspace_name = %s
    """
)

CASSANDRA_GET_TABLE_COLUMNS = textwrap.dedent(
    """
    SELECT * FROM system_schema.columns WHERE keyspace_name = %s AND table_name = %s
    """
)
