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
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ColumnsType } from 'antd/lib/table';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ColumnProfile } from '../../../../../generated/entity/data/table';
import { MOCK_TABLE } from '../../../../../mocks/TableData.mock';
import { useTableProfiler } from '../TableProfilerProvider';
import ColumnProfileTable from './ColumnProfileTable';

let capturedColumns: ColumnsType<{ profile?: ColumnProfile }> = [];

jest.mock('../../../../common/Table/Table', () =>
  jest.fn().mockImplementation(({ columns, searchProps }) => {
    capturedColumns = columns ?? [];

    return (
      <div>
        <input
          data-testid="searchbar"
          value={searchProps?.value ?? ''}
          onChange={(e) => searchProps?.onSearch?.(e.target.value)}
        />
        <div>Table</div>
      </div>
    );
  })
);

jest.mock('../../../../common/SummaryCard/SummaryCardV1', () =>
  jest.fn().mockImplementation(({ title, value }) => (
    <div data-testid="summary-card-v1">
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ))
);

jest.mock('../NoProfilerBanner/NoProfilerBanner.component', () =>
  jest.fn().mockImplementation(() => <div>NoProfilerBanner</div>)
);

jest.mock('../SingleColumnProfile', () =>
  jest.fn().mockImplementation(() => <div>SingleColumnProfile</div>)
);

jest.mock('../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

jest.mock(
  '../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () => jest.fn().mockReturnValue(<div>FilterTablePlaceHolder</div>)
);

jest.mock('../../../../../utils/CommonUtils', () => ({
  formatNumberWithComma: jest.fn(),
  getTableFQNFromColumnFQN: jest.fn().mockImplementation((fqn) => fqn),
  calculatePercentage: jest
    .fn()
    .mockImplementation(
      (
        numerator: number,
        denominator: number,
        precision: number,
        format: boolean
      ) => {
        if (denominator === 0) {
          return format ? '0%' : 0;
        }
        const value = parseFloat(
          ((numerator / denominator) * 100).toFixed(precision)
        );

        return format ? `${value}%` : value;
      }
    ),
}));

jest.mock('../../../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn().mockReturnValue({}),
  pruneEmptyChildren: jest.fn().mockImplementation((data) => data),
}));

jest.mock('../../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

jest.mock('../../../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ search: '', pathname: '/test' }),
}));

jest.mock('../../../../../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
  searchTableColumnsByFQN: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
}));

jest.mock('../TableProfilerProvider', () => ({
  useTableProfiler: jest.fn().mockImplementation(() => ({
    tableProfiler: MOCK_TABLE,
    permissions: {
      EditAll: true,
      EditTests: true,
      EditDataProfile: true,
      ViewDataProfile: true,
      ViewAll: true,
    },
    isTestsLoading: false,
    isProfilerDataLoading: false,
    overallSummary: [],
    isProfilingEnabled: true,
    testCaseSummary: {},
  })),
}));

describe('Test ColumnProfileTable component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render without crashing', async () => {
    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    const container = await screen.findByTestId(
      'column-profile-table-container'
    );
    const searchbox = await screen.findByTestId('searchbar');

    expect(container).toBeInTheDocument();
    expect(searchbox).toBeInTheDocument();
  });

  it('should render without crashing even if column is undefined', async () => {
    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    const container = await screen.findByTestId(
      'column-profile-table-container'
    );
    const searchbox = await screen.findByTestId('searchbar');

    expect(container).toBeInTheDocument();
    expect(searchbox).toBeInTheDocument();
  });

  it('search box should work as expected', async () => {
    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    const searchbox = await screen.findByTestId('searchbar');

    expect(searchbox).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(searchbox, { target: { value: 'test' } });
    });

    expect(searchbox).toHaveValue('test');

    await act(async () => {
      fireEvent.change(searchbox, { target: { value: '' } });
    });

    expect(searchbox).toHaveValue('');
  });

  it('should render ErrorPlaceHolder when ViewDataProfile permission is false', async () => {
    (useTableProfiler as jest.Mock).mockReturnValueOnce({
      tableProfiler: MOCK_TABLE,
      permissions: {
        EditAll: false,
        ViewDataProfile: false,
        ViewAll: false,
      },
      isTestsLoading: false,
      isProfilerDataLoading: false,
      overallSummary: [],
      isProfilingEnabled: true,
      testCaseSummary: {},
    });

    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render NoProfilerBanner when profiling is disabled', async () => {
    (useTableProfiler as jest.Mock).mockReturnValueOnce({
      tableProfiler: MOCK_TABLE,
      permissions: {
        ViewDataProfile: true,
        ViewAll: true,
      },
      isTestsLoading: false,
      isProfilerDataLoading: false,
      overallSummary: [],
      isProfilingEnabled: false,
      testCaseSummary: {},
    });

    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    expect(await screen.findByText('NoProfilerBanner')).toBeInTheDocument();
  });

  it('should not render NoProfilerBanner when profiling is enabled', async () => {
    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    expect(screen.queryByText('NoProfilerBanner')).not.toBeInTheDocument();
  });

  it('should render SummaryCardV1 for each overallSummary item', async () => {
    (useTableProfiler as jest.Mock).mockReturnValueOnce({
      tableProfiler: MOCK_TABLE,
      permissions: { ViewDataProfile: true, ViewAll: true },
      isTestsLoading: false,
      isProfilerDataLoading: false,
      overallSummary: [
        { title: 'Total', value: 100, icon: null },
        { title: 'Success', value: 80, icon: null },
      ],
      isProfilingEnabled: true,
      testCaseSummary: {},
    });

    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    const summaryCards = await screen.findAllByTestId('summary-card-v1');

    expect(summaryCards).toHaveLength(2);
  });

  it('should render SingleColumnProfile when activeColumnFqn is in the URL', async () => {
    const useCustomLocation = jest.requireMock(
      '../../../../../hooks/useCustomLocation/useCustomLocation'
    ).default;
    useCustomLocation.mockReturnValueOnce({
      search: '?activeColumnFqn=test.table.column',
      pathname: '/test',
    });

    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    expect(await screen.findByText('SingleColumnProfile')).toBeInTheDocument();
  });

  it('should call getTableColumnsByFQN when tableFqn is available', async () => {
    const { getTableColumnsByFQN } = jest.requireMock(
      '../../../../../rest/tableAPI'
    );
    const { useFqn } = jest.requireMock('../../../../../hooks/useFqn');
    useFqn.mockReturnValueOnce({ fqn: 'test.table' });

    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });

    expect(getTableColumnsByFQN).toHaveBeenCalledWith('test.table', {
      limit: expect.any(Number),
      offset: 0,
      fields: expect.any(String),
    });
  });
});

describe('ColumnProfileTable proportion column renders', () => {
  const proportionColumnKeys = [
    'nullProportion',
    'uniqueProportion',
    'distinctProportion',
  ] as const;

  beforeEach(async () => {
    cleanup();
    await act(async () => {
      render(<ColumnProfileTable />, { wrapper: MemoryRouter });
    });
  });

  it.each(proportionColumnKeys)(
    'should show "0%" instead of "--" when %s is 0',
    (field) => {
      const col = capturedColumns.find((c) => c.key === field);
      const renderFn = col?.render as (
        profile: ColumnProfile | undefined
      ) => string;

      expect(renderFn({ [field]: 0 } as unknown as ColumnProfile)).toBe('0%');
    }
  );

  it.each(proportionColumnKeys)('should show "--" when %s is null', (field) => {
    const col = capturedColumns.find((c) => c.key === field);
    const renderFn = col?.render as (
      profile: ColumnProfile | undefined
    ) => string;

    expect(renderFn({ [field]: null } as unknown as ColumnProfile)).toBe('--');
  });

  it.each(proportionColumnKeys)(
    'should show "--" when %s is undefined',
    (field) => {
      const col = capturedColumns.find((c) => c.key === field);
      const renderFn = col?.render as (
        profile: ColumnProfile | undefined
      ) => string;

      expect(renderFn({} as ColumnProfile)).toBe('--');
      expect(renderFn(undefined)).toBe('--');
    }
  );

  it.each(proportionColumnKeys)(
    'should show correct percentage for a normal value when %s is 0.5',
    (field) => {
      const col = capturedColumns.find((c) => c.key === field);
      const renderFn = col?.render as (
        profile: ColumnProfile | undefined
      ) => string;

      expect(renderFn({ [field]: 0.5 } as unknown as ColumnProfile)).toBe(
        '50%'
      );
    }
  );

  it.each(proportionColumnKeys)(
    'should not round small values (%s = 0.001) to 0%',
    (field) => {
      const col = capturedColumns.find((c) => c.key === field);
      const renderFn = col?.render as (
        profile: ColumnProfile | undefined
      ) => string;

      // 0.001 * 100 = 0.1 → rounds to 0.1%, not 0%
      expect(renderFn({ [field]: 0.001 } as unknown as ColumnProfile)).toBe(
        '0.1%'
      );
    }
  );
});
