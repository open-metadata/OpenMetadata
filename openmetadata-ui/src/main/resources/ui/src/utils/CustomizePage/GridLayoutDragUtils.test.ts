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
import { Layout, utils } from 'react-grid-layout';
import {
  GRID_ROW_HEIGHT,
  GRID_VERTICAL_MARGIN,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import type { WidgetConfig } from '../../interface/customization.interface';
import {
  getGridRowAt,
  getColumnLockedDragHandlers,
  getLeftPanelHeight,
  placeWidgetBesideLeftPanel,
  placeWidgetInLeftPanel,
} from './GridLayoutDragUtils';

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

describe('getLeftPanelHeight', () => {
  const toPixels = (rows: number) =>
    rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_VERTICAL_MARGIN;

  it('fits the nested grid as react-grid-layout lays it out', () => {
    // Glossary term Overview defaults: stored uncompacted, Tags past the
    // single column. Laid out, they need 8 rows.
    const children: Layout[] = [
      { i: 'description', x: 0, y: 0, w: 1, h: 2 },
      { i: 'synonyms', x: 0, y: 1, w: 0.5, h: 2 },
      { i: 'references', x: 0, y: 2, w: 0.5, h: 2 },
      { i: 'tags', x: 3, y: 2, w: 0.5, h: 2 },
      { i: 'relatedTerms', x: 0, y: 3, w: 1, h: 2 },
    ];
    const nestedGridPixels = toPixels(8) + 2 * GRID_VERTICAL_MARGIN;

    expect(toPixels(getLeftPanelHeight(children))).toBeCloseTo(
      nestedGridPixels
    );
  });

  it('does not mutate the stored children', () => {
    const children: Layout[] = [{ i: 'tags', x: 3, y: 2, w: 0.5, h: 2 }];

    getLeftPanelHeight(children);

    expect(children[0]).toMatchObject({ x: 3, y: 2 });
  });
});

describe('getGridRowAt', () => {
  const rowPitch = GRID_ROW_HEIGHT + GRID_VERTICAL_MARGIN;

  it('returns the row an offset falls in, never above the first', () => {
    expect(getGridRowAt(-10)).toBe(0);
    expect(getGridRowAt(rowPitch - 1)).toBe(0);
    expect(getGridRowAt(rowPitch)).toBe(1);
  });
});

// Lays a nested left-panel grid out the way react-grid-layout renders it.
const layOutPanel = (children: WidgetConfig[] = []) =>
  utils.compact(
    utils.correctBounds(
      children.map((child) => ({ ...child })),
      { cols: 1 }
    ),
    'vertical',
    1
  );

const buildTabLayout = (): WidgetConfig[] => [
  {
    i: DetailPageWidgetKeys.LEFT_PANEL,
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    static: true,
    children: [
      { i: 'description', x: 0, y: 0, w: 1, h: 2 },
      { i: 'synonyms', x: 0, y: 2, w: 0.5, h: 2 },
    ],
  },
  { i: 'domain', x: 6, y: 0, w: 2, h: 2, config: { size: 'small' } },
  { i: 'owner', x: 6, y: 2, w: 2, h: 2 },
];

const getPanelChildren = (layout: WidgetConfig[]) =>
  layOutPanel(
    layout.find(({ i }) => i === DetailPageWidgetKeys.LEFT_PANEL)?.children
  ).map(({ i, x, y, w }) => ({ i, x, y, w }));

describe('placeWidgetInLeftPanel', () => {
  const [, domain] = buildTabLayout();

  it('keeps a side widget square, in the half beside its neighbour', () => {
    const placed = placeWidgetInLeftPanel(
      buildTabLayout(),
      domain,
      2,
      0.5,
      COLS
    );

    expect(placed.map(({ i }) => i)).not.toContain('domain');
    expect(getPanelChildren(placed)).toEqual(
      expect.arrayContaining([
        { i: 'description', x: 0, y: 0, w: 1 },
        { i: 'synonyms', x: 0, y: 2, w: 0.5 },
        { i: 'domain', x: 0.5, y: 2, w: 0.5 },
      ])
    );
  });

  it('pushes the widget already in that half below it', () => {
    const placed = placeWidgetInLeftPanel(buildTabLayout(), domain, 2, 0, COLS);

    expect(getPanelChildren(placed)).toEqual(
      expect.arrayContaining([
        { i: 'domain', x: 0, y: 2, w: 0.5 },
        { i: 'synonyms', x: 0, y: 4, w: 0.5 },
      ])
    );
  });

  it('spans the panel with a widget wider than the side column', () => {
    const placed = placeWidgetInLeftPanel(
      buildTabLayout(),
      { ...domain, w: 3 },
      1,
      0.5,
      COLS
    );

    expect(getPanelChildren(placed)).toEqual(
      expect.arrayContaining([
        { i: 'description', x: 0, y: 0, w: 1 },
        { i: 'domain', x: 0, y: 2, w: 1 },
        { i: 'synonyms', x: 0, y: 4, w: 0.5 },
      ])
    );
  });

  it('lands in the drawn slot when the stored positions were never compacted', () => {
    // Stored as the defaults are: Tags past the single column and every widget
    // a row lower than drawn. Drawn: Synonyms | Tags, then References | (empty).
    const layout = buildTabLayout();
    layout[0].children = [
      { i: 'synonyms', x: 0, y: 1, w: 0.5, h: 2 },
      { i: 'references', x: 0, y: 2, w: 0.5, h: 2 },
      { i: 'tags', x: 3, y: 2, w: 0.5, h: 2 },
    ];

    expect(
      getPanelChildren(placeWidgetInLeftPanel(layout, domain, 2, 0.5, COLS))
    ).toEqual(
      expect.arrayContaining([
        { i: 'synonyms', x: 0, y: 0, w: 0.5 },
        { i: 'tags', x: 0.5, y: 0, w: 0.5 },
        { i: 'references', x: 0, y: 2, w: 0.5 },
        { i: 'domain', x: 0.5, y: 2, w: 0.5 },
      ])
    );
  });

  it('keeps the widget config', () => {
    const placed = placeWidgetInLeftPanel(buildTabLayout(), domain, 2, 0, COLS);

    expect(placed[0].children?.[0]).toMatchObject({
      i: 'domain',
      config: { size: 'small' },
    });
  });
});

describe('placeWidgetBesideLeftPanel', () => {
  it('drops a panel widget into the side column at its row', () => {
    const tabLayout = buildTabLayout();
    const description = tabLayout[0].children?.[0] as WidgetConfig;
    const placed = placeWidgetBesideLeftPanel(tabLayout, description, 2, COLS);
    const panel = placed.find(({ i }) => i === DetailPageWidgetKeys.LEFT_PANEL);

    expect(panel?.children?.map(({ i }) => i)).toEqual(['synonyms']);
    expect(
      utils
        .compact(placed, 'vertical', COLS)
        .filter(({ x }) => x === 6)
        .map(({ i, y, w }) => ({ i, y, w }))
    ).toEqual(
      expect.arrayContaining([
        { i: 'domain', y: 0, w: 2 },
        { i: 'description', y: 2, w: 2 },
        { i: 'owner', y: 4, w: 2 },
      ])
    );
  });

  it('leaves a layout without a left panel unchanged', () => {
    const layout = buildTabLayout().slice(1);

    expect(placeWidgetBesideLeftPanel(layout, layout[0], 0, COLS)).toBe(layout);
  });
});
