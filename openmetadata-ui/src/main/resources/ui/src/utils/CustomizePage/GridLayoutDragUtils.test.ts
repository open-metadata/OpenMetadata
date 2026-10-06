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
import { Layout } from 'react-grid-layout';
import { getColumnLockedDragHandlers } from './GridLayoutDragUtils';

const COLS = 8;

// Left panel spans six columns; two side widgets stack in the last two.
const buildLayout = (): Layout[] => [
  { i: 'left', x: 0, y: 0, w: 6, h: 6 },
  { i: 'tags', x: 6, y: 0, w: 2, h: 2 },
  { i: 'owners', x: 6, y: 2, w: 2, h: 2 },
];

const byId = (layout: Layout[], id: string) =>
  layout.find(({ i }) => i === id) as Layout;

describe('getColumnLockedDragHandlers', () => {
  const { onDrag, onDragStop } = getColumnLockedDragHandlers(COLS);

  it('keeps a dropped side widget in its column and re-flows the column', () => {
    const layout = buildLayout();
    const oldItem = { ...byId(layout, 'owners') };
    // RGL moved it to the pointer: column 3, on top of the tags widget.
    const moved = byId(layout, 'owners');
    moved.x = 3;
    moved.y = 0;

    onDragStop(
      layout,
      oldItem,
      { ...moved },
      moved,
      {} as MouseEvent,
      {} as HTMLElement
    );

    expect(byId(layout, 'owners')).toMatchObject({ x: 6, y: 0 });
    expect(byId(layout, 'tags')).toMatchObject({ x: 6, y: 2 });
    expect(byId(layout, 'left')).toMatchObject({ x: 0, y: 0 });
  });

  it('pins the live item and its placeholder while dragging', () => {
    const layout = buildLayout();
    const oldItem = { ...byId(layout, 'tags') };
    const live = byId(layout, 'tags');
    live.x = 2;
    const placeholder = { ...live };

    onDrag(
      layout,
      oldItem,
      live,
      placeholder,
      {} as MouseEvent,
      {} as HTMLElement
    );

    expect(live.x).toBe(6);
    expect(placeholder.x).toBe(6);
  });

  it('leaves vertical-only moves alone', () => {
    const layout = buildLayout();
    const before = JSON.parse(JSON.stringify(layout));
    const oldItem = { ...byId(layout, 'owners') };

    onDragStop(
      layout,
      oldItem,
      byId(layout, 'owners'),
      byId(layout, 'owners'),
      {} as MouseEvent,
      {} as HTMLElement
    );

    expect(layout).toEqual(before);
  });
});
