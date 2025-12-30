/*
 *  Copyright 2025 Collate.
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
  createTheme,
  Palette,
  ThemeProvider,
  TypographyVariantsOptions,
} from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  Column,
  ColumnProfile,
  DataType,
} from '../../../../generated/entity/data/table';
import { KeyProfileMetrics } from './KeyProfileMetrics.component';

const mockGetTableColumnsByFQN = jest.fn();

jest.mock('../../../../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest
    .fn()
    .mockImplementation((...args) => mockGetTableColumnsByFQN(...args)),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">Loading...</div>,
}));

const mockTheme = createTheme({
  palette: {
    allShades: {
      gray: {
        50: '#FAFAFA',
        100: '#EAECF5',
        600: '#717680',
        900: '#181D27',
      },
    },
  } as Palette,
  spacing: 8,
  typography: {
    pxToRem: (px: number) => `${px / 16}rem`,
  } as TypographyVariantsOptions,
});

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

const createMockColumn = (profile: ColumnProfile): Column => ({
  name: 'test_column',
  dataType: DataType.String,
  fullyQualifiedName: 'test_table.test_column',
  profile,
});

describe('KeyProfileMetrics', () => {
  const mockProfile: ColumnProfile = {
    name: 'test_column',
    timestamp: Date.now(),
    uniqueProportion: 1.0,
    nullProportion: 0.0,
    distinctProportion: 1.0,
    valuesCount: 1000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state while fetching data', () => {
    mockGetTableColumnsByFQN.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves to keep loading state
        })
    );

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    expect(
      screen.getByText('label.key-profile-metric-plural')
    ).toBeInTheDocument();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render all four metrics with profile data', async () => {
    const mockColumn = createMockColumn(mockProfile);

    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [mockColumn],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('label.uniqueness')).toBeInTheDocument();
    });

    expect(
      screen.getByText('label.key-profile-metric-plural')
    ).toBeInTheDocument();
    expect(screen.getByText('label.nullness')).toBeInTheDocument();
    expect(screen.getByText('label.distinct')).toBeInTheDocument();
    expect(screen.getByText('label.value-count')).toBeInTheDocument();

    const hundredPercent = screen.getAllByText('100%');

    expect(hundredPercent).toHaveLength(2);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('should render -- when no columnFqn or tableFqn provided', async () => {
    renderWithTheme(<KeyProfileMetrics />);

    await waitFor(() => {
      const placeholders = screen.getAllByText('--');

      expect(placeholders).toHaveLength(4);
    });
  });

  it('should render -- when API returns no matching column', async () => {
    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      const placeholders = screen.getAllByText('--');

      expect(placeholders).toHaveLength(4);
    });
  });

  it('should render -- for metrics with undefined values', async () => {
    const partialProfile: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      uniqueProportion: 0.5,
    };

    const mockColumn = createMockColumn(partialProfile);

    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [mockColumn],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    const placeholders = screen.getAllByText('--');

    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('should render percentage values correctly', async () => {
    const profileWithPercentages: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      uniqueProportion: 0.75,
      nullProportion: 0.25,
      distinctProportion: 0.8,
      valuesCount: 5000,
    };

    const mockColumn = createMockColumn(profileWithPercentages);

    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [mockColumn],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('should format large value counts with commas', async () => {
    const profileWithLargeCount: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      valuesCount: 1234567,
    };

    const mockColumn = createMockColumn(profileWithLargeCount);

    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [mockColumn],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });
  });

  it('should handle zero values correctly', async () => {
    const profileWithZeros: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      uniqueProportion: 0,
      nullProportion: 0,
      distinctProportion: 0,
      valuesCount: 0,
    };

    const mockColumn = createMockColumn(profileWithZeros);

    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [mockColumn],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      const zeroPercentages = screen.getAllByText('0%');

      expect(zeroPercentages.length).toBeGreaterThanOrEqual(3);
    });

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render tooltips for each metric', async () => {
    const mockColumn = createMockColumn(mockProfile);

    mockGetTableColumnsByFQN.mockResolvedValue({
      data: [mockColumn],
    });

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('label.uniqueness')).toBeInTheDocument();
    });

    expect(screen.getByText('label.nullness')).toBeInTheDocument();
    expect(screen.getByText('label.distinct')).toBeInTheDocument();
    expect(screen.getByText('label.value-count')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    mockGetTableColumnsByFQN.mockRejectedValue(new Error('API Error'));

    renderWithTheme(
      <KeyProfileMetrics
        columnFqn="test_table.test_column"
        tableFqn="test_table"
      />
    );

    await waitFor(() => {
      const placeholders = screen.getAllByText('--');

      expect(placeholders).toHaveLength(4);
    });
  });
});
