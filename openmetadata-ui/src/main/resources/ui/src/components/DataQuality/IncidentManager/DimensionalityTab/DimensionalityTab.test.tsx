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

jest.mock('@openmetadata/ui-core-components', () => ({
  Select: Object.assign(
    jest.fn().mockImplementation(() => <div data-testid="dimension-select" />),
    { Item: jest.fn() }
  ),
  Skeleton: jest.fn().mockImplementation(() => <div data-testid="skeleton" />),
  Table: jest.fn(),
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

jest.mock('../../../common/ErrorWithPlaceholder/NoDataPlaceholderNew', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('./DimensionalityHeatmap/DimensionalityHeatmap.component', () =>
  jest.fn().mockImplementation(() => <div data-testid="heatmap" />)
);

describe('DimensionalityTab', () => {
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
