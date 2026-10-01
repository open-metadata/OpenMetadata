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
import type {
  BarSeriesOption,
  ECElementEvent,
  LineSeriesOption,
  PieSeriesOption,
  TooltipComponentOption,
} from 'echarts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AreaChart } from './area-chart';
import { BarChart } from './bar-chart';
import { ComposedChart } from './composed-chart';
import { LineChart } from './line-chart';
import { PieChart } from './pie-chart';
import type { ChartOption } from './types';

const hostProps = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
}));

vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: Record<string, unknown>) => {
    hostProps.calls.push(props);

    return <div data-testid="echarts-host" />;
  },
}));

const lastHost = () => hostProps.calls[hostProps.calls.length - 1];
const hostSeries = () =>
  (lastHost().option as ChartOption).series as Array<
    LineSeriesOption & BarSeriesOption
  >;
const clickHost = (event: Partial<ECElementEvent>) =>
  (lastHost().onEvents as Record<string, (e: ECElementEvent) => void>).click(
    event as ECElementEvent
  );

interface Row {
  day: string;
  passed: number;
  failed: number;
}

const rows: Row[] = [
  { day: 'Mon', passed: 3, failed: 1 },
  { day: 'Tue', passed: 5, failed: 0 },
];

const series = [
  { key: 'passed', name: 'Passed' },
  { key: 'failed', name: 'Failed' },
];

beforeEach(() => {
  hostProps.calls.length = 0;
});

describe('LineChart', () => {
  it('renders line series built from the rows', () => {
    render(
      <LineChart ariaLabel="Runs" data={rows} series={series} xKey="day" />
    );

    expect(hostSeries().map((s) => s.type)).toEqual(['line', 'line']);
    expect(hostSeries()[0].data).toEqual([3, 5]);
  });

  it('shows the empty state instead of a chart when there are no rows', () => {
    render(<LineChart ariaLabel="Runs" data={[]} series={series} xKey="day" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('echarts-host')).not.toBeInTheDocument();
  });

  it('passes loading, height and data-testid through', () => {
    const { container } = render(
      <LineChart
        loading
        ariaLabel="Runs"
        data={rows}
        data-testid="runs-chart"
        height={200}
        series={series}
        xKey="day"
      />
    );

    expect(screen.getByTestId('runs-chart')).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('maps a clicked point back to its row and series key', () => {
    const onPointClick = vi.fn();
    render(
      <LineChart
        ariaLabel="Runs"
        data={rows}
        series={series}
        xKey="day"
        onPointClick={onPointClick}
      />
    );
    const event = { dataIndex: 1, seriesId: 'failed' };
    clickHost(event);

    expect(onPointClick).toHaveBeenCalledWith(rows[1], 'failed', event);
  });

  it('maps a click on a time axis the same way', () => {
    const onPointClick = vi.fn();
    const timed = [
      { ts: 1000, value: 2 },
      { ts: 2000, value: 4 },
    ];
    render(
      <LineChart
        ariaLabel="Runtime"
        data={timed}
        series={[{ key: 'value', name: 'Value' }]}
        xAxis={{ type: 'time' }}
        xKey="ts"
        onPointClick={onPointClick}
      />
    );
    clickHost({ dataIndex: 0, seriesId: 'value' });

    expect(onPointClick).toHaveBeenCalledWith(
      timed[0],
      'value',
      expect.anything()
    );
  });

  it('turns tooltip.render into a bare string formatter', () => {
    render(
      <LineChart
        ariaLabel="Runs"
        data={rows}
        series={series}
        tooltip={{ render: (_items, datum) => <b>{datum?.day}</b> }}
        xKey="day"
      />
    );
    const tooltip = (lastHost().option as ChartOption)
      .tooltip as TooltipComponentOption;
    const formatter = tooltip.formatter as (params: unknown) => string;

    expect(tooltip.padding).toBe(0);
    expect(
      formatter([
        { seriesId: 'passed', seriesName: 'Passed', value: 3, dataIndex: 1 },
      ])
    ).toBe('<b>Tue</b>');
  });

  it('binds no click handler when onPointClick is not given', () => {
    render(
      <LineChart ariaLabel="Runs" data={rows} series={series} xKey="day" />
    );

    expect(
      (lastHost().onEvents as Record<string, unknown>).click
    ).toBeUndefined();
  });
});

describe('point hover', () => {
  const fakeChart = {
    convertToPixel: vi.fn(() => [50, 60]),
    dispatchAction: vi.fn(),
  };
  const fire = (name: string, event: Partial<ECElementEvent>) =>
    (lastHost().onEvents as Record<string, (e: ECElementEvent) => void>)[name](
      event as ECElementEvent
    );

  it('reports the hovered row, series and pixel centre', () => {
    const onPointHover = vi.fn();
    const onPointLeave = vi.fn();
    render(
      <LineChart
        ariaLabel="Runs"
        data={rows}
        series={series}
        xKey="day"
        onPointHover={onPointHover}
        onPointLeave={onPointLeave}
      />
    );
    (lastHost().onChartReady as (c: unknown) => void)(fakeChart);
    fire('mouseover', {
      componentType: 'series',
      seriesId: 'failed',
      dataIndex: 1,
    });
    fire('mouseout', {
      componentType: 'series',
      seriesId: 'failed',
      dataIndex: 1,
    });

    expect(onPointHover).toHaveBeenCalledWith(rows[1], 'failed', {
      x: 50,
      y: 60,
    });
    expect(onPointLeave).toHaveBeenCalledTimes(1);
  });

  it('ignores helper series such as reference lines and bands', () => {
    const onPointHover = vi.fn();
    const onPointLeave = vi.fn();
    render(
      <LineChart
        ariaLabel="Runs"
        data={rows}
        series={series}
        xKey="day"
        onPointHover={onPointHover}
        onPointLeave={onPointLeave}
      />
    );
    (lastHost().onChartReady as (c: unknown) => void)(fakeChart);
    fire('mouseover', {
      componentType: 'series',
      seriesId: '__reference-lines',
      dataIndex: 0,
    });
    fire('mouseover', {
      componentType: 'series',
      seriesId: 'passed__band',
      dataIndex: 0,
    });
    fire('mouseout', {
      componentType: 'series',
      seriesId: 'passed__band',
      dataIndex: 0,
    });

    expect(onPointHover).not.toHaveBeenCalled();
    expect(onPointLeave).not.toHaveBeenCalled();
  });

  it('binds no hover handler when no hover callback is given', () => {
    render(
      <LineChart ariaLabel="Runs" data={rows} series={series} xKey="day" />
    );
    const events = lastHost().onEvents as Record<string, unknown>;

    expect(events.mouseover).toBeUndefined();
    expect(events.mouseout).toBeUndefined();
  });
});

describe('AreaChart', () => {
  it('renders filled line series', () => {
    render(
      <AreaChart ariaLabel="Runs" data={rows} series={series} xKey="day" />
    );

    expect(hostSeries()[0].type).toBe('line');
    expect(hostSeries()[0].areaStyle).toBeDefined();
  });
});

describe('BarChart', () => {
  it('renders bar series', () => {
    render(
      <BarChart ariaLabel="Runs" data={rows} series={series} xKey="day" />
    );

    expect(hostSeries().map((s) => s.type)).toEqual(['bar', 'bar']);
  });

  it('maps a click on a horizontal bar back to its row', () => {
    const onPointClick = vi.fn();
    render(
      <BarChart
        ariaLabel="Runs"
        data={rows}
        layout="horizontal"
        series={series}
        xKey="day"
        onPointClick={onPointClick}
      />
    );
    clickHost({ dataIndex: 0, seriesId: 'passed' });

    expect(onPointClick).toHaveBeenCalledWith(
      rows[0],
      'passed',
      expect.anything()
    );
  });
  it('ignores a click on the axis title', () => {
    const onCategoryClick = vi.fn();
    render(
      <BarChart
        ariaLabel="Runs"
        data={rows}
        layout="horizontal"
        series={series}
        xKey="day"
        onCategoryClick={onCategoryClick}
      />
    );
    clickHost({
      componentType: 'yAxis',
      targetType: 'axisName',
    } as unknown as Partial<ECElementEvent>);

    expect(onCategoryClick).not.toHaveBeenCalled();
  });

  it('reports a category label click, and still maps bar clicks to rows', () => {
    const onCategoryClick = vi.fn();
    const onPointClick = vi.fn();
    render(
      <BarChart
        ariaLabel="Runs"
        data={rows}
        layout="horizontal"
        series={series}
        xKey="day"
        onCategoryClick={onCategoryClick}
        onPointClick={onPointClick}
      />
    );
    clickHost({
      componentType: 'yAxis',
      targetType: 'axisLabel',
      value: 'Tue',
    } as unknown as Partial<ECElementEvent>);
    clickHost({ componentType: 'series', dataIndex: 0, seriesId: 'passed' });

    expect(onCategoryClick).toHaveBeenCalledWith('Tue', expect.anything());
    expect(onPointClick).toHaveBeenCalledWith(
      rows[0],
      'passed',
      expect.anything()
    );
    expect(onPointClick).toHaveBeenCalledTimes(1);
  });
});

describe('ComposedChart', () => {
  it('renders each series with its own type', () => {
    render(
      <ComposedChart
        ariaLabel="Runs"
        data={rows}
        series={[
          { key: 'passed', name: 'Passed', type: 'bar' },
          { key: 'failed', name: 'Failed', type: 'line' },
        ]}
        xKey="day"
      />
    );

    expect(hostSeries().map((s) => s.type)).toEqual(['bar', 'line']);
  });
});

describe('PieChart', () => {
  const slices = [
    { name: 'Success', value: 6 },
    { name: 'Failed', value: 2 },
  ];
  const pie = () =>
    ((lastHost().option as ChartOption).series as PieSeriesOption[])[0];

  it('renders a pie series from the slices', () => {
    render(<PieChart ariaLabel="Status" data={slices} />);

    expect(pie().type).toBe('pie');
    expect((pie().data as Array<{ name: string }>).map((d) => d.name)).toEqual([
      'Success',
      'Failed',
    ]);
  });

  it('renders the centre label over the chart', () => {
    render(
      <PieChart
        ariaLabel="Status"
        centerLabel={<span>8 tests</span>}
        data={slices}
        innerRadius="55%"
      />
    );

    expect(screen.getByText('8 tests')).toBeInTheDocument();
  });

  it('shows a pointer cursor only when slices are clickable', () => {
    const { rerender } = render(<PieChart ariaLabel="Status" data={slices} />);

    expect(pie().cursor).toBe('default');

    rerender(
      <PieChart ariaLabel="Status" data={slices} onSliceClick={vi.fn()} />
    );

    expect(pie().cursor).toBe('pointer');
  });

  it('maps a clicked slice back to its datum', () => {
    const onSliceClick = vi.fn();
    render(
      <PieChart ariaLabel="Status" data={slices} onSliceClick={onSliceClick} />
    );
    clickHost({ dataIndex: 1 });

    expect(onSliceClick).toHaveBeenCalledWith(slices[1], expect.anything());
  });

  it('shows the empty state when every slice is zero', () => {
    render(
      <PieChart
        ariaLabel="Status"
        data={[
          { name: 'Success', value: 0 },
          { name: 'Failed', value: 0 },
        ]}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('echarts-host')).not.toBeInTheDocument();
  });

  it('shows the track ring, not the empty state, when all slices are zero', () => {
    render(
      <PieChart
        track
        ariaLabel="Status"
        centerLabel={<span>0 tests</span>}
        data={[
          { name: 'Success', value: 0 },
          { name: 'Failed', value: 0 },
        ]}
        innerRadius="75%"
      />
    );

    expect(screen.getByTestId('echarts-host')).toBeInTheDocument();
    expect(screen.getByText('0 tests')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('forwards outerRadius, minAngle and padAngle to the option', () => {
    render(
      <PieChart
        ariaLabel="Status"
        data={slices}
        innerRadius="60%"
        minAngle={3}
        outerRadius="80%"
        padAngle={1}
      />
    );

    expect(pie()).toMatchObject({
      radius: ['60%', '80%'],
      minAngle: 3,
      padAngle: 1,
    });
  });
});
