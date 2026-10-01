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

import { LIGHT_CHART_PALETTE } from '@openmetadata/ui-core-components/charts';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  DEFAULT_CHART_OPACITY,
  HOVER_CHART_OPACITY,
} from '../constants/constants';
import {
  CustomTooltip,
  dataInsightColor,
  getDataInsightLineSeries,
  getDataInsightTooltip,
  renderLegend,
} from './DataInsightChartUtils';

const palette = LIGHT_CHART_PALETTE;
const keys = ['table', 'topic', 'dashboard'];

describe('renderLegend', () => {
  it('renders one swatch per entry and greys out inactive ones', () => {
    const onClick = jest.fn();
    render(
      renderLegend(
        {
          payload: [
            { value: 'table', color: '#111111' },
            { value: 'topic', color: '#222222' },
          ],
          onClick,
        },
        ['table'],
        undefined,
        '#959595'
      )
    );

    const swatches = document.querySelectorAll('svg rect');

    expect(swatches[0]).toHaveAttribute('fill', '#111111');
    expect(swatches[1]).toHaveAttribute('fill', '#959595');

    fireEvent.click(screen.getByText('topic'));

    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'topic' }),
      1,
      expect.anything()
    );
  });

  it('applies the active theme muted color to inactive legends', () => {
    render(
      renderLegend(
        { payload: [{ color: '#abcdef', value: 'Table' }] },
        ['Dashboard'],
        undefined,
        '#345678'
      )
    );

    expect(screen.getByText('Table')).toHaveStyle({ color: '#345678' });
  });
});

describe('CustomTooltip', () => {
  it('uses the semantic text color for tooltip titles', () => {
    render(
      <CustomTooltip
        active
        payload={[
          {
            color: '#abcdef',
            dataKey: 'count',
            name: 'Description coverage',
            payload: { term: 'Sep 1, 2026' },
            value: 76.27,
          },
        ]}
        timeStampKey="term"
      />
    );

    expect(screen.getByRole('heading', { name: 'Sep 1, 2026' })).toHaveClass(
      'custom-data-insight-tooltip-title'
    );
  });

  it('renders a row per series from a structural payload', () => {
    render(
      <CustomTooltip
        active
        payload={[
          {
            dataKey: 'table',
            name: 'table',
            value: 4,
            color: '#111111',
            payload: { timestampValue: 1696118400000 },
          },
        ]}
      />
    );

    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(document.querySelector('svg rect')).toHaveAttribute(
      'fill',
      '#111111'
    );
  });
});

describe('getDataInsightLineSeries', () => {
  it('gives every key its palette colour by rank', () => {
    expect(
      getDataInsightLineSeries({ keys, palette }).map((s) => [s.key, s.color])
    ).toEqual([
      ['table', '#100000'],
      ['topic', '#200000'],
      ['dashboard', '#300000'],
    ]);
  });

  it('shows only toggled keys, plus the hovered one, without moving colours', () => {
    const series = getDataInsightLineSeries({
      keys,
      palette,
      activeKeys: ['dashboard'],
      hoverKey: 'topic',
    });

    expect(series.map((s) => [s.key, s.color])).toEqual([
      ['topic', '#200000'],
      ['dashboard', '#300000'],
    ]);
  });

  it('dims every key but the hovered one', () => {
    const series = getDataInsightLineSeries({
      keys,
      palette,
      hoverKey: 'topic',
    });

    expect(series.map((s) => s.seriesOption)).toEqual([
      { lineStyle: { opacity: HOVER_CHART_OPACITY } },
      { lineStyle: { opacity: DEFAULT_CHART_OPACITY } },
      { lineStyle: { opacity: HOVER_CHART_OPACITY } },
    ]);
  });

  it('drops keys a search hid and keeps the colours of the rest', () => {
    const series = getDataInsightLineSeries({
      keys,
      palette,
      visibleKeys: ['dashboard'],
    });

    expect(series.map((s) => [s.key, s.color])).toEqual([
      ['dashboard', '#300000'],
    ]);
  });
});

describe('dataInsightColor', () => {
  it('matches the colour the line gets', () => {
    expect(dataInsightColor(palette, keys, 'dashboard')).toBe('#300000');
  });
});

describe('getDataInsightTooltip', () => {
  it('renders a date header and one row per value, percent when asked', () => {
    const { render: renderTooltip } = getDataInsightTooltip<{
      day: number;
    }>({ timeKey: 'day', isPercentage: true });

    render(
      <>
        {renderTooltip?.(
          [
            {
              seriesKey: 'table',
              name: 'table',
              value: 40.123,
              color: '#100000',
              dataIndex: 0,
            },
            {
              seriesKey: 'topic',
              name: 'topic',
              value: null,
              color: '#200000',
              dataIndex: 0,
            },
          ],
          { day: 1696118400000 }
        )}
      </>
    );

    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.queryByText('Topic')).not.toBeInTheDocument();
    expect(screen.getByText(/40\.12\s?%/)).toBeInTheDocument();
  });
});
