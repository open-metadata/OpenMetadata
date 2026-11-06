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
  PieChart,
  type PieChartProps,
} from '@openmetadata/ui-core-components/charts';
import { render, screen } from '@testing-library/react';
import { SummaryDonut } from './SummaryDonut.component';
import { ChartData } from './SummaryPanel.interface';

// App chart exports are mocked globally; use ECharts itself to test hover geometry.
const { init } = jest.requireActual<typeof import('echarts')>('echarts');

const mockPieChart = PieChart as unknown as jest.Mock<null, [PieChartProps]>;
const pieProps = () =>
  mockPieChart.mock.calls[mockPieChart.mock.calls.length - 1]?.[0];

const chartData: ChartData[] = [
  { name: 'success', value: 8, status: 'success' },
  { name: 'failed', value: 2, status: 'failed' },
];

describe('SummaryDonut component', () => {
  it.each([100, 120])(
    'keeps hovered slices inside the %ipx viewport while expanding them',
    (size) => {
      render(
        <SummaryDonut
          ariaLabel="Tests"
          chartData={chartData}
          percentage="80%"
          size={size}
        />
      );

      const { data, innerRadius, outerRadius } = pieProps();
      const chart = init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: size,
        height: size,
      });

      try {
        chart.setOption({
          animation: false,
          series: [
            {
              type: 'pie',
              radius: [innerRadius, outerRadius],
              label: { show: false },
              itemStyle: { borderWidth: 1 },
              data,
            },
          ],
        });

        const slices = chart
          .getZr()
          .storage.getDisplayList()
          .filter((element) => element.type === 'sector');

        expect(slices).toHaveLength(chartData.length);

        slices.forEach((slice, dataIndex) => {
          const restingBounds = slice.getBoundingRect().clone();

          chart.dispatchAction({
            type: 'highlight',
            seriesIndex: 0,
            dataIndex,
          });
          // SSR has no frame loop to apply the hover state.
          chart.getZr().animation.update();

          const hoveredBounds = slice.getBoundingRect();

          expect(hoveredBounds.width).toBeGreaterThan(restingBounds.width);
          expect(hoveredBounds.height).toBeGreaterThan(restingBounds.height);
          expect(hoveredBounds.x).toBeGreaterThanOrEqual(0);
          expect(hoveredBounds.y).toBeGreaterThanOrEqual(0);
          expect(hoveredBounds.x + hoveredBounds.width).toBeLessThanOrEqual(
            size
          );
          expect(hoveredBounds.y + hoveredBounds.height).toBeLessThanOrEqual(
            size
          );

          chart.dispatchAction({ type: 'downplay', seriesIndex: 0, dataIndex });
          chart.getZr().animation.update();
        });
      } finally {
        chart.dispose();
      }
    }
  );

  it('renders a tracked donut sized to `size`', () => {
    render(
      <SummaryDonut ariaLabel="Tests" chartData={chartData} percentage="80%" />
    );

    expect(pieProps()).toEqual(
      expect.objectContaining({
        ariaLabel: 'Tests',
        data: chartData,
        track: true,
        innerRadius: 40.5,
        outerRadius: 54,
        padAngle: 0,
        height: 120,
        legend: { show: false },
      })
    );
  });

  it('renders the centred percentage', () => {
    render(
      <SummaryDonut ariaLabel="Tests" chartData={chartData} percentage="80%" />
    );

    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('renders a numeric percentage', () => {
    render(
      <SummaryDonut ariaLabel="Tests" chartData={chartData} percentage={42} />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('scales the chart and the label with size', () => {
    render(
      <SummaryDonut
        ariaLabel="Tests"
        chartData={chartData}
        percentage="80%"
        size={100}
      />
    );

    expect(pieProps()?.height).toBe(100);
    expect(screen.getByText('80%')).toHaveStyle({ fontSize: '14px' });
  });

  it('passes the padding angle', () => {
    render(
      <SummaryDonut
        ariaLabel="Tests"
        chartData={chartData}
        paddingAngle={2}
        percentage="80%"
      />
    );

    expect(pieProps()?.padAngle).toBe(2);
  });

  it('keeps the track and label when there is no data', () => {
    render(<SummaryDonut ariaLabel="Tests" chartData={[]} percentage="0%" />);

    expect(pieProps()?.data).toEqual([]);
    expect(pieProps()?.track).toBe(true);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
