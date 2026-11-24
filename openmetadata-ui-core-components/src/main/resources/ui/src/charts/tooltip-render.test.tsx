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

import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import { describe, expect, it } from 'vitest';
import { REFERENCE_SERIES_ID } from './options/cartesian';
import { PIE_TRACK_SERIES_ID } from './options/pie';
import { toTooltipItems, withTooltipRender } from './tooltip-render';

const axisParams = [
  {
    seriesId: 'passed',
    seriesName: 'Passed',
    value: 3,
    color: '#111111',
    dataIndex: 1,
  },
  {
    seriesId: 'failed',
    seriesName: 'Failed',
    value: [1700000000000, 2],
    color: '#222222',
    dataIndex: 1,
  },
  {
    seriesId: REFERENCE_SERIES_ID,
    seriesName: '',
    value: null,
    color: '',
    dataIndex: 1,
  },
] as unknown as TooltipComponentFormatterCallbackParams;

describe('toTooltipItems', () => {
  it('maps axis params to items and skips the reference-line series', () => {
    expect(toTooltipItems(axisParams)).toEqual([
      {
        seriesKey: 'passed',
        name: 'Passed',
        value: 3,
        color: '#111111',
        dataIndex: 1,
      },
      // Time-axis points are [x, y]; the value is the y.
      {
        seriesKey: 'failed',
        name: 'Failed',
        value: 2,
        color: '#222222',
        dataIndex: 1,
      },
    ]);
  });

  it('skips the helper series of a range band', () => {
    const params = [
      { seriesId: 'range__band-base', seriesName: 'Range', value: 2 },
      { seriesId: 'range__band', seriesName: 'Range', value: 4 },
      {
        seriesId: 'value',
        seriesName: 'Value',
        value: 4,
        color: '#333333',
        dataIndex: 0,
      },
    ] as unknown as TooltipComponentFormatterCallbackParams;

    expect(toTooltipItems(params).map((item) => item.seriesKey)).toEqual([
      'value',
    ]);
  });

  it('keys a pie slice by its name and skips the track ring', () => {
    const slice = {
      componentSubType: 'pie',
      seriesId: 'x',
      seriesName: 'series0',
      name: 'Success',
      value: 6,
      color: '#00a000',
      dataIndex: 0,
    } as unknown as TooltipComponentFormatterCallbackParams;
    const track = {
      componentSubType: 'pie',
      seriesId: PIE_TRACK_SERIES_ID,
      name: '',
      value: 1,
      dataIndex: 0,
    } as unknown as TooltipComponentFormatterCallbackParams;

    expect(toTooltipItems(slice)).toEqual([
      {
        seriesKey: 'Success',
        name: 'Success',
        value: 6,
        color: '#00a000',
        dataIndex: 0,
      },
    ]);
    expect(toTooltipItems(track)).toEqual([]);
  });

  it('turns a non-numeric, non-string value into null and a gradient colour into ""', () => {
    const param = {
      seriesId: 'a',
      seriesName: 'A',
      value: undefined,
      color: { type: 'linear' },
      dataIndex: 0,
    } as unknown as TooltipComponentFormatterCallbackParams;

    expect(toTooltipItems(param)[0]).toMatchObject({ value: null, color: '' });
  });
});

describe('withTooltipRender', () => {
  const rows = [{ day: 'Mon' }, { day: 'Tue' }];

  it('returns the tooltip unchanged when there is no render', () => {
    const tooltip = { show: true };

    expect(withTooltipRender(tooltip, rows)).toBe(tooltip);
    expect(withTooltipRender(undefined, rows)).toBeUndefined();
  });

  it('renders the content for the hovered row as static HTML, bare', () => {
    const tooltip = withTooltipRender(
      {
        render: (items, datum) => (
          <p>
            {`${datum?.day}: ${items
              .map((item) => `${item.name}=${item.value}`)
              .join(', ')}`}
          </p>
        ),
      },
      rows
    );

    expect(tooltip?.bare).toBe(true);
    expect(tooltip?.formatter?.(axisParams)).toBe(
      '<p>Tue: Passed=3, Failed=2</p>'
    );
  });

  it('renders nothing when no item is left or render returns null', () => {
    const empty = withTooltipRender({ render: () => <p>x</p> }, rows);
    const none = withTooltipRender({ render: () => null }, rows);
    const onlyReference = [
      (axisParams as unknown[])[2],
    ] as unknown as TooltipComponentFormatterCallbackParams;

    expect(empty?.formatter?.(onlyReference)).toBe('');
    expect(none?.formatter?.(axisParams)).toBe('');
  });
});
