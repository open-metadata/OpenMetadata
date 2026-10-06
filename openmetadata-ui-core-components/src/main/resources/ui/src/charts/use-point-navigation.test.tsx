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

import { act, renderHook } from '@testing-library/react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { navigablePoints, usePointNavigation } from './use-point-navigation';

interface Row {
  t: number;
  v: number | null;
}

const rows: Row[] = [
  { t: 1, v: 5 },
  { t: 2, v: null },
  { t: 3, v: 7 },
];
const series = [{ key: 'v', name: 'V' }];

const key = (name: string) =>
  ({
    key: name,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLDivElement>);
const focusEvent = (focusVisible: boolean) =>
  ({
    currentTarget: { matches: () => focusVisible },
  } as unknown as FocusEvent<HTMLDivElement>);
const keyboardFocus = focusEvent(true);
const mouseFocus = focusEvent(false);
const modified = (name: string, mods: Record<string, boolean>) =>
  ({
    key: name,
    ...mods,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLDivElement>);

const setup = (enabled = true) => {
  const chart = {
    convertToPixel: vi.fn((_f: unknown, [x, y]: number[]) => [
      Number(x) * 10,
      Number(y),
    ]),
    dispatchAction: vi.fn(),
  };
  const onPointHover = vi.fn();
  const onPointLeave = vi.fn();
  const onPointClick = vi.fn();
  const hook = renderHook(() =>
    usePointNavigation<Row>({
      data: rows,
      series,
      xKey: 't',
      isTime: true,
      horizontal: false,
      enabled,
      getChart: () => chart,
      onPointHover,
      onPointLeave,
      onPointClick,
      pointAriaLabel: (datum, seriesKey) => `${seriesKey}=${datum.v}`,
    })
  );
  const props = () => hook.result.current.containerProps;

  return { chart, onPointHover, onPointLeave, onPointClick, hook, props };
};

describe('navigablePoints', () => {
  it('skips rows without a value', () => {
    expect(navigablePoints(rows, series)).toEqual([
      { index: 0, seriesKey: 'v' },
      { index: 2, seriesKey: 'v' },
    ]);
  });

  it('never takes a band series as the row point', () => {
    const withBand = [
      { key: 'range', name: 'Range', type: 'band' as const },
      ...series,
    ];

    expect(
      navigablePoints([{ t: 1, v: 5, range: 3 }], withBand).map(
        (p) => p.seriesKey
      )
    ).toEqual(['v']);
  });
});

describe('usePointNavigation', () => {
  it('reports and highlights the last point on focus', () => {
    const { chart, onPointHover, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));

    expect(onPointHover).toHaveBeenCalledWith(rows[2], 'v', { x: 30, y: 7 });
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: 'highlight',
      seriesId: 'v',
      dataIndex: 2,
    });
  });

  it('moves with the arrow keys, Home and End, stopping at the ends', () => {
    const { onPointHover, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));
    act(() => props().onKeyDown?.(key('ArrowLeft')));
    expect(onPointHover).toHaveBeenLastCalledWith(rows[0], 'v', {
      x: 10,
      y: 5,
    });
    onPointHover.mockClear();
    act(() => props().onKeyDown?.(key('ArrowLeft')));
    expect(onPointHover).toHaveBeenLastCalledWith(rows[0], 'v', {
      x: 10,
      y: 5,
    });
    act(() => props().onKeyDown?.(key('End')));
    expect(onPointHover).toHaveBeenLastCalledWith(rows[2], 'v', {
      x: 30,
      y: 7,
    });
    act(() => props().onKeyDown?.(key('Home')));
    expect(onPointHover).toHaveBeenLastCalledWith(rows[0], 'v', {
      x: 10,
      y: 5,
    });
  });

  it('downplays the previous point before highlighting the next', () => {
    const { chart, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));
    chart.dispatchAction.mockClear();
    act(() => props().onKeyDown?.(key('ArrowLeft')));

    expect(chart.dispatchAction.mock.calls.map(([a]) => a)).toEqual([
      { type: 'downplay', seriesId: 'v' },
      { type: 'highlight', seriesId: 'v', dataIndex: 0 },
    ]);
  });

  it('selects the point with Enter and Space', () => {
    const { onPointClick, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));
    act(() => props().onKeyDown?.(key('ArrowLeft')));
    act(() => props().onKeyDown?.(key('Enter')));
    const space = key(' ');
    act(() => props().onKeyDown?.(space));

    expect(onPointClick).toHaveBeenNthCalledWith(1, rows[0], 'v');
    expect(onPointClick).toHaveBeenNthCalledWith(2, rows[0], 'v');
    expect(space.preventDefault).toHaveBeenCalled();
  });

  it('leaves on Escape and on blur', () => {
    const { chart, onPointLeave, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));
    act(() => props().onKeyDown?.(key('Escape')));
    expect(onPointLeave).toHaveBeenCalledTimes(1);
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: 'downplay',
      seriesId: 'v',
    });
    act(() => props().onFocus?.(keyboardFocus));
    chart.dispatchAction.mockClear();
    act(() => props().onBlur?.(focusEvent));

    expect(onPointLeave).toHaveBeenCalledTimes(2);
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: 'downplay',
      seriesId: 'v',
    });
  });

  it('does not start on mouse focus, but on the first arrow key', () => {
    const { chart, onPointHover, hook, props } = setup();
    act(() => props().onFocus?.(mouseFocus));

    expect(onPointHover).not.toHaveBeenCalled();
    expect(chart.dispatchAction).not.toHaveBeenCalled();
    expect(hook.result.current.announcement).toBe('');
    act(() => props().onKeyDown?.(key('ArrowLeft')));

    expect(onPointHover).toHaveBeenCalledWith(rows[2], 'v', { x: 30, y: 7 });
  });

  it('does not start when :focus-visible is unsupported', () => {
    const { onPointHover, props } = setup();
    const throwing = {
      currentTarget: {
        matches: () => {
          throw new SyntaxError('unsupported selector');
        },
      },
    } as unknown as FocusEvent<HTMLDivElement>;
    act(() => props().onFocus?.(throwing));

    expect(onPointHover).not.toHaveBeenCalled();
  });

  it('leaves modified keys to the browser', () => {
    const { chart, onPointHover, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));
    onPointHover.mockClear();
    chart.dispatchAction.mockClear();
    const events = [
      modified('ArrowLeft', { altKey: true }),
      modified('Home', { metaKey: true }),
      modified('End', { ctrlKey: true }),
    ];
    events.forEach((event) => act(() => props().onKeyDown?.(event)));

    expect(onPointHover).not.toHaveBeenCalled();
    expect(chart.dispatchAction).not.toHaveBeenCalled();
    events.forEach((event) =>
      expect(event.preventDefault).not.toHaveBeenCalled()
    );
  });

  it('ignores Escape and blur while no point is active', () => {
    const { chart, onPointLeave, props } = setup();
    const escape = key('Escape');
    act(() => props().onKeyDown?.(escape));
    act(() => props().onBlur?.(mouseFocus));

    expect(escape.preventDefault).not.toHaveBeenCalled();
    expect(onPointLeave).not.toHaveBeenCalled();
    expect(chart.dispatchAction).not.toHaveBeenCalled();
  });

  it('leaves Enter and Space to the browser while no point is active', () => {
    const { onPointClick, props } = setup();
    act(() => props().onFocus?.(mouseFocus));
    const enter = key('Enter');
    const space = key(' ');
    act(() => props().onKeyDown?.(enter));
    act(() => props().onKeyDown?.(space));

    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(space.preventDefault).not.toHaveBeenCalled();
    expect(onPointClick).not.toHaveBeenCalled();
  });

  it('is inactive again after Escape', () => {
    const { onPointLeave, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));
    act(() => props().onKeyDown?.(key('Escape')));
    act(() => props().onBlur?.(mouseFocus));

    expect(onPointLeave).toHaveBeenCalledTimes(1);
  });

  it('announces the active point', () => {
    const { hook, props } = setup();
    act(() => props().onFocus?.(keyboardFocus));

    expect(hook.result.current.announcement).toBe('v=7');
  });

  it('adds nothing when disabled', () => {
    const { hook } = setup(false);

    expect(hook.result.current.containerProps).toEqual({});
  });
});
