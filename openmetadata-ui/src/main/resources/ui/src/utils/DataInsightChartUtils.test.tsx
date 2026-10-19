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
import { render, screen } from '@testing-library/react';
import {
  DEFAULT_CHART_OPACITY,
  HOVER_CHART_OPACITY,
} from '../constants/constants';
import {
  dataInsightColor,
  getDataInsightLineSeries,
  getDataInsightTooltip,
} from './DataInsightChartUtils';

const palette = LIGHT_CHART_PALETTE;
const keys = ['table', 'topic', 'dashboard'];

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
