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
import { MutableRefObject } from 'react';
import { Layout } from 'react-grid-layout';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import type { WidgetConfig } from '../../interface/customization.interface';
import { useLeftPanelCrossDrop } from './useLeftPanelCrossDrop';

// The panel spans the tab grid's first six columns, 600px wide and 500px tall.
const PANEL_BOX = {
  left: 0,
  right: 600,
  top: 0,
  bottom: 500,
  width: 600,
} as DOMRect;

const description: WidgetConfig = { i: 'description', x: 0, y: 0, w: 1, h: 2 };
const domain: WidgetConfig = { i: 'domain', x: 6, y: 0, w: 2, h: 2 };
const leftPanelWidget: WidgetConfig = {
  i: DetailPageWidgetKeys.LEFT_PANEL,
  x: 0,
  y: 0,
  w: 6,
  h: 4,
  static: true,
  children: [description],
};
const tabLayout = [leftPanelWidget, domain];

const pointerAt = (clientX: number, clientY: number) =>
  ({ clientX, clientY } as MouseEvent);

const renderCrossDrop = (panel = leftPanelWidget) => {
  const onLastPanelWidgetKept = jest.fn();
  const { result } = renderHook(() =>
    useLeftPanelCrossDrop({
      leftPanelWidget: panel,
      tabLayout: [panel, domain],
      onLastPanelWidgetKept,
    })
  );
  (result.current.panelRef as MutableRefObject<HTMLDivElement>).current = {
    getBoundingClientRect: () => PANEL_BOX,
  } as HTMLDivElement;

  return { result, onLastPanelWidgetKept };
};

const tabGridLayout = (): Layout[] =>
  tabLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

describe('useLeftPanelCrossDrop', () => {
  it('moves a side widget dropped over the panel into it, at the drop point', () => {
    const { result } = renderCrossDrop();
    const layout = tabGridLayout();
    const dragged = { ...layout[1], x: 3 };

    act(() =>
      result.current.handleTabDragStop(
        layout,
        domain,
        dragged,
        dragged,
        // Right half, in the panel grid's third row (one margin of padding).
        pointerAt(450, 16 + 2 * 116 + 10),
        {} as HTMLElement
      )
    );

    expect(layout.map(({ i }) => i)).toEqual([DetailPageWidgetKeys.LEFT_PANEL]);
    expect(result.current.takeDrop()).toEqual({
      kind: 'in',
      widget: domain,
      row: 2,
      x: 0.5,
      w: 0.5,
    });
    // Taken once, so a later layout change cannot apply it again.
    expect(result.current.takeDrop()).toBeNull();
  });

  it('keeps a side widget dropped outside the panel in its column', () => {
    const { result } = renderCrossDrop();
    const layout = tabGridLayout();
    const dragged = layout[1];
    dragged.x = 3;

    act(() =>
      result.current.handleTabDragStop(
        layout,
        domain,
        dragged,
        dragged,
        pointerAt(450, 700),
        {} as HTMLElement
      )
    );

    expect(layout.find(({ i }) => i === 'domain')).toMatchObject({ x: 6 });
    expect(result.current.takeDrop()).toBeNull();
  });

  it('moves a panel widget dropped right of the panel beside it, at its row', () => {
    const owner: WidgetConfig = { i: 'owner', x: 0, y: 2, w: 0.5, h: 2 };
    const { result } = renderCrossDrop({
      ...leftPanelWidget,
      children: [description, owner],
    });
    const layout: Layout[] = [description, owner];

    act(() =>
      result.current.handlePanelDragStop(
        layout,
        owner,
        owner,
        owner,
        pointerAt(700, 2 * 116 + 10),
        {} as HTMLElement
      )
    );

    expect(layout.map(({ i }) => i)).toEqual(['description']);
    expect(result.current.takeDrop()).toEqual({
      kind: 'out',
      widget: owner,
      row: 2,
    });
  });

  it("keeps the panel's only widget in it and says why", () => {
    const { result, onLastPanelWidgetKept } = renderCrossDrop();
    const layout: Layout[] = [description];

    act(() =>
      result.current.handlePanelDragStop(
        layout,
        description,
        description,
        description,
        pointerAt(700, 10),
        {} as HTMLElement
      )
    );

    expect(layout).toEqual([description]);
    expect(onLastPanelWidgetKept).toHaveBeenCalledTimes(1);
    expect(result.current.takeDrop()).toBeNull();
  });

  it('shows where a drag will drop while it is dragged', () => {
    const { result } = renderCrossDrop();
    const layout = tabGridLayout();
    const dragged = layout[1];

    act(() =>
      result.current.handleTabDrag(
        layout,
        domain,
        dragged,
        dragged,
        pointerAt(300, 100),
        {} as HTMLElement
      )
    );

    expect(result.current.dropTarget).toBe('panel');

    act(() =>
      result.current.handlePanelDrag(
        [description],
        description,
        description,
        description,
        pointerAt(700, 100),
        {} as HTMLElement
      )
    );

    expect(result.current.dropTarget).toBe('beside');
  });
});
