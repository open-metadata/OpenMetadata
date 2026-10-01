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
import Sparkline from './Sparkline';

// The chart itself is the core component's problem; what this component owns
// is the data, the scale and the target it hands over.
const mockAreaChart = jest.fn();

jest.mock('@openmetadata/ui-core-components/charts', () => ({
  AreaChart: (props: Record<string, unknown>) => {
    mockAreaChart(props);

    return <div data-testid="area-chart" />;
  },
}));

const LABEL = 'coverage';

const chartProps = () => mockAreaChart.mock.calls.at(-1)?.[0];

describe('Sparkline', () => {
  it('draws nothing from a single point', () => {
    const { container } = render(
      <Sparkline ariaLabel={LABEL} series={[12]} tone="brand" />
    );

    // One value is a value, not a trend.
    expect(container).toBeEmptyDOMElement();
    expect(mockAreaChart).not.toHaveBeenCalled();
  });

  it('plots one point per value, in order', () => {
    render(<Sparkline ariaLabel={LABEL} series={[10, 20, 30]} tone="brand" />);

    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(chartProps().data).toEqual([
      { index: 0, value: 10 },
      { index: 1, value: 20 },
      { index: 2, value: 30 },
    ]);
    expect(chartProps().xKey).toBe('index');
    expect(chartProps().series[0].key).toBe('value');
  });

  it('spans the full width rather than insetting the end points', () => {
    render(
      <Sparkline ariaLabel={LABEL} series={[1, 2, 3, 4, 5]} tone="brand" />
    );

    expect(chartProps().xAxis.boundaryGap).toBe(false);
  });

  it('keeps a target inside the scale when it sits above every value', () => {
    render(
      <Sparkline
        ariaLabel={LABEL}
        series={[10, 12]}
        target={90}
        tone="warning"
      />
    );

    const { referenceLines, yAxis } = chartProps();

    expect(referenceLines).toEqual([{ axis: 'y', value: 90 }]);
    // Drawn inside the box rather than clipped off the top.
    expect(yAxis.max).toBeGreaterThan(90);
    expect(yAxis.min).toBeLessThan(10);
  });

  it('omits the reference line when no target is given', () => {
    render(<Sparkline ariaLabel={LABEL} series={[1, 2]} tone="brand" />);

    expect(chartProps().referenceLines).toBeUndefined();
  });

  it('gives a flat series a range to sit in', () => {
    render(<Sparkline ariaLabel={LABEL} series={[5, 5, 5]} tone="brand" />);

    const { yAxis } = chartProps();

    expect(yAxis.min).toBeLessThan(5);
    expect(yAxis.max).toBeGreaterThan(5);
  });

  it('colours the series by tone', () => {
    const { rerender } = render(
      <Sparkline ariaLabel={LABEL} series={[1, 2]} tone="brand" />
    );
    const brand = chartProps().series[0].color;

    rerender(<Sparkline ariaLabel={LABEL} series={[1, 2]} tone="error" />);

    expect(chartProps().series[0].color).not.toBe(brand);
  });
});
