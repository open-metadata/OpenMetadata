/*
 *  Copyright 2026 Collate.
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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { getTestCaseDimensionResultsByFqn } from '../../../../rest/testAPI';
import DimensionalityTab from './DimensionalityTab';

const mockGetTestCaseDimensionResultsByFqn =
  getTestCaseDimensionResultsByFqn as jest.MockedFunction<
    typeof getTestCaseDimensionResultsByFqn
  >;

// Untyped view of the fetch mock: the race tests build manually-resolvable
// Promises whose `resolve` is typed against the real return type, which would
// otherwise refuse to assign to `(value: unknown) => void` resolvers. Mirrors
// the `(getTestCaseFailedSampleData as jest.Mock)` cast in the sibling suite.
const untypedFetchMock =
  mockGetTestCaseDimensionResultsByFqn as unknown as jest.Mock;

const CUSTOM_RANGE = {
  startTs: 1709490600000,
  endTs: 1709576999999,
  key: 'customRange',
  title: '2024-03-04 -> 2024-03-04',
};

const PRESET_RANGE = {
  startTs: 1709490600000,
  endTs: 1709576999999,
  key: 'last7days',
  title: 'Last 7 days',
};

jest.mock('@openmetadata/ui-core-components', () => {
  const Table = Object.assign(
    jest.fn().mockImplementation(({ children }) => <table>{children}</table>),
    {
      Body: jest
        .fn()
        .mockImplementation(({ children, items }) => (
          <tbody>{items.map(children)}</tbody>
        )),
      Cell: jest.fn().mockImplementation(({ children }) => <td>{children}</td>),
      Head: jest.fn().mockImplementation(({ label }) => <th>{label}</th>),
      Header: jest.fn().mockImplementation(({ children, columns }) => (
        <thead>
          <tr>{columns.map(children)}</tr>
        </thead>
      )),
      Row: jest
        .fn()
        .mockImplementation(({ children, columns }) => (
          <tr>{columns.map(children)}</tr>
        )),
    }
  );

  return {
    EmptyPlaceholder: jest
      .fn()
      .mockImplementation(({ footer, ...props }) => (
        <div data-testid={props['data-testid']}>{footer}</div>
      )),
    Badge: jest
      .fn()
      .mockImplementation(({ children, ...props }) => (
        <span data-testid={props['data-testid']}>{children}</span>
      )),
    Select: Object.assign(
      jest.fn().mockImplementation(({ onChange }) => (
        <div data-testid="dimension-select">
          <button
            data-testid="dimension-select-trigger"
            type="button"
            onClick={() => onChange?.('region')}>
            Switch dimension
          </button>
        </div>
      )),
      { Item: jest.fn() }
    ),
    Skeleton: jest
      .fn()
      .mockImplementation(() => <div data-testid="skeleton" />),
    Table,
  };
});

const mockNavigationState = {
  breadcrumbData: [
    {
      name: 'Data Quality',
      url: '/data-quality/test-cases',
    },
  ],
};

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockImplementation(() => ({ state: mockNavigationState }))
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, state, to }) => (
    <a data-state={JSON.stringify(state)} href={to}>
      {children}
    </a>
  )),
}));

jest.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn(() => ({
      testCase: {
        dimensionColumns: ['country'],
        fullyQualifiedName: 'service.database.schema.table.test',
      },
    })),
  })
);

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseDimensionResultsByFqn: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ dimensionKey: 'country=value' })),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn(() => '/table/test'),
  getTestCaseDimensionsDetailPagePath: jest.fn(() => '/test/dimension'),
}));

jest.mock('../../../common/DatePickerMenu/DatePickerMenu.component', () =>
  jest.fn().mockImplementation(({ handleDateRangeChange }) => (
    <div>
      <button
        data-testid="date-picker-menu"
        onClick={() => handleDateRangeChange(CUSTOM_RANGE)}>
        Change custom date
      </button>
      <button
        data-testid="preset-date-range"
        onClick={() => handleDateRangeChange(PRESET_RANGE)}>
        Change preset date
      </button>
    </div>
  ))
);

jest.mock('../../../common/DateTimeDisplay/DateTimeDisplay', () =>
  jest.fn().mockImplementation(() => <span>Last run</span>)
);

jest.mock('./DimensionalityHeatmap/DimensionalityHeatmap.component', () =>
  jest.fn().mockImplementation(() => <div data-testid="heatmap" />)
);

describe('DimensionalityTab', () => {
  it('preserves the origin when opening dimension details', async () => {
    mockGetTestCaseDimensionResultsByFqn.mockResolvedValueOnce({
      paging: { total: 1 },
      data: [
        {
          id: 'dimension-result-id',
          testCaseResultId: 'test-case-result-id',
          testCaseStatus: TestCaseStatus.Success,
          dimensionKey: 'country=US',
          dimensionValues: [{ name: 'country', value: 'US' }],
          timestamp: 1709576999999,
        },
      ],
    });

    render(<DimensionalityTab />);

    const link = await screen.findByRole('link', { name: 'US' });

    expect(JSON.parse(link.getAttribute('data-state') ?? '{}')).toEqual(
      mockNavigationState
    );
  });

  it('marks a dimension excluded from the roll-up next to its status', async () => {
    mockGetTestCaseDimensionResultsByFqn.mockResolvedValueOnce({
      data: [
        {
          id: 'ad',
          testCaseResultId: 'result',
          dimensionKey: 'country=AD',
          dimensionValues: [{ name: 'country', value: 'AD' }],
          testCaseStatus: TestCaseStatus.Failed,
          excludedFromRollUp: true,
          timestamp: 1709576999999,
        },
        {
          id: 'us',
          testCaseResultId: 'result',
          dimensionKey: 'country=US',
          dimensionValues: [{ name: 'country', value: 'US' }],
          testCaseStatus: TestCaseStatus.Failed,
          timestamp: 1709576999999,
        },
      ],
      paging: { total: 2 },
    });

    render(<DimensionalityTab />);

    expect(await screen.findAllByTestId('status-badge')).toHaveLength(2);
    expect(screen.getAllByTestId('excluded-from-roll-up-badge')).toHaveLength(
      1
    );
    expect(screen.getByText('label.excluded-from-roll-up')).toBeInTheDocument();
  });

  it('preserves the picker boundaries for a custom date range', async () => {
    render(<DimensionalityTab />);

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalled()
    );
    mockGetTestCaseDimensionResultsByFqn.mockClear();

    fireEvent.click(screen.getByTestId('date-picker-menu'));

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledWith(
        'service.database.schema.table.test',
        {
          dimensionName: 'country',
          startTs: CUSTOM_RANGE.startTs,
          endTs: CUSTOM_RANGE.endTs,
        }
      )
    );
  });

  it('preserves the picker boundaries for a preset date range', async () => {
    render(<DimensionalityTab />);

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalled()
    );
    mockGetTestCaseDimensionResultsByFqn.mockClear();

    fireEvent.click(screen.getByTestId('preset-date-range'));

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledWith(
        'service.database.schema.table.test',
        {
          dimensionName: 'country',
          startTs: PRESET_RANGE.startTs,
          endTs: PRESET_RANGE.endTs,
        }
      )
    );
  });

  it('renders only the latest run when multiple results exist for the same dimension value', async () => {
    // The table dedup (getLatestResultPerDimension) must keep the newest run per
    // dimension value — the same render path the stale-response guard feeds.
    mockGetTestCaseDimensionResultsByFqn.mockResolvedValueOnce({
      data: [
        {
          id: 'us-old',
          testCaseResultId: 'result',
          dimensionKey: 'country=US',
          dimensionValues: [{ name: 'country', value: 'US' }],
          testCaseStatus: TestCaseStatus.Success,
          timestamp: 1709576999998,
          impactScore: 10,
        },
        {
          id: 'us-new',
          testCaseResultId: 'result',
          dimensionKey: 'country=US',
          dimensionValues: [{ name: 'country', value: 'US' }],
          testCaseStatus: TestCaseStatus.Failed,
          timestamp: 1709576999999,
          impactScore: 90,
        },
      ],
      paging: { total: 2 },
    });

    render(<DimensionalityTab />);

    // Exactly one row for US, and it carries the newest run's status.
    const badges = await screen.findAllByTestId('status-badge');

    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent('label.failed');
  });

  // Stale-response regression: the fetch effect re-fires on every dimension or
  // date-range change. A slower, superseded request that resolves after the
  // newer one must never overwrite the fresh view — and a late failure must
  // never wipe valid data via the catch branch. See the guard on
  // fetchDimensionColumnData and sibling guards in FailedTestCaseSampleData /
  // TestCaseIncidentTab.

  const FRESH_PAYLOAD = {
    data: [
      {
        id: 'fresh-id',
        testCaseResultId: 'result',
        dimensionKey: 'country=FRESH',
        dimensionValues: [{ name: 'country', value: 'FRESH' }],
        testCaseStatus: TestCaseStatus.Success,
        timestamp: 1709576999999,
      },
    ],
    paging: { total: 1 },
  };

  const STALE_PAYLOAD = {
    data: [
      {
        id: 'stale-id',
        testCaseResultId: 'result',
        dimensionKey: 'country=STALE',
        dimensionValues: [{ name: 'country', value: 'STALE' }],
        testCaseStatus: TestCaseStatus.Failed,
        timestamp: 1709576999998,
      },
    ],
    paging: { total: 1 },
  };

  it('keeps the newer response when an older, slower response resolves afterwards', async () => {
    let resolveStale: (value: unknown) => void = (_value) => undefined;
    let resolveFresh: (value: unknown) => void = (_value) => undefined;
    untypedFetchMock
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveStale = resolve))
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFresh = resolve))
      );

    render(<DimensionalityTab />);

    // The initial (default-range) request is in flight; leave it pending.
    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(1)
    );

    // Switch the date range — the newer request supersedes the first.
    fireEvent.click(screen.getByTestId('date-picker-menu'));
    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(2)
    );

    // The newer request resolves first and renders its dimension value.
    await act(async () => {
      resolveFresh(FRESH_PAYLOAD);
    });

    expect(
      await screen.findByRole('link', { name: 'FRESH' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'STALE' })
    ).not.toBeInTheDocument();

    // The older, slower request now resolves — it must not clobber the view.
    await act(async () => {
      resolveStale(STALE_PAYLOAD);
    });

    expect(screen.getByRole('link', { name: 'FRESH' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'STALE' })
    ).not.toBeInTheDocument();
  });

  it('keeps valid data when an older, slower response rejects afterwards', async () => {
    let rejectStale: (reason: unknown) => void = (_reason) => undefined;
    let resolveFresh: (value: unknown) => void = (_value) => undefined;
    untypedFetchMock
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectStale = reject;
          })
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFresh = resolve))
      );

    render(<DimensionalityTab />);

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(1)
    );

    fireEvent.click(screen.getByTestId('date-picker-menu'));
    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(2)
    );

    await act(async () => {
      resolveFresh(FRESH_PAYLOAD);
    });

    expect(
      await screen.findByRole('link', { name: 'FRESH' })
    ).toBeInTheDocument();

    // The older request now fails late — its catch branch must not wipe the
    // fresh data, nor flip loading, nor surface an empty state.
    await act(async () => {
      rejectStale(new Error('stale request failed'));
    });

    expect(screen.getByRole('link', { name: 'FRESH' })).toBeInTheDocument();
    expect(screen.queryByTestId('no-data-placeholder')).not.toBeInTheDocument();
  });

  it('ignores a late response after switching the dimension column', async () => {
    let resolveStale: (value: unknown) => void = (_value) => undefined;
    let resolveFresh: (value: unknown) => void = (_value) => undefined;
    untypedFetchMock
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveStale = resolve))
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFresh = resolve))
      );

    render(<DimensionalityTab />);

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(1)
    );

    expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledWith(
      'service.database.schema.table.test',
      expect.objectContaining({ dimensionName: 'country' })
    );

    // Switch the dimension column via the Select — same guard must apply.
    fireEvent.click(screen.getByTestId('dimension-select-trigger'));
    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(2)
    );

    expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenLastCalledWith(
      'service.database.schema.table.test',
      expect.objectContaining({ dimensionName: 'region' })
    );

    await act(async () => {
      resolveFresh(FRESH_PAYLOAD);
    });

    expect(
      await screen.findByRole('link', { name: 'FRESH' })
    ).toBeInTheDocument();

    await act(async () => {
      resolveStale(STALE_PAYLOAD);
    });

    expect(screen.getByRole('link', { name: 'FRESH' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'STALE' })
    ).not.toBeInTheDocument();
  });

  it('still clears data when the current request fails (guard does not suppress the fresh catch)', async () => {
    // The stale guard must only skip superseded responses — the current
    // request's catch branch must still run so a fresh failure surfaces the
    // empty state instead of leaving stale data on screen.
    mockGetTestCaseDimensionResultsByFqn.mockRejectedValueOnce(
      new Error('boom')
    );

    render(<DimensionalityTab />);

    await waitFor(() =>
      expect(mockGetTestCaseDimensionResultsByFqn).toHaveBeenCalledTimes(1)
    );

    expect(
      await screen.findByTestId('no-data-placeholder')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'FRESH' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'STALE' })
    ).not.toBeInTheDocument();
  });
});
