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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ColumnProfile } from '../../../../generated/entity/data/table';
import { KeyProfileMetrics } from './KeyProfileMetrics.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Tooltip: ({
    children,
    title,
  }: React.PropsWithChildren<{ title?: string }>) => (
    <div title={title}>{children}</div>
  ),
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('../../../../utils/CommonUtils', () => {
  const actual = jest.requireActual('../../../../utils/CommonUtils');

  return {
    ...actual,
    formatNumberWithComma: jest.fn((number: number) => {
      // Use en-US locale to ensure consistent formatting (1,234,567 not 12,34,567)
      return new Intl.NumberFormat('en-US').format(number);
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('KeyProfileMetrics', () => {
  const mockProfile: ColumnProfile = {
    name: 'test_column',
    timestamp: Date.now(),
    uniqueProportion: 1,
    nullProportion: 0,
    distinctProportion: 1,
    valuesCount: 1000,
  };

  it('should render all four metrics with profile data', () => {
    render(<KeyProfileMetrics profile={mockProfile} />);

    expect(
      screen.getByText('label.key-profile-metric-plural')
    ).toBeInTheDocument();
    expect(screen.getByText('label.uniqueness')).toBeInTheDocument();
    expect(screen.getByText('label.nullness')).toBeInTheDocument();
    expect(screen.getByText('label.distinct')).toBeInTheDocument();
    expect(screen.getByText('label.value-count')).toBeInTheDocument();

    const hundredPercent = screen.getAllByText('100%');

    expect(hundredPercent).toHaveLength(2);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('should render -- when no profile is provided', () => {
    render(<KeyProfileMetrics />);

    const placeholders = screen.getAllByText('--');

    expect(placeholders).toHaveLength(4);
  });

  it('should render -- for metrics with undefined values', () => {
    const partialProfile: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      uniqueProportion: 0.5,
    };

    render(<KeyProfileMetrics profile={partialProfile} />);

    expect(screen.getByText('50%')).toBeInTheDocument();

    const placeholders = screen.getAllByText('--');

    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('should render percentage values correctly', () => {
    const profileWithPercentages: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      uniqueProportion: 0.75,
      nullProportion: 0.25,
      distinctProportion: 0.8,
      valuesCount: 5000,
    };

    render(<KeyProfileMetrics profile={profileWithPercentages} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('should format large value counts with commas', () => {
    const profileWithLargeCount: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      valuesCount: 1234567,
    };

    render(<KeyProfileMetrics profile={profileWithLargeCount} />);

    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('should handle zero values correctly', () => {
    const profileWithZeros: ColumnProfile = {
      name: 'test_column',
      timestamp: Date.now(),
      uniqueProportion: 0,
      nullProportion: 0,
      distinctProportion: 0,
      valuesCount: 0,
    };

    render(<KeyProfileMetrics profile={profileWithZeros} />);

    const zeroPercentages = screen.getAllByText('0%');

    expect(zeroPercentages.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render data-testid for each metric', () => {
    render(<KeyProfileMetrics profile={mockProfile} />);

    expect(
      screen.getByTestId('key-profile-metric-label.uniqueness')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('key-profile-metric-label.nullness')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('key-profile-metric-label.distinct')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('key-profile-metric-label.value-count')
    ).toBeInTheDocument();
  });
});
