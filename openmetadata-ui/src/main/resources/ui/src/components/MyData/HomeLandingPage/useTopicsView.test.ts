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
import type { WidgetConfig } from '../../../interface/customization.interface';
import { useTopicsView } from './useTopicsView';

const widget = (i: string, x: number, y: number): WidgetConfig =>
  ({ h: 3, i, w: 1, x, y } as WidgetConfig);

const LAYOUT = [
  widget('a', 0, 0),
  widget('b', 1, 0),
  widget('c', 0, 3),
  widget('d', 1, 3),
];

// The grid renders at a quarter row so a collapsed card can take less than one
// widget row; every height and offset in displayLayout is scaled to match.
const SUBDIVISIONS = 4;
const EXPANDED_H = 3 * SUBDIVISIONS;
const COLLAPSED_H = 3;
const scaled = (w: ReturnType<typeof widget>) => ({
  ...w,
  h: w.h * SUBDIVISIONS,
  y: w.y * SUBDIVISIONS,
});

describe('useTopicsView', () => {
  it('starts expanded, in grid view, with the layout untouched', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    expect(result.current.viewMode).toBe('grid');
    expect(result.current.isEveryWidgetCollapsed).toBe(false);
    expect(result.current.columns).toBe(2);
    expect(result.current.displayLayout).toEqual(LAYOUT.map(scaled));
  });

  // The subdivision must not resize anything: a widget has to occupy exactly
  // the pixels it did before, or every persona layout silently re-flows.
  it('leaves an expanded widget the same pixel height as an unsubdivided row', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    expect(result.current.widgetHeight(EXPANDED_H)).toBeCloseTo(
      3 * (133.33 + 16) - 16,
      1
    );
  });

  it('gives a collapsed card less than one full widget row', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    const collapsed = result.current.widgetHeight(COLLAPSED_H);

    expect(collapsed).toBeCloseTo(96, 0);
    expect(collapsed).toBeLessThan(133.33);
  });

  it('shrinks only the collapsed card to a header-height row', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    act(() => result.current.collapseValue.toggle('b'));

    expect(result.current.collapseValue.isCollapsed('b')).toBe(true);
    expect(result.current.displayLayout).toEqual([
      scaled(widget('a', 0, 0)),
      { ...scaled(widget('b', 1, 0)), h: COLLAPSED_H },
      scaled(widget('c', 0, 3)),
      scaled(widget('d', 1, 3)),
    ]);
  });

  it('toggles a card back open', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    act(() => result.current.collapseValue.toggle('b'));
    act(() => result.current.collapseValue.toggle('b'));

    expect(result.current.collapseValue.isCollapsed('b')).toBe(false);
  });

  it('collapses every card, then expands every card', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    act(() => result.current.toggleAll());

    expect(result.current.isEveryWidgetCollapsed).toBe(true);
    expect(result.current.displayLayout.every((w) => w.h === COLLAPSED_H)).toBe(
      true
    );

    act(() => result.current.toggleAll());

    expect(result.current.isEveryWidgetCollapsed).toBe(false);
    expect(result.current.displayLayout.every((w) => w.h === EXPANDED_H)).toBe(
      true
    );
  });

  it('stacks one full-width column in reading order for list view', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    act(() => result.current.setViewMode('list'));

    expect(result.current.columns).toBe(1);
    expect(
      result.current.displayLayout.map(({ i, x, y, w }) => ({ i, x, y, w }))
    ).toEqual([
      { i: 'a', w: 1, x: 0, y: 0 },
      { i: 'b', w: 1, x: 0, y: 1 },
      { i: 'c', w: 1, x: 0, y: 2 },
      { i: 'd', w: 1, x: 0, y: 3 },
    ]);
  });

  it('keeps collapse applied in list view', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    act(() => result.current.collapseValue.toggle('c'));
    act(() => result.current.setViewMode('list'));

    expect(result.current.displayLayout.find((w) => w.i === 'c')?.h).toBe(
      COLLAPSED_H
    );
  });

  // Collapsing must not read as a layout edit: the persona editor compares the
  // saved layout against what it holds, so mutating it would surface a change
  // the user never made.
  it('never mutates the layout it was given', () => {
    const { result } = renderHook(() => useTopicsView(LAYOUT));

    act(() => result.current.toggleAll());
    act(() => result.current.setViewMode('list'));

    expect(LAYOUT).toEqual([
      widget('a', 0, 0),
      widget('b', 1, 0),
      widget('c', 0, 3),
      widget('d', 1, 3),
    ]);
  });

  it('reports nothing collapsed for an empty layout', () => {
    const { result } = renderHook(() => useTopicsView([]));

    expect(result.current.isEveryWidgetCollapsed).toBe(false);
  });
});
