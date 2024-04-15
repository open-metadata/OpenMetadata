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

import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { mockDataInsightApplicationRun } from '../../../../../mocks/LogsViewerPage.mock';
import { getRunHistoryForPipeline } from '../../../../../rest/ingestionPipelineAPI';
import ConnectionStepCard from '../../../../common/TestConnection/ConnectionStepCard/ConnectionStepCard';
import { IngestionRecentRuns } from './IngestionRecentRuns.component';

const failure = {
  name: 'FILES',
  error:
    'Unexpected exception to yield table [FILES]: (pymysql.err.OperationalError) (1227, \'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation\')\n[SQL: /* {"app": "OpenMetadata", "version": "1.3.0.0.dev0"} */\nSHOW CREATE TABLE `information_schema`.`FILES`]\n(Background on this error at: https://sqlalche.me/e/14/e3q8)',
  stackTrace:
    'Traceback (most recent call last):\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1910, in _execute_context\n    self.dialect.do_execute(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 736, in do_execute\n    cursor.execute(statement, parameters)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 153, in execute\n    result = self._query(query)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 322, in _query\n    conn.query(q)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 558, in query\n    self._affected_rows = self._read_query_result(unbuffered=unbuffered)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 822, in _read_query_result\n    result.read()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 1200, in read\n    first_packet = self.connection._read_packet()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 772, in _read_packet\n    packet.raise_for_error()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/protocol.py", line 221, in raise_for_error\n    err.raise_mysql_exception(self._data)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/err.py", line 143, in raise_mysql_exception\n    raise errorclass(errno, errval)\npymysql.err.OperationalError: (1227, \'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation\')\n\nThe above exception was the direct cause of the following exception:\n\nTraceback (most recent call last):\n  File "/home/airflow/.local/lib/python3.10/site-packages/metadata/ingestion/source/database/common_db_source.py", line 422, in yield_table\n    ) = self.get_columns_and_constraints(\n  File "/home/airflow/.local/lib/python3.10/site-packages/metadata/ingestion/source/database/sql_column_handler.py", line 214, in get_columns_and_constraints\n    ) = self._get_columns_with_constraints(schema_name, table_name, inspector)\n  File "/home/airflow/.local/lib/python3.10/site-packages/metadata/ingestion/source/database/sql_column_handler.py", line 114, in _get_columns_with_constraints\n    pk_constraints = inspector.get_pk_constraint(table_name, schema_name)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/reflection.py", line 528, in get_pk_constraint\n    return self.dialect.get_pk_constraint(\n  File "<string>", line 2, in get_pk_constraint\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/reflection.py", line 55, in cache\n    ret = fn(self, con, *args, **kw)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 2842, in get_pk_constraint\n    parsed_state = self._parsed_state_or_create(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 3085, in _parsed_state_or_create\n    return self._setup_parser(\n  File "<string>", line 2, in _setup_parser\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/reflection.py", line 55, in cache\n    ret = fn(self, con, *args, **kw)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 3112, in _setup_parser\n    sql = self._show_create_table(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/dialects/mysql/base.py", line 3220, in _show_create_table\n    ).exec_driver_sql(st)\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1770, in exec_driver_sql\n    return self._exec_driver_sql(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1674, in _exec_driver_sql\n    ret = self._execute_context(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1953, in _execute_context\n    self._handle_dbapi_exception(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 2134, in _handle_dbapi_exception\n    util.raise_(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/util/compat.py", line 211, in raise_\n    raise exception\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/base.py", line 1910, in _execute_context\n    self.dialect.do_execute(\n  File "/home/airflow/.local/lib/python3.10/site-packages/sqlalchemy/engine/default.py", line 736, in do_execute\n    cursor.execute(statement, parameters)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 153, in execute\n    result = self._query(query)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/cursors.py", line 322, in _query\n    conn.query(q)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 558, in query\n    self._affected_rows = self._read_query_result(unbuffered=unbuffered)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 822, in _read_query_result\n    result.read()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 1200, in read\n    first_packet = self.connection._read_packet()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/connections.py", line 772, in _read_packet\n    packet.raise_for_error()\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/protocol.py", line 221, in raise_for_error\n    err.raise_mysql_exception(self._data)\n  File "/home/airflow/.local/lib/python3.10/site-packages/pymysql/err.py", line 143, in raise_mysql_exception\n    raise errorclass(errno, errval)\nsqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1227, \'Access denied; you need (at least one of) the PROCESS privilege(s) for this operation\')\n[SQL: /* {"app": "OpenMetadata", "version": "1.3.0.0.dev0"} */\nSHOW CREATE TABLE `information_schema`.`FILES`]\n(Background on this error at: https://sqlalche.me/e/14/e3q8)\n',
};

const executionRuns = [
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
        failures: [failure],
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

jest.mock(
  '../../../../common/TestConnection/ConnectionStepCard/ConnectionStepCard',
  () => {
    return jest.fn().mockImplementation(() => <p>testConnectionStepCard</p>);
  }
);

jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
  getRunHistoryForPipeline: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'success',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...executionRuns,
      ],
      paging: { total: 4 },
    })
  ),
}));

const mockIngestion = { fullyQualifiedName: 'test' } as IngestionPipeline;

describe('Test IngestionRecentRun component', () => {
  it('should call getRunHistoryForPipeline to fetch all the status', async () => {
    act(() => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    expect(getRunHistoryForPipeline).toHaveBeenCalledWith(
      'test',
      expect.anything()
    );
  });

  it('should render runs when API returns runs', async () => {
    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Success/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render queued runs when API returns runs with status queued', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'queued',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...executionRuns,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Queued/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render running runs when API returns runs with status running', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'running',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...executionRuns,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Running/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render failed runs when API returns runs with status failed', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'failed',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...executionRuns,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Failed/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should render partialSuccess runs when API returns runs with status partialSuccess', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          runId: '7e369da9-4d0e-4887-b99b-1a35cfab551e',
          pipelineState: 'partialSuccess',
          startDate: 1667307722,
          timestamp: 1667307722,
          endDate: 1667307725,
        },
        ...executionRuns,
      ],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const successRun = await screen.findByText(/Partial Success/);

    expect(successRun).toBeInTheDocument();
    expect(runs).toHaveLength(4);
  });

  it('should show additional details for click on run', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [...executionRuns],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const partialSuccess = await screen.findByText(/Partial Success/);

    expect(partialSuccess).toBeInTheDocument();
    expect(runs).toHaveLength(3);

    act(() => {
      fireEvent.click(partialSuccess);
    });

    expect(await findByRole(document.body, 'dialog')).toBeInTheDocument();

    expect(await screen.findByText(/Source/)).toBeInTheDocument();

    expect(await screen.findByText(/Sink/)).toBeInTheDocument();
    expect(await screen.findAllByText(/label.log-plural/)).toHaveLength(1);
  });

  it('should show additional details for clicked on non latest run', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [...executionRuns],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const partialSuccess = await screen.findByText(/Partial Success/);

    expect(partialSuccess).toBeInTheDocument();
    expect(runs).toHaveLength(3);

    await act(async () => {
      // click on last run
      fireEvent.click(runs[runs.length - 1]);
    });

    expect(await findByRole(document.body, 'dialog')).toBeInTheDocument();

    expect(await screen.findByText(/Source/)).toBeInTheDocument();

    expect(await screen.findByText(/Sink/)).toBeInTheDocument();
    expect(await screen.findAllByText(/label.log-plural/)).toHaveLength(1);
  });

  it('should show stacktrace when click on logs', async () => {
    (getRunHistoryForPipeline as jest.Mock).mockResolvedValueOnce({
      data: [...executionRuns],
      paging: { total: 4 },
    });

    await act(async () => {
      render(<IngestionRecentRuns ingestion={mockIngestion} />);
    });

    const runs = await screen.findAllByTestId('pipeline-status');
    const partialSuccess = await screen.findByText(/Partial Success/);

    expect(partialSuccess).toBeInTheDocument();
    expect(runs).toHaveLength(3);

    act(() => {
      fireEvent.click(partialSuccess);
    });

    expect(await findByRole(document.body, 'dialog')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(await screen.findByText(/label.log-plural/));
    });

    expect(ConnectionStepCard).toHaveBeenNthCalledWith(
      2,
      {
        isTestingConnection: false,
        testConnectionStep: {
          description: failure.error,
          mandatory: false,
          name: 'FILES',
        },
        testConnectionStepResult: {
          errorLog: failure.stackTrace,
          mandatory: false,
          message: failure.error,
          name: 'FILES',
          passed: false,
        },
      },
      {}
    );
    expect(
      await screen.findByText(/testConnectionStepCard/)
    ).toBeInTheDocument();
  });

  it('should not fetch getRunHistoryForPipeline in case of Application', async () => {
    await act(async () => {
      render(
        <IngestionRecentRuns
          isApplicationType
          appRuns={mockDataInsightApplicationRun.data}
        />
      );
    });

    expect(getRunHistoryForPipeline).not.toHaveBeenCalled();
  });
});
