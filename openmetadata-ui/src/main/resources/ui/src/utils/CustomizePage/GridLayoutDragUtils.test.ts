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
  FULL_PANEL_WIDTH,
  getColumnLockedDragHandlers,
  getGridRowAt,
  getLeftPanelFlowLayout,
  getLeftPanelHeight,
  HALF_PANEL_WIDTH,
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

// Glossary term Overview defaults: stored uncompacted, Tags past the column.
const buildGlossaryTermChildren = (): Layout[] => [
  { i: 'description', x: 0, y: 0, w: 1, h: 2 },
  { i: 'synonyms', x: 0, y: 1, w: 0.5, h: 2 },
  { i: 'references', x: 0, y: 2, w: 0.5, h: 2 },
  { i: 'tags', x: 3, y: 2, w: 0.5, h: 2 },
  { i: 'relatedTerms', x: 0, y: 3, w: 1, h: 2 },
];

const toPositions = (children: Layout[] = []) =>
  children.map(({ i, x, y, w }) => ({ i, x, y, w }));

describe('getLeftPanelFlowLayout', () => {
  it('lays stored widgets out the way view mode draws them', () => {
    expect(
      toPositions(getLeftPanelFlowLayout(buildGlossaryTermChildren()))
    ).toEqual([
      { i: 'description', x: 0, y: 0, w: 1 },
      { i: 'synonyms', x: 0, y: 2, w: 0.5 },
      { i: 'references', x: 0.5, y: 2, w: 0.5 },
      { i: 'tags', x: 0, y: 4, w: 0.5 },
      { i: 'relatedTerms', x: 0, y: 6, w: 1 },
    ]);
  });

  it('closes a gap view mode cannot draw', () => {
    const children: Layout[] = [
      { i: 'description', x: 0, y: 0, w: 1, h: 2 },
      { i: 'domain', x: 0.5, y: 2, w: 0.5, h: 2 },
    ];

    expect(toPositions(getLeftPanelFlowLayout(children))).toEqual([
      { i: 'description', x: 0, y: 0, w: 1 },
      { i: 'domain', x: 0, y: 2, w: 0.5 },
    ]);
  });

  it('keeps widths that add up to the panel on one line', () => {
    const children: Layout[] = [
      { i: 'wide', x: 0, y: 0, w: 4 / 6, h: 2 },
      { i: 'narrow', x: 4 / 6, y: 0, w: 2 / 6, h: 1 },
      { i: 'next', x: 0, y: 2, w: 1, h: 1 },
    ];

    expect(
      getLeftPanelFlowLayout(children).map(({ i, y }) => ({ i, y }))
    ).toEqual([
      { i: 'wide', y: 0 },
      { i: 'narrow', y: 0 },
      { i: 'next', y: 2 },
    ]);
  });

  it('does not mutate the stored children', () => {
    const children = buildGlossaryTermChildren();

    getLeftPanelFlowLayout(children);

    expect(children[3]).toMatchObject({ x: 3, y: 2 });
  });
});

describe('getLeftPanelHeight', () => {
  const toPixels = (rows: number) =>
    rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_VERTICAL_MARGIN;

  it('fits the nested grid as the edit grid lays it out', () => {
    // Laid out, the glossary term defaults need 8 rows.
    const nestedGridPixels = toPixels(8) + 2 * GRID_VERTICAL_MARGIN;

    expect(
      toPixels(getLeftPanelHeight(buildGlossaryTermChildren()))
    ).toBeCloseTo(nestedGridPixels);
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
  toPositions(
    layout.find(({ i }) => i === DetailPageWidgetKeys.LEFT_PANEL)?.children
  );

describe('placeWidgetInLeftPanel', () => {
  const [, domain] = buildTabLayout();

  it('keeps a side widget square, in the half beside its neighbour', () => {
    const placed = placeWidgetInLeftPanel(buildTabLayout(), domain, {
      row: 2,
      x: HALF_PANEL_WIDTH,
      w: HALF_PANEL_WIDTH,
    });

    expect(placed.map(({ i }) => i)).not.toContain('domain');
    expect(getPanelChildren(placed)).toEqual([
      { i: 'description', x: 0, y: 0, w: 1 },
      { i: 'synonyms', x: 0, y: 2, w: 0.5 },
      { i: 'domain', x: 0.5, y: 2, w: 0.5 },
    ]);
  });

  it('takes the slot it lands on and moves that widget along', () => {
    const placed = placeWidgetInLeftPanel(buildTabLayout(), domain, {
      row: 2,
      x: 0,
      w: HALF_PANEL_WIDTH,
    });

    expect(getPanelChildren(placed)).toEqual([
      { i: 'description', x: 0, y: 0, w: 1 },
      { i: 'domain', x: 0, y: 2, w: 0.5 },
      { i: 'synonyms', x: 0.5, y: 2, w: 0.5 },
    ]);
  });

  it('spans the panel when placed full width', () => {
    const placed = placeWidgetInLeftPanel(buildTabLayout(), domain, {
      row: 1,
      x: HALF_PANEL_WIDTH,
      w: FULL_PANEL_WIDTH,
    });

    expect(getPanelChildren(placed)).toEqual([
      { i: 'description', x: 0, y: 0, w: 1 },
      { i: 'domain', x: 0, y: 2, w: 1 },
      { i: 'synonyms', x: 0, y: 4, w: 0.5 },
    ]);
  });

  it('lands left when dropped alone in the right half, as view mode draws it', () => {
    const layout = buildTabLayout();
    layout[0].children = [{ i: 'description', x: 0, y: 0, w: 1, h: 2 }];

    expect(
      getPanelChildren(
        placeWidgetInLeftPanel(layout, domain, {
          row: 2,
          x: HALF_PANEL_WIDTH,
          w: HALF_PANEL_WIDTH,
        })
      )
    ).toEqual([
      { i: 'description', x: 0, y: 0, w: 1 },
      { i: 'domain', x: 0, y: 2, w: 0.5 },
    ]);
  });

  it('lands among the stored widgets where view mode draws them', () => {
    // Drawn: Synonyms | References, then Tags | (empty).
    const layout = buildTabLayout();
    layout[0].children = [
      { i: 'synonyms', x: 0, y: 1, w: 0.5, h: 2 },
      { i: 'references', x: 0, y: 2, w: 0.5, h: 2 },
      { i: 'tags', x: 3, y: 2, w: 0.5, h: 2 },
    ];

    expect(
      getPanelChildren(
        placeWidgetInLeftPanel(layout, domain, {
          row: 2,
          x: HALF_PANEL_WIDTH,
          w: HALF_PANEL_WIDTH,
        })
      )
    ).toEqual([
      { i: 'synonyms', x: 0, y: 0, w: 0.5 },
      { i: 'references', x: 0.5, y: 0, w: 0.5 },
      { i: 'tags', x: 0, y: 2, w: 0.5 },
      { i: 'domain', x: 0.5, y: 2, w: 0.5 },
    ]);
  });

  it('keeps the widget config', () => {
    const placed = placeWidgetInLeftPanel(buildTabLayout(), domain, {
      row: 2,
      x: 0,
      w: HALF_PANEL_WIDTH,
    });

    expect(placed[0].children?.find(({ i }) => i === 'domain')).toMatchObject({
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

    expect(toPositions(panel?.children)).toEqual([
      { i: 'synonyms', x: 0, y: 0, w: 0.5 },
    ]);
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
