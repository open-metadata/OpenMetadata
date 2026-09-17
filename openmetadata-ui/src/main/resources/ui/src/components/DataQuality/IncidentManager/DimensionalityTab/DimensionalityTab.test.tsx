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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getTestCaseDimensionResultsByFqn } from '../../../../rest/testAPI';
import DimensionalityTab from './DimensionalityTab';

const mockGetTestCaseDimensionResultsByFqn =
  getTestCaseDimensionResultsByFqn as jest.MockedFunction<
    typeof getTestCaseDimensionResultsByFqn
  >;

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
    Select: Object.assign(
      jest
        .fn()
        .mockImplementation(() => <div data-testid="dimension-select" />),
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

jest.mock('../../../common/ErrorWithPlaceholder/NoDataPlaceholderNew', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('./DimensionalityHeatmap/DimensionalityHeatmap.component', () =>
  jest.fn().mockImplementation(() => <div data-testid="heatmap" />)
);

describe('DimensionalityTab', () => {
  it('preserves the origin when opening dimension details', async () => {
    mockGetTestCaseDimensionResultsByFqn.mockResolvedValueOnce({
      data: [
        {
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
});
