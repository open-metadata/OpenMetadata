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
import ShareBar from './ShareBar';

// The bar itself is the core chart's problem; what this component owns is the
// stacking, the colours and the scale.
const mockBarChart = jest.fn();

jest.mock('@openmetadata/ui-core-components/charts', () => ({
  BarChart: (props: Record<string, unknown>) => {
    mockBarChart(props);

    return <div data-testid="bar-chart" />;
  },
}));

const SEGMENTS = [
  { color: '#17B26A', key: 'passed', name: 'Passed', value: 30 },
  { color: '#F04438', key: 'failed', name: 'Failed', value: 10 },
];

const chartProps = () => mockBarChart.mock.calls.at(-1)?.[0];

describe('ShareBar', () => {
  it('draws nothing when there is nothing to split', () => {
    const { container } = render(
      <ShareBar
        ariaLabel="tests"
        segments={[
          { color: '#17B26A', key: 'passed', name: 'Passed', value: 0 },
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('stacks one series per segment with the given colours', () => {
    render(<ShareBar ariaLabel="tests" segments={SEGMENTS} />);

    const { series, data, layout } = chartProps();

    expect(layout).toBe('horizontal');
    expect(series.map((s: { stack: string }) => s.stack)).toEqual([
      'share',
      'share',
    ]);
    expect(series.map((s: { color: string }) => s.color)).toEqual([
      '#17B26A',
      '#F04438',
    ]);
    // One row, with each segment under the key its series reads.
    expect(data).toHaveLength(1);
    expect(data[0][series[0].key]).toBe(30);
    expect(data[0][series[1].key]).toBe(10);
  });

  it('pins the scale to the sum so the bar ends flush', () => {
    render(<ShareBar ariaLabel="tests" segments={SEGMENTS} />);

    expect(chartProps().yAxis).toMatchObject({ max: 40, min: 0 });
  });

  it('leaves the shortfall as track when given a larger total', () => {
    render(<ShareBar ariaLabel="tests" segments={SEGMENTS} total={100} />);

    expect(chartProps().yAxis).toMatchObject({ max: 100, min: 0 });
  });

  it('labels the bar once, as a whole', () => {
    render(
      <ShareBar
        ariaLabel="40 tests"
        dataTestId="share-bar"
        segments={SEGMENTS}
      />
    );

    // `role="img"` makes the segments presentational, so the legend the caller
    // draws under the bar is not read twice.
    expect(screen.getByTestId('share-bar')).toHaveAttribute('role', 'img');
    expect(screen.getByRole('img', { name: '40 tests' })).toBeInTheDocument();
  });
});
