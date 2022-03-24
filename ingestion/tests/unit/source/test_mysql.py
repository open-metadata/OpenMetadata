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
Query parser utils tests
"""
import json
from unittest import TestCase
from unittest.mock import patch

from proto import ENUM
from pymysql.constants import FIELD_TYPE
from sqlalchemy.types import BIGINT, CHAR, INTEGER, SMALLINT, TEXT, TIMESTAMP, VARCHAR

from metadata.ingestion.api.workflow import Workflow

CONFIG = """
{
  "source": {
    "type": "mysql",
    "config": {
      "username": "openmetadata_user",
      "password": "openmetadata_password",
      "service_name": "local_mysql_test",
       "schema_filter_pattern": {
        "excludes": ["mysql.*", "information_schema.*", "performance_schema.*", "sys.*"]
      }
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}

"""


MOCK_GET_TABLE_NAMES = [
    "accounts",
    "binary_log_transaction_compression_stats",
    "cond_instances",
    "data_lock_waits",
    "data_locks",
    "error_log",
    "events_errors_summary_by_account_by_error",
    "events_errors_summary_by_host_by_error",
    "events_errors_summary_by_thread_by_error",
    "events_errors_summary_by_user_by_error",
    "events_errors_summary_global_by_error",
    "events_stages_current",
    "events_stages_history",
    "events_stages_history_long",
    "events_stages_summary_by_account_by_event_name",
    "events_stages_summary_by_host_by_event_name",
    "events_stages_summary_by_thread_by_event_name",
    "events_stages_summary_by_user_by_event_name",
    "events_stages_summary_global_by_event_name",
    "events_statements_current",
    "events_statements_histogram_by_digest",
    "events_statements_histogram_global",
    "events_statements_history",
    "events_statements_history_long",
    "events_statements_summary_by_account_by_event_name",
    "events_statements_summary_by_digest",
    "events_statements_summary_by_host_by_event_name",
    "events_statements_summary_by_program",
    "events_statements_summary_by_thread_by_event_name",
    "events_statements_summary_by_user_by_event_name",
    "events_statements_summary_global_by_event_name",
    "events_transactions_current",
    "events_transactions_history",
    "events_transactions_history_long",
    "events_transactions_summary_by_account_by_event_name",
    "events_transactions_summary_by_host_by_event_name",
    "events_transactions_summary_by_thread_by_event_name",
    "events_transactions_summary_by_user_by_event_name",
    "events_transactions_summary_global_by_event_name",
    "events_waits_current",
    "events_waits_history",
    "events_waits_history_long",
    "events_waits_summary_by_account_by_event_name",
    "events_waits_summary_by_host_by_event_name",
    "events_waits_summary_by_instance",
    "events_waits_summary_by_thread_by_event_name",
    "events_waits_summary_by_user_by_event_name",
    "events_waits_summary_global_by_event_name",
    "file_instances",
    "file_summary_by_event_name",
    "file_summary_by_instance",
    "global_status",
    "global_variables",
    "host_cache",
    "hosts",
    "keyring_component_status",
    "keyring_keys",
    "log_status",
    "memory_summary_by_account_by_event_name",
    "memory_summary_by_host_by_event_name",
    "memory_summary_by_thread_by_event_name",
    "memory_summary_by_user_by_event_name",
    "memory_summary_global_by_event_name",
    "metadata_locks",
    "mutex_instances",
    "objects_summary_global_by_type",
    "performance_timers",
    "persisted_variables",
    "prepared_statements_instances",
    "processlist",
    "replication_applier_configuration",
    "replication_applier_filters",
    "replication_applier_global_filters",
    "replication_applier_status",
    "replication_applier_status_by_coordinator",
    "replication_applier_status_by_worker",
    "replication_asynchronous_connection_failover",
    "replication_asynchronous_connection_failover_managed",
    "replication_connection_configuration",
    "replication_connection_status",
    "replication_group_member_stats",
    "replication_group_members",
    "rwlock_instances",
    "session_account_connect_attrs",
    "session_connect_attrs",
    "session_status",
    "session_variables",
    "setup_actors",
    "setup_consumers",
    "setup_instruments",
    "setup_objects",
    "setup_threads",
    "socket_instances",
    "socket_summary_by_event_name",
    "socket_summary_by_instance",
    "status_by_account",
    "status_by_host",
    "status_by_thread",
    "status_by_user",
    "table_handles",
    "table_io_waits_summary_by_index_usage",
    "table_io_waits_summary_by_table",
    "table_lock_waits_summary_by_table",
    "threads",
    "tls_channel_status",
    "user_defined_functions",
    "user_variables_by_thread",
    "users",
    "variables_by_thread",
    "variables_info",
]

GET_TABLE_DESCRIPTIONS = {"text": "Test Description"}
MOCK_GET_SCHEMA_NAMES = [
    "information_schema",
    "mysql",
    "openmetadata_db",
    "performance_schema",
    "sys",
]

MOCK_UNIQUE_CONSTRAINTS = [
    {
        "name": "OBJECT",
        "column_names": ["OBJECT_TYPE", "OBJECT_SCHEMA", "OBJECT_NAME"],
        "duplicates_index": "OBJECT",
    }
]


MOCK_PK_CONSTRAINT = {"constrained_columns": ["name"], "name": None}


MOCK_GET_COLUMN = [
    {
        "name": "OBJECT_TYPE",
        "type": VARCHAR(length=64),
        "default": None,
        "comment": None,
        "nullable": True,
    },
    {
        "name": "MIN_TIMER_WAIT",
        "type": BIGINT,
        "default": None,
        "comment": None,
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "OBJECT_SCHEMA",
        "type": VARCHAR(length=64),
        "default": None,
        "comment": None,
        "nullable": True,
    },
    {
        "name": "OBJECT_NAME",
        "type": VARCHAR(length=64),
        "default": None,
        "comment": None,
        "nullable": True,
    },
    {
        "name": "MAXLEN",
        "type": INTEGER,
        "default": None,
        "comment": None,
        "nullable": True,
        "autoincrement": False,
    },
    {
        "name": "COUNT_STAR",
        "type": BIGINT,
        "default": None,
        "comment": None,
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "SUM_TIMER_WAIT",
        "type": BIGINT,
        "default": None,
        "comment": None,
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "name",
        "type": CHAR(collation="utf8_bin", length=64),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "ret",
        "type": FIELD_TYPE.INT24,
        "default": "'0'",
        "comment": None,
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "type",
        "type": FIELD_TYPE.ENUM,
        "default": None,
        "comment": None,
        "nullable": False,
    },
    {
        "name": "dl",
        "type": CHAR(collation="utf8_bin", length=128),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "LOG_TYPE",
        "type": ENUM,
        "default": None,
        "comment": "The log type to which the transactions were written.",
        "nullable": False,
    },
    {
        "name": "COMPRESSION_TYPE",
        "type": VARCHAR(length=64),
        "default": None,
        "comment": "The transaction compression algorithm used.",
        "nullable": False,
    },
    {
        "name": "TRANSACTION_COUNTER",
        "type": BIGINT,
        "default": None,
        "comment": "Number of transactions written to the log",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "COMPRESSION_PERCENTAGE",
        "type": SMALLINT(),
        "default": None,
        "comment": "The compression ratio as a percentage.",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "FIRST_TRANSACTION_ID",
        "type": TEXT(),
        "default": None,
        "comment": "The first transaction written.",
        "nullable": True,
    },
    {
        "name": "FIRST_TRANSACTION_COMPRESSED_BYTES",
        "type": BIGINT,
        "default": None,
        "comment": "First transaction written compressed bytes.",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "FIRST_TRANSACTION_UNCOMPRESSED_BYTES",
        "type": BIGINT,
        "default": None,
        "comment": "First transaction written uncompressed bytes.",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "FIRST_TRANSACTION_TIMESTAMP",
        "type": TIMESTAMP(),
        "default": None,
        "comment": "When the first transaction was written.",
        "nullable": True,
    },
    {
        "name": "LAST_TRANSACTION_ID",
        "type": TEXT,
        "default": None,
        "comment": "The last transaction written.",
        "nullable": True,
    },
    {
        "name": "LAST_TRANSACTION_COMPRESSED_BYTES",
        "type": BIGINT,
        "default": None,
        "comment": "Last transaction written compressed bytes.",
        "nullable": False,
        "autoincrement": False,
    },
    {
        "name": "LAST_TRANSACTION_TIMESTAMP",
        "type": TIMESTAMP(),
        "default": None,
        "comment": "When the last transaction was written.",
        "nullable": True,
    },
    {
        "name": "Host",
        "type": CHAR(collation="ascii_general_ci", length=255),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "Db",
        "type": CHAR(collation="utf8_bin", length=64),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "User",
        "type": CHAR(collation="utf8_bin", length=32),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "Table_name",
        "type": CHAR(collation="utf8_bin", length=64),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "Column_name",
        "type": CHAR(collation="utf8_bin", length=64),
        "default": "''",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "Timestamp",
        "type": TIMESTAMP(),
        "default": "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        "comment": None,
        "nullable": False,
    },
    {
        "name": "Column_priv",
        "type": FIELD_TYPE.SET,
        "default": "''",
        "comment": None,
        "nullable": False,
    },
]


MOCK_GET_VIEW_NAMES = [
    "ADMINISTRABLE_ROLE_AUTHORIZATIONS",
    "APPLICABLE_ROLES",
    "CHARACTER_SETS",
    "CHECK_CONSTRAINTS",
    "COLLATION_CHARACTER_SET_APPLICABILITY",
    "COLLATIONS",
    "COLUMN_PRIVILEGES",
    "COLUMN_STATISTICS",
    "COLUMNS",
    "COLUMNS_EXTENSIONS",
    "ENABLED_ROLES",
    "ENGINES",
    "EVENTS",
    "FILES",
    "INNODB_BUFFER_PAGE",
    "INNODB_BUFFER_PAGE_LRU",
    "INNODB_BUFFER_POOL_STATS",
    "INNODB_CACHED_INDEXES",
    "INNODB_CMP",
    "INNODB_CMP_PER_INDEX",
    "INNODB_CMP_PER_INDEX_RESET",
    "INNODB_CMP_RESET",
    "INNODB_CMPMEM",
    "INNODB_CMPMEM_RESET",
    "INNODB_COLUMNS",
    "INNODB_DATAFILES",
    "INNODB_FIELDS",
    "INNODB_FOREIGN",
    "INNODB_FOREIGN_COLS",
    "INNODB_FT_BEING_DELETED",
    "INNODB_FT_CONFIG",
    "INNODB_FT_DEFAULT_STOPWORD",
    "INNODB_FT_DELETED",
    "INNODB_FT_INDEX_CACHE",
    "INNODB_FT_INDEX_TABLE",
    "INNODB_INDEXES",
    "INNODB_METRICS",
    "INNODB_SESSION_TEMP_TABLESPACES",
    "INNODB_TABLES",
    "INNODB_TABLESPACES",
    "INNODB_TABLESPACES_BRIEF",
    "INNODB_TABLESTATS",
    "INNODB_TEMP_TABLE_INFO",
    "INNODB_TRX",
    "INNODB_VIRTUAL",
    "KEY_COLUMN_USAGE",
    "KEYWORDS",
    "OPTIMIZER_TRACE",
    "PARAMETERS",
    "PARTITIONS",
    "PLUGINS",
    "PROCESSLIST",
    "PROFILING",
    "REFERENTIAL_CONSTRAINTS",
    "RESOURCE_GROUPS",
    "ROLE_COLUMN_GRANTS",
    "ROLE_ROUTINE_GRANTS",
    "ROLE_TABLE_GRANTS",
    "ROUTINES",
    "SCHEMA_PRIVILEGES",
    "SCHEMATA",
    "SCHEMATA_EXTENSIONS",
    "ST_GEOMETRY_COLUMNS",
    "ST_SPATIAL_REFERENCE_SYSTEMS",
    "ST_UNITS_OF_MEASURE",
    "STATISTICS",
    "TABLE_CONSTRAINTS",
    "TABLE_CONSTRAINTS_EXTENSIONS",
    "TABLE_PRIVILEGES",
    "TABLES",
    "TABLES_EXTENSIONS",
    "TABLESPACES",
    "TABLESPACES_EXTENSIONS",
    "TRIGGERS",
    "USER_ATTRIBUTES",
    "USER_PRIVILEGES",
    "VIEW_ROUTINE_USAGE",
    "VIEW_TABLE_USAGE",
    "VIEWS",
]


MOCK_GET_VIEW_DEFINITION = """
CREATE ALGORITHM = MERGE DEFINER = `mysql.sys` @`localhost` SQL SECURITY INVOKER VIEW `sys`.`io_global_by_wait_by_bytes` (
  `event_name`, `total`, `total_latency`, 
  `min_latency`, `avg_latency`, `max_latency`, 
  `count_read`, `total_read`, `avg_read`, 
  `count_write`, `total_written`, 
  `avg_written`, `total_requested`
) AS 
select 
  substring_index(
    `performance_schema`.`file_summary_by_event_name`.`EVENT_NAME`, 
    '/', 
    -(2)
  ) AS `event_name`, 
  `performance_schema`.`file_summary_by_event_name`.`COUNT_STAR` AS `total`, 
  format_pico_time(
    `performance_schema`.`file_summary_by_event_name`.`SUM_TIMER_WAIT`
  ) AS `total_latency`, 
  format_pico_time(
    `performance_schema`.`file_summary_by_event_name`.`MIN_TIMER_WAIT`
  ) AS `min_latency`, 
  format_pico_time(
    `performance_schema`.`file_summary_by_event_name`.`AVG_TIMER_WAIT`
  ) AS `avg_latency`, 
  format_pico_time(
    `performance_schema`.`file_summary_by_event_name`.`MAX_TIMER_WAIT`
  ) AS `max_latency`, 
  `performance_schema`.`file_summary_by_event_name`.`COUNT_READ` AS `count_read`, 
  format_bytes(
    `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_READ`
  ) AS `total_read`, 
  format_bytes(
    ifnull(
      (
        `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_READ` / nullif(
          `performance_schema`.`file_summary_by_event_name`.`COUNT_READ`, 
          0
        )
      ), 
      0
    )
  ) AS `avg_read`, 
  `performance_schema`.`file_summary_by_event_name`.`COUNT_WRITE` AS `count_write`, 
  format_bytes(
    `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_WRITE`
  ) AS `total_written`, 
  format_bytes(
    ifnull(
      (
        `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_WRITE` / nullif(
          `performance_schema`.`file_summary_by_event_name`.`COUNT_WRITE`, 
          0
        )
      ), 
      0
    )
  ) AS `avg_written`, 
  format_bytes(
    (
      `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_WRITE` + `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_READ`
    )
  ) AS `total_requested` 
from 
  `performance_schema`.`file_summary_by_event_name` 
where 
  (
    (
      `performance_schema`.`file_summary_by_event_name`.`EVENT_NAME` like 'wait/io/file/%'
    ) 
    and (
      `performance_schema`.`file_summary_by_event_name`.`COUNT_STAR` > 0
    )
  ) 
order by 
  (
    `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_WRITE` + `performance_schema`.`file_summary_by_event_name`.`SUM_NUMBER_OF_BYTES_READ`
  ) desc

"""


class MySqlIngestionTest(TestCase):
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_definition")
    @patch("sqlalchemy.engine.reflection.Inspector.get_view_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_comment")
    @patch("sqlalchemy.engine.reflection.Inspector.get_table_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_schema_names")
    @patch("sqlalchemy.engine.reflection.Inspector.get_unique_constraints")
    @patch("sqlalchemy.engine.reflection.Inspector.get_pk_constraint")
    @patch("sqlalchemy.engine.reflection.Inspector.get_columns")
    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_mysql_ingestion(
        self,
        mock_connect,
        get_columns,
        get_pk_constraint,
        get_unique_constraints,
        get_schema_names,
        get_table_names,
        get_table_comment,
        get_view_names,
        get_view_definition,
    ):
        get_schema_names.return_value = MOCK_GET_SCHEMA_NAMES
        get_table_names.return_value = MOCK_GET_TABLE_NAMES
        get_table_comment.return_value = GET_TABLE_DESCRIPTIONS
        get_unique_constraints.return_value = MOCK_UNIQUE_CONSTRAINTS
        get_pk_constraint.return_value = MOCK_PK_CONSTRAINT
        get_columns.return_value = MOCK_GET_COLUMN
        get_view_names.return_value = MOCK_GET_VIEW_NAMES
        get_view_definition.return_value = MOCK_GET_VIEW_DEFINITION
        workflow = Workflow.create(json.loads(CONFIG))
        workflow.execute()
        workflow.print_status()
        workflow.stop()
