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

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DARK_CHART_THEME, LIGHT_CHART_THEME } from './theme';
import type { ChartOption, ChartTheme } from './types';
import { EChart } from './echart';

const hostProps = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
}));

// jsdom cannot lay out a real chart, so capture what EChart hands the
// echarts-for-react host instead.
vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: Record<string, unknown>) => {
    hostProps.calls.push(props);

    return <div data-testid="echarts-host" />;
  },
}));

const lastHost = () => hostProps.calls[hostProps.calls.length - 1];

const themeSpy = () => {
  const seen: ChartTheme[] = [];
  const option = (theme: ChartTheme): ChartOption => {
    seen.push(theme);

    return { series: [] };
  };

  return { seen, option };
};

beforeEach(() => {
  hostProps.calls.length = 0;
  document.documentElement.classList.remove('dark-mode');
});

afterEach(() => {
  document.documentElement.classList.remove('dark-mode');
});

describe('EChart', () => {
  it('resolves CSS variable colours before ECharts sees them', () => {
    // ECharts cannot parse `var(...)`: hover and animation drop the fill.
    document.documentElement.style.setProperty('--slice', '#17b26a');
    render(
      <EChart
        ariaLabel="Chart"
        option={{ series: [{ type: 'pie', color: 'var(--slice)' }] }}
      />
    );

    expect(
      (lastHost().option as { series: Array<{ color: string }> }).series[0]
        .color
    ).toBe('#17b26a');
    document.documentElement.style.removeProperty('--slice');
  });

  it('builds the option with the light theme by default', () => {
    const { seen, option } = themeSpy();
    render(<EChart ariaLabel="Chart" option={option} />);

    expect(seen[seen.length - 1]).toBe(LIGHT_CHART_THEME);
    expect(screen.getByTestId('echarts-host')).toBeInTheDocument();
  });

  it('uses the dark theme inside a .dark-mode ancestor', () => {
    const { seen, option } = themeSpy();
    render(
      <div className="dark-mode">
        <EChart ariaLabel="Chart" option={option} />
      </div>
    );

    expect(seen[seen.length - 1]).toBe(DARK_CHART_THEME);
  });

  it('switches to the dark theme when <html> gets .dark-mode', async () => {
    const { seen, option } = themeSpy();
    render(<EChart ariaLabel="Chart" option={option} />);

    await act(async () => {
      document.documentElement.classList.add('dark-mode');
      await Promise.resolve();
    });

    expect(seen[seen.length - 1]).toBe(DARK_CHART_THEME);
  });

  it('lets the isDark prop override the detected mode', () => {
    const { seen, option } = themeSpy();
    render(
      <div className="dark-mode">
        <EChart ariaLabel="Chart" isDark={false} option={option} />
      </div>
    );

    expect(seen[seen.length - 1]).toBe(LIGHT_CHART_THEME);
  });

  it('accepts a ready-made option object', () => {
    render(<EChart ariaLabel="Chart" option={{ series: [{ type: 'bar' }] }} />);

    expect(lastHost().option).toMatchObject({ series: [{ type: 'bar' }] });
  });

  it('adds an aria description from ariaLabel when the option has none', () => {
    render(<EChart ariaLabel="Weekly runs" option={{ series: [] }} />);

    expect(lastHost().option).toMatchObject({
      aria: { enabled: true, label: { description: 'Weekly runs' } },
    });
  });

  it('keeps an aria block the option already has', () => {
    const aria = { enabled: true, label: { description: 'Custom' } };
    render(<EChart ariaLabel="Weekly runs" option={{ aria, series: [] }} />);

    expect(lastHost().option).toMatchObject({ aria });
  });

  it('merges updates without dropping the legend selection', () => {
    render(<EChart ariaLabel="Chart" option={{ series: [] }} />);

    expect(lastHost().notMerge).toBe(false);
    expect(lastHost().replaceMerge).toEqual([
      'series',
      'xAxis',
      'yAxis',
      'grid',
      'dataZoom',
      'visualMap',
    ]);
    expect(lastHost().opts).toEqual({ renderer: 'svg' });
  });

  it('passes the modular echarts core and the event handlers through', () => {
    const onClick = vi.fn();
    render(
      <EChart
        ariaLabel="Chart"
        option={{ series: [] }}
        onEvents={{ click: onClick }}
      />
    );

    expect((lastHost().onEvents as Record<string, unknown>).click).toBe(
      onClick
    );
    expect(lastHost().echarts).toHaveProperty('use');
  });

  it('re-applies the zoom window the user picked after a re-render', () => {
    const option: ChartOption = {
      dataZoom: [
        { id: 'zoom-inside', type: 'inside', start: 0, end: 30 },
        { id: 'zoom-slider', type: 'slider', start: 0, end: 30 },
      ],
      series: [],
    };
    const { rerender } = render(<EChart ariaLabel="Chart" option={option} />);
    act(() => {
      (lastHost().onEvents as Record<string, (e: unknown) => void>).datazoom({
        batch: [{ start: 40, end: 70 }],
      });
    });
    rerender(<EChart ariaLabel="Chart" option={{ ...option }} />);

    expect(lastHost().option).toMatchObject({
      dataZoom: [
        { id: 'zoom-inside', start: 40, end: 70 },
        { id: 'zoom-slider', start: 40, end: 70 },
      ],
    });
  });

  it("still calls the caller's own datazoom handler", () => {
    const onZoom = vi.fn();
    render(
      <EChart
        ariaLabel="Chart"
        option={{ series: [] }}
        onEvents={{ datazoom: onZoom }}
      />
    );
    const event = { start: 10, end: 20 };
    (lastHost().onEvents as Record<string, (e: unknown) => void>).datazoom(
      event
    );

    expect(onZoom).toHaveBeenCalledWith(event);
  });

  it('sizes the chart to 300px tall and full width by default', () => {
    render(<EChart ariaLabel="Chart" option={{ series: [] }} />);

    expect(lastHost().style).toEqual({ height: 300, width: '100%' });
  });

  it('uses the given height and width', () => {
    render(
      <EChart
        ariaLabel="Chart"
        height={180}
        option={{ series: [] }}
        width={240}
      />
    );

    expect(lastHost().style).toEqual({ height: 180, width: 240 });
  });

  it('shows a skeleton instead of the chart while loading', () => {
    const { container } = render(
      <EChart loading ariaLabel="Chart" option={{ series: [] }} />
    );

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByTestId('echarts-host')).not.toBeInTheDocument();
  });

  it('shows the default empty message when there is no data', () => {
    render(<EChart isEmpty ariaLabel="Chart" option={{ series: [] }} />);

    expect(screen.getByRole('status')).toHaveTextContent('label.no-data-found');
    expect(screen.queryByTestId('echarts-host')).not.toBeInTheDocument();
  });

  it('shows a custom empty state when given', () => {
    render(
      <EChart
        isEmpty
        ariaLabel="Chart"
        emptyState={<span>Nothing yet</span>}
        option={{ series: [] }}
      />
    );

    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });

  it('puts data-testid and className on the wrapper and renders overlay children', () => {
    render(
      <EChart
        ariaLabel="Chart"
        className="custom"
        data-testid="my-chart"
        option={{ series: [] }}>
        <span>Total 10</span>
      </EChart>
    );

    expect(screen.getByTestId('my-chart')).toHaveClass('custom');
    expect(screen.getByText('Total 10')).toBeInTheDocument();
  });
});
