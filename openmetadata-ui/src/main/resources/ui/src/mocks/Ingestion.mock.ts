/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { IngestionProps } from '../components/Settings/Services/Ingestion/ingestion.interface';
import { AirflowStatusContextType } from '../context/AirflowStatusProvider/AirflowStatusProvider.interface';
import { AuthProvider } from '../generated/entity/services/connections/serviceConnection';
import {
  IngestionPipeline,
  PipelineState,
  PipelineType,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from '../interface/service.interface';

export const mockIngestionData: IngestionPipeline = {
  id: 'c804ec51-8fcf-4040-b830-5d967c4cbf49',
  name: 'test3_metadata',
  deployed: true,
  enabled: true,
  displayName: 'test3_metadata',
  pipelineType: PipelineType.Metadata,
  owners: [
    {
      id: 'fd96fdc7-a159-4802-84be-33c68d8b7e07',
      type: 'user',
      name: 'anonymous',
      fullyQualifiedName: 'anonymous',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/fd96fdc7-a159-4802-84be-33c68d8b7e07',
    },
  ],
  fullyQualifiedName: 'test3.test3_metadata',
  sourceConfig: {
    config: {},
  },
  openMetadataServerConnection: {
    hostPort: 'http://localhost:8585/api',
    authProvider: AuthProvider.Openmetadata,
    apiVersion: 'v1',
  },
  airflowConfig: {
    pausePipeline: false,
    concurrency: 1,
    pipelineTimezone: 'UTC',
    retries: 3,
    retryDelay: 300,
    pipelineCatchup: false,
    scheduleInterval: '5 * * * *',
    maxActiveRuns: 1,
    workflowTimeout: 60,
    workflowDefaultView: 'tree',
    workflowDefaultViewOrientation: 'LR',
  },
  service: {
    id: 'c68e904a-4262-4b58-84c1-8a986b4aa47d',
    type: 'databaseService',
    name: 'test3',
    fullyQualifiedName: 'test3',
    description: '',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/c68e904a-4262-4b58-84c1-8a986b4aa47d',
  },
  href: 'http://localhost:8585/api/v1/services/ingestionPipelines/c804ec51-8fcf-4040-b830-5d967c4cbf49',
  version: 0.1,
  updatedAt: 1649941364738,
  updatedBy: 'anonymous',
  deleted: false,
};

export const mockIngestionWorkFlow: { data: { data: IngestionPipeline[] } } = {
  data: {
    data: [mockIngestionData],
  },
};

export const mockService = {
  id: 'c68e904a-4262-4b58-84c1-8a986b4aa47d',
  name: 'test3',
  serviceType: 'BigQuery',
  description: '',
  connection: {
    config: {
      type: 'BigQuery',
      scheme: 'bigquery',
      hostPort: 'bigquery.googleapis.com',
      tagCategoryName: 'BigqueryPolicyTags',
      connectionOptions: {},
      connectionArguments: {},
      enablePolicyTagImport: true,
      supportsUsageExtraction: true,
      supportsMetadataExtraction: true,
    },
  },
  version: 0.1,
  updatedAt: 1649941355557,
  updatedBy: 'anonymous',
  owner: {
    id: 'fd96fdc7-a159-4802-84be-33c68d8b7e07',
    type: 'user',
    name: 'anonymous',
    fullyQualifiedName: 'anonymous',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/fd96fdc7-a159-4802-84be-33c68d8b7e07',
  },
  href: 'http://localhost:8585/api/v1/services/databaseServices/c68e904a-4262-4b58-84c1-8a986b4aa47d',
  deleted: false,
} as ServicesType;

export const mockPipelineStatus = {
  runId: 'run-id-1',
  pipelineState: PipelineState.Failed,
  startDate: 1714694417191,
  timestamp: 1714694417191,
  endDate: 1714694572424,
  status: [
    {
      name: 'Redshift',
      records: 0,
      updated_records: 0,
      warnings: 0,
      errors: 1,
      filtered: 0,
      failures: [
        {
          name: 'Unhandled',
          error:
            'Encountered exception running step [<metadata.ingestion.source.database.redshift.lineage.RedshiftLineageSource object at 0xffffb1a0ac50>]: [(psycopg2.OperationalError) could not connect to server: Connection timed out\n\tIs the server running on host "openmetadata-redshift-cluster.cdnpdclcdk2n.us-east-2.redshift.amazonaws.com" (3.136.170.250) and accepting\n\tTCP/IP connections on port 5440?\n\n(Background on this error at: https://sqlalche.me/e/14/e3q8)]',
          stackTrace:
            'Traceback (most recent call last):\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 3371, in _wrap_pool_connect\n    return fn()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 327, in connect\n    return _ConnectionFairy._checkout(self)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 894, in _checkout\n    fairy = _ConnectionRecord.checkout(pool)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 493, in checkout\n    rec = pool._do_get()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/impl.py", line 145, in _do_get\n    with util.safe_reraise():\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/langhelpers.py", line 70, in __exit__\n    compat.raise_(\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/impl.py", line 143, in _do_get\n    return self._create_connection()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 273, in _create_connection\n    return _ConnectionRecord(self)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 388, in __init__\n    self.__connect()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 690, in __connect\n    with util.safe_reraise():\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/langhelpers.py", line 70, in __exit__\n    compat.raise_(\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 686, in __connect\n    self.dbapi_connection = connection = pool._invoke_creator(self)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/create.py", line 574, in connect\n    return dialect.connect(*cargs, **cparams)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 598, in connect\n    return self.dbapi.connect(*cargs, **cparams)\n  File "/usr/local/lib/python3.10/site-packages/psycopg2/__init__.py", line 122, in connect\n    conn = _connect(dsn, connection_factory=connection_factory, **kwasync)\npsycopg2.OperationalError: could not connect to server: Connection timed out\n\tIs the server running on host "openmetadata-redshift-cluster.cdnpdclcdk2n.us-east-2.redshift.amazonaws.com" (3.136.170.250) and accepting\n\tTCP/IP connections on port 5440?\n\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File "/usr/local/lib/python3.10/site-packages/metadata/ingestion/api/step.py", line 209, in run\n    for result in self._iter():\n  File "/usr/local/lib/python3.10/site-packages/metadata/ingestion/source/database/lineage_source.py", line 127, in _iter\n    for table_query in self.get_table_query():\n  File "/usr/local/lib/python3.10/site-packages/metadata/ingestion/source/database/lineage_source.py", line 78, in get_table_query\n    yield from self.yield_table_query()\n  File "/usr/local/lib/python3.10/site-packages/metadata/ingestion/source/database/lineage_source.py", line 86, in yield_table_query\n    with engine.connect() as conn:\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 3325, in connect\n    return self._connection_cls(self, close_with_result=close_with_result)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 96, in __init__\n    else engine.raw_connection()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 3404, in raw_connection\n    return self._wrap_pool_connect(self.pool.connect, _connection)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 3374, in _wrap_pool_connect\n    Connection._handle_dbapi_exception_noconnection(\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 2208, in _handle_dbapi_exception_noconnection\n    util.raise_(\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 3371, in _wrap_pool_connect\n    return fn()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 327, in connect\n    return _ConnectionFairy._checkout(self)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 894, in _checkout\n    fairy = _ConnectionRecord.checkout(pool)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 493, in checkout\n    rec = pool._do_get()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/impl.py", line 145, in _do_get\n    with util.safe_reraise():\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/langhelpers.py", line 70, in __exit__\n    compat.raise_(\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/impl.py", line 143, in _do_get\n    return self._create_connection()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 273, in _create_connection\n    return _ConnectionRecord(self)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 388, in __init__\n    self.__connect()\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 690, in __connect\n    with util.safe_reraise():\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/langhelpers.py", line 70, in __exit__\n    compat.raise_(\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/pool/base.py", line 686, in __connect\n    self.dbapi_connection = connection = pool._invoke_creator(self)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/create.py", line 574, in connect\n    return dialect.connect(*cargs, **cparams)\n  File "/usr/local/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 598, in connect\n    return self.dbapi.connect(*cargs, **cparams)\n  File "/usr/local/lib/python3.10/site-packages/psycopg2/__init__.py", line 122, in connect\n    conn = _connect(dsn, connection_factory=connection_factory, **kwasync)\nsqlalchemy.exc.OperationalError: (psycopg2.OperationalError) could not connect to server: Connection timed out\n\tIs the server running on host "openmetadata-redshift-cluster.cdnpdclcdk2n.us-east-2.redshift.amazonaws.com" (3.136.170.250) and accepting\n\tTCP/IP connections on port 5440?\n\n(Background on this error at: https://sqlalche.me/e/14/e3q8)\n',
        },
      ],
    },
    {
      name: 'OpenMetadata',
      records: 0,
      updated_records: 0,
      warnings: 0,
      errors: 0,
      filtered: 0,
      failures: [],
    },
  ],
};

export const FAILURE = {
  name: 'FILES',
  error:
    'Unexpected exception to yield table [FILES]: (pymysql.err.OperationalError) (1227, \'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation\')\n[SQL: /* {"app": "OpenMetadata", "version": "1.3.0.0.dev0"} */\nSHOW CREATE TABLE `information_schema`.`FILES`]\n(Background on this error at: https://sqlalche.me/e/14/e3q8)',
  stackTrace:
    'Traceback (most recent call last):\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1910, in _execute_context\n    self.dialect.do_execute(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 736, in do_execute\n    cursor.execute(statement, parameters)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 153, in execute\n    result = self._query(query)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 322, in _query\n    conn.query(q)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 558, in query\n    self._affected_rows = self._read_query_result(unbuffered=unbuffered)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 822, in _read_query_result\n    result.read()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 1200, in read\n    first_packet = self.connection._read_packet()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 772, in _read_packet\n    packet.raise_for_error()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/protocol.py", line 221, in raise_for_error\n    err.raise_mysql_exception(self._data)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/err.py", line 143, in raise_mysql_exception\n    raise errorclass(errno, errval)\npymysql.err.OperationalError: (1227, \'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation\')\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File "/home/airflow/.local/lib/python3.10/site-packages/metadata/ingestion/source/database/common_db_source.py", line 422, in yield_table\n    ) = self.get_columns_and_constraints(\n  File "/home/airflow/.local/lib/python3.10/site-packages/metadata/ingestion/source/database/sql_column_handler.py", line 214, in get_columns_and_constraints\n    ) = self._get_columns_with_constraints(schema_name, table_name, inspector)\n  File "/home/airflow/.local/lib/python3.10/site-packages/metadata/ingestion/source/database/sql_column_handler.py", line 114, in _get_columns_with_constraints\n    pk_constraints = inspector.get_pk_constraint(table_name, schema_name)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/reflection.py", line 528, in get_pk_constraint\n    return self.dialect.get_pk_constraint(\n  File "<string>", line 2, in get_pk_constraint\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/reflection.py", line 55, in cache\n    ret = fn(self, con, *args, **kw)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 2842, in get_pk_constraint\n    parsed_state = self._parsed_state_or_create(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 3085, in _parsed_state_or_create\n    return self._setup_parser(\n  File "<string>", line 2, in _setup_parser\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/reflection.py", line 55, in cache\n    ret = fn(self, con, *args, **kw)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 3112, in _setup_parser\n    sql = self._show_create_table(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 3220, in _show_create_table\n    ).exec_driver_sql(st)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1770, in exec_driver_sql\n    return self._exec_driver_sql(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1674, in _exec_driver_sql\n    ret = self._execute_context(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1953, in _execute_context\n    self._handle_dbapi_exception(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 2134, in _handle_dbapi_exception\n    util.raise_(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1910, in _execute_context\n    self.dialect.do_execute(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 736, in do_execute\n    cursor.execute(statement, parameters)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 153, in execute\n    result = self._query(query)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 322, in _query\n    conn.query(q)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 558, in query\n    self._affected_rows = self._read_query_result(unbuffered=unbuffered)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 822, in _read_query_result\n    result.read()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 1200, in read\n    first_packet = self.connection._read_packet()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 772, in _read_packet\n    packet.raise_for_error()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/protocol.py", line 221, in raise_for_error\n    err.raise_mysql_exception(self._data)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/err.py", line 143, in raise_mysql_exception\n    raise errorclass(errno, errval)\nsqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1227, \'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation\')\n[SQL: /* {"app": "OpenMetadata", "version": "1.3.0.0.dev0"} */\nSHOW CREATE TABLE `information_schema`.`FILES`]\n(Background on this error at: https://sqlalche.me/e/14/e3q8)\n',
};

export const EXECUTION_RUNS = [
  {
    runId: 'c95cc97b-9ea2-465c-9b5a-255401674324',
    pipelineState: 'partialSuccess',
    startDate: 1667304123,
    timestamp: 1667304123,
    endDate: 1667304126,
    status: [
      {
        name: 'Source',
        records: 155,
        updated_records: 0,
        warnings: 0,
        errors: 1,
        filtered: 0,
        failures: [FAILURE],
      },
      {
        name: 'Sink',
        records: 155,
        updated_records: 0,
        warnings: 0,
        errors: 0,
        filtered: 0,
        failures: [],
      },
    ],
  },
  {
    runId: '60b3e15c-3865-4c81-a1ee-36ff85d2be8e',
    pipelineState: 'success',
    startDate: 1667301533,
    timestamp: 1667301533,
    endDate: 1667301536,
  },
  {
    runId: 'a2c6fbf9-952f-4ddd-9b01-c203bf54f0fe',
    pipelineState: 'success',
    startDate: 1667297370,
    timestamp: 1667297370,
    endDate: 1667297373,
  },
];

const mockUpdateWorkflows = jest.fn();

const mockPaging = {
  after: 'after',
  before: 'before',
  total: 1,
};

const mockPagingCursor = {
  cursorType: undefined,
  cursorValue: undefined,
  currentPage: '1',
  pageSize: 10,
};

const mockCurrentHandleIngestionListUpdate = jest.fn();
const mockCurrentHandleSearchChange = jest.fn();
const mockCurrentOnPageChange = jest.fn();

export const ingestionProps: IngestionProps = {
  ingestionPipelineList: mockIngestionWorkFlow.data
    .data as unknown as IngestionPipeline[],
  serviceDetails: mockService,
  onIngestionWorkflowsUpdate: mockUpdateWorkflows,
  searchText: '',
  airflowInformation: {
    isAirflowAvailable: true,
    isFetchingStatus: false,
    platform: 'airflow',
  } as AirflowStatusContextType,
  handleIngestionListUpdate: mockCurrentHandleIngestionListUpdate,
  handleSearchChange: mockCurrentHandleSearchChange,
  onPageChange: mockCurrentOnPageChange,
  ingestionPagingInfo: {
    paging: mockPaging,
    handlePagingChange: jest.fn(),
    currentPage: 1,
    handlePageChange: jest.fn(),
    pageSize: 10,
    handlePageSizeChange: jest.fn(),
    showPagination: true,
    pagingCursor: mockPagingCursor,
  },
  handleTypeFilterChange: jest.fn(),
  handleStatusFilterChange: jest.fn(),
  refreshAgentsList: jest.fn(),
};
