/*
 *  Copyright 2023 Collate.
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

import { render, screen } from '@testing-library/react';
import { StatusType } from '../../../../generated/entity/data/pipeline';
import { EXECUTION_LIST_MOCK } from '../../../../mocks/PipelineVersion.mock';
import ListView from './ListViewTab.component';

jest.mock('../../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

jest.mock('../../../../utils/executionUtils', () => ({
  getTableViewData: jest.fn().mockImplementation((data) => data),
  StatusIndicator: jest
    .fn()
    .mockImplementation(() => <div>StatusIndicator</div>),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn().mockImplementation((timestamp) => timestamp),
  getCurrentMillis: jest.fn().mockImplementation(() => 1715404800000),
  getEpochMillisForPastDays: jest
    .fn()
    .mockImplementation((days) => 1715404800000 - days * 24 * 60 * 60 * 1000),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

const mockProps = {
  executions: EXECUTION_LIST_MOCK,
  status: StatusType.Successful,
  loading: false,
  searchString: undefined,
  handleSearch: jest.fn(),
};

describe('Test ListViewTab Component', () => {
  it('Should render loader in table component', async () => {
    render(<ListView {...mockProps} loading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('Should render component properly if not loading', async () => {
    render(<ListView {...mockProps} />);

    expect(screen.getByTestId('list-view-table')).toBeInTheDocument();
  });

  it('Should render NoDataPlaceholder if no data present', async () => {
    render(<ListView {...mockProps} executions={[]} />);

    expect(screen.getByTestId('list-view-table')).toBeInTheDocument();

    expect(
      screen.getByTestId(
        /(no-data|permission-error|search-error|create-error|assign-error)-placeholder/
      )
    ).toBeInTheDocument();
  });

  it('Should render columns if data present', async () => {
    render(<ListView {...mockProps} />);

    expect(screen.getByTestId('list-view-table')).toBeInTheDocument();

    expect(
      screen.queryByTestId(
        /(no-data|permission-error|search-error|create-error|assign-error)-placeholder/
      )
    ).not.toBeInTheDocument();

    expect(screen.getAllByText('StatusIndicator')).toHaveLength(7);
  });

  it('Should render task metrics and the log link when present', async () => {
    render(
      <ListView
        {...mockProps}
        executions={[
          {
            name: 'load_orders',
            status: StatusType.Successful,
            timestamp: '2024-05-11',
            key: 1715404800000,
            rowsRead: 1234,
            rowsWritten: 1200,
            rowsFiltered: 34,
            executionTime: '2.00 seconds',
            logLink: 'https://orchestrator.example/runs/1',
          } as unknown as (typeof EXECUTION_LIST_MOCK)[number],
        ]}
      />
    );

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('2.00 seconds')).toBeInTheDocument();
    expect(screen.getByTestId('log-link-load_orders')).toHaveAttribute(
      'href',
      'https://orchestrator.example/runs/1'
    );
  });

  it('Should render placeholders when a task has no metrics or log link', async () => {
    render(
      <ListView
        {...mockProps}
        executions={[
          {
            name: 'load_orders',
            status: StatusType.Successful,
            timestamp: '2024-05-11',
            key: 1715404800000,
          } as unknown as (typeof EXECUTION_LIST_MOCK)[number],
        ]}
      />
    );

    expect(screen.getAllByText('--')).toHaveLength(7);
    expect(
      screen.queryByTestId('log-link-load_orders')
    ).not.toBeInTheDocument();
  });
});
