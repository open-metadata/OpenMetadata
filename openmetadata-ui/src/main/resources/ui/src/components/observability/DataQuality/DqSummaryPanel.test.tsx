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

import { render, screen } from '@testing-library/react';
import DqSummaryPanel from './DqSummaryPanel';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, className, align, gap, direction, justify }: any) => (
    <div
      className={className}
      data-align={align}
      data-direction={direction}
      data-gap={gap}
      data-justify={justify}
      data-testid="box">
      {children}
    </div>
  ),
  Typography: ({ children, size, weight, className }: any) => (
    <span
      className={className}
      data-size={size}
      data-testid="typography"
      data-weight={weight}>
      {children}
    </span>
  ),
  Skeleton: ({ height, width }: any) => (
    <div data-height={height} data-testid="skeleton" data-width={width} />
  ),
}));

jest.mock(
  'components/DataQuality/SummaryPannel/SummaryDonut.component',
  () => ({
    SummaryDonut: ({ percentage }: any) => (
      <div data-percentage={percentage} data-testid="summary-donut" />
    ),
  })
);

jest.mock(
  'components/DataQuality/SummaryPannel/SummaryPanel.interface',
  () => ({
    TestSummaryCardKey: {
      TotalTests: 'total-tests',
      Healthy: 'healthy',
      Coverage: 'coverage',
    },
    TestSummarySegmentId: {
      Success: 'success',
      Aborted: 'aborted',
      Failed: 'failed',
      Healthy: 'healthy',
      Unhealthy: 'unhealthy',
      Covered: 'covered',
      Uncovered: 'uncovered',
    },
  })
);

const mockCards = [
  {
    key: 'total-tests',
    title: 'label.total-entity',
    value: 100,
    percentage: '80%',
    segments: [
      { id: 'success', name: 'label.success', value: 80 },
      { id: 'aborted', name: 'label.aborted', value: 5 },
      { id: 'failed', name: 'label.failed', value: 15 },
    ],
  },
  {
    key: 'healthy',
    title: 'label.healthy-data-asset-plural',
    value: 40,
    percentage: '80%',
    segments: [
      { id: 'healthy', name: 'label.healthy', value: 40 },
      { id: 'unhealthy', name: 'label.unhealthy', value: 10 },
    ],
  },
  {
    key: 'coverage',
    title: 'label.data-asset-plural-coverage',
    value: 50,
    percentage: '25%',
    segments: [
      { id: 'covered', name: 'label.covered', value: 50 },
      { id: 'uncovered', name: 'label.uncovered', value: 150 },
    ],
  },
];

jest.mock('components/DataQuality/SummaryPannel/useTestSummaryCards', () => ({
  useTestSummaryCards: () => mockCards,
}));

jest.mock('constants/Color.constants', () => ({
  GREY_200: '#eaecf0',
}));

jest.mock('utils/NumberUtils', () => ({
  formatNumberWithComma: (value: number) => value.toString(),
}));

const sampleSummary = {
  total: 100,
  success: 80,
  failed: 15,
  aborted: 5,
  healthy: 40,
  totalDQEntities: 50,
  totalEntityCount: 200,
};

describe('DqSummaryPanel', () => {
  it('should render a card per item returned by the shared hook', () => {
    render(<DqSummaryPanel testSummary={sampleSummary as any} />);

    expect(screen.getByText('label.total-entity')).toBeInTheDocument();
    expect(
      screen.getByText('label.healthy-data-asset-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('label.data-asset-plural-coverage')
    ).toBeInTheDocument();
  });

  it('should render the primary value of each card', () => {
    render(<DqSummaryPanel testSummary={sampleSummary as any} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should render three summary donuts', () => {
    render(<DqSummaryPanel testSummary={sampleSummary as any} />);

    expect(screen.getAllByTestId('summary-donut')).toHaveLength(3);
  });

  it('should render the legend only on the Total Tests card', () => {
    render(<DqSummaryPanel testSummary={sampleSummary as any} />);

    expect(screen.getByText('label.success')).toBeInTheDocument();
    expect(screen.getByText('label.aborted')).toBeInTheDocument();
    expect(screen.getByText('label.failed')).toBeInTheDocument();
    expect(screen.queryByText('label.healthy')).not.toBeInTheDocument();
    expect(screen.queryByText('label.covered')).not.toBeInTheDocument();
  });

  it('should render loading skeletons when isLoading is true', () => {
    render(<DqSummaryPanel isLoading testSummary={sampleSummary as any} />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
    expect(screen.queryByTestId('summary-donut')).not.toBeInTheDocument();
  });

  it('should pass the card percentage to the donut', () => {
    render(<DqSummaryPanel testSummary={sampleSummary as any} />);

    const donuts = screen.getAllByTestId('summary-donut');

    expect(donuts[0]).toHaveAttribute('data-percentage', '80%');
    expect(donuts[1]).toHaveAttribute('data-percentage', '80%');
    expect(donuts[2]).toHaveAttribute('data-percentage', '25%');
  });
});
