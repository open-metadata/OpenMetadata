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
import { DEFAULT_LANDING_PAGE_LAYOUT } from '../constants/CustomizeMyDataPage.constants';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  isAvailableMyDataWidgetKey,
  MY_DATA_WIDGET_KEYS,
  normalizeLandingPageLayout,
} from './CustomizeMyDataPageWidgetUtils';

const widget = (i: string, x: number, y: number, w = 1, h = 3): WidgetConfig =>
  ({ i, x, y, w, h } as WidgetConfig);

const DEFAULT_LAYOUT = [
  widget(LandingPageWidgetKeys.PLATFORM_HEALTH, 0, 0),
  widget(LandingPageWidgetKeys.DATA_ESTATE, 1, 0),
];

const normalize = (
  saved: WidgetConfig[] | undefined,
  excluded: string[] = []
) => normalizeLandingPageLayout(saved, DEFAULT_LAYOUT, excluded, 2);

describe('MY_DATA_WIDGET_KEYS', () => {
  // Pinned rather than derived: the picker offers this set and the grid renders
  // it, so gaining or losing one is a product change that should have to be
  // stated here, not something a stray registry edit does quietly.
  it('is the ten landing-page widgets, in default layout order', () => {
    expect(MY_DATA_WIDGET_KEYS).toEqual([
      LandingPageWidgetKeys.PLATFORM_HEALTH,
      LandingPageWidgetKeys.DATA_ESTATE,
      LandingPageWidgetKeys.ACTIVITY_FEED,
      LandingPageWidgetKeys.YOURS_AND_FOLLOWED,
      LandingPageWidgetKeys.KNOWLEDGE_CENTER,
      LandingPageWidgetKeys.CURATED_ASSETS,
      LandingPageWidgetKeys.DATA_QUALITY,
      LandingPageWidgetKeys.DOMAINS,
      LandingPageWidgetKeys.DATA_PRODUCTS,
      LandingPageWidgetKeys.KPI,
    ]);
  });

  it('matches the default layout the page falls back to', () => {
    expect(DEFAULT_LANDING_PAGE_LAYOUT.map(({ i }) => i)).toEqual([
      ...MY_DATA_WIDGET_KEYS,
    ]);
  });
});

describe('isAvailableMyDataWidgetKey', () => {
  it('accepts a registry key and the grid instance keys derived from it', () => {
    expect(isAvailableMyDataWidgetKey(LandingPageWidgetKeys.KPI, [])).toBe(
      true
    );
    expect(
      isAvailableMyDataWidgetKey(`${LandingPageWidgetKeys.KPI}-42`, [])
    ).toBe(true);
  });

  it('rejects a key the registry does not resolve', () => {
    // docStore keeps every KnowledgePanel ever seeded, so unknown keys reach
    // both the picker and saved layouts.
    expect(
      isAvailableMyDataWidgetKey('KnowledgePanel.RecentlyViewed', [])
    ).toBe(false);
  });

  it('rejects an excluded key even though the registry resolves it', () => {
    expect(
      isAvailableMyDataWidgetKey(LandingPageWidgetKeys.DATA_QUALITY, [
        LandingPageWidgetKeys.DATA_QUALITY,
      ])
    ).toBe(false);
  });
});

describe('normalizeLandingPageLayout', () => {
  it('falls back to the default layout when nothing is saved', () => {
    expect(normalize(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalize([])).toEqual(DEFAULT_LAYOUT);
  });

  it('drops entries naming a widget this build cannot render', () => {
    const saved = [
      widget(LandingPageWidgetKeys.ACTIVITY_FEED, 0, 0),
      // Retired: resolves to a render-nothing component, so leaving it in the
      // layout would reserve a grid cell that draws as a blank gap.
      widget('KnowledgePanel.SomeRetiredWidget', 1, 0),
      widget(LandingPageWidgetKeys.KPI, 0, 3),
    ];

    expect(normalize(saved).map(({ i }) => i)).toEqual([
      LandingPageWidgetKeys.ACTIVITY_FEED,
      LandingPageWidgetKeys.KPI,
    ]);
  });

  it('drops excluded widgets, matching on the key prefix', () => {
    const saved = [
      widget(LandingPageWidgetKeys.ACTIVITY_FEED, 0, 0),
      widget(`${LandingPageWidgetKeys.DATA_QUALITY}-42`, 1, 0),
    ];

    expect(
      normalize(saved, [LandingPageWidgetKeys.DATA_QUALITY]).map(({ i }) => i)
    ).toEqual([LandingPageWidgetKeys.ACTIVITY_FEED]);
  });

  it('falls back to the default once filtering empties the saved layout', () => {
    const saved = [widget(LandingPageWidgetKeys.DATA_QUALITY, 0, 0)];

    expect(normalize(saved, [LandingPageWidgetKeys.DATA_QUALITY])).toEqual(
      DEFAULT_LAYOUT
    );
  });

  // A `w` of 2 meant two of three columns when it was saved; at two columns it
  // spans the whole row, and nothing in the landing UI can resize it back.
  it('collapses a width saved against a wider grid to one column', () => {
    const saved = [
      widget(LandingPageWidgetKeys.ACTIVITY_FEED, 0, 0, 2),
      widget(LandingPageWidgetKeys.KPI, 2, 0, 3),
    ];

    expect(normalize(saved).map(({ w }) => w)).toEqual([1, 1]);
  });

  it('packs a collapsed widget alongside its neighbour rather than below it', () => {
    const saved = [
      widget(LandingPageWidgetKeys.ACTIVITY_FEED, 0, 0, 2),
      widget(LandingPageWidgetKeys.KPI, 2, 0),
    ];

    expect(normalize(saved).map(({ i, x, y }) => ({ i, x, y }))).toEqual([
      { i: LandingPageWidgetKeys.ACTIVITY_FEED, x: 0, y: 0 },
      { i: LandingPageWidgetKeys.KPI, x: 1, y: 0 },
    ]);
  });

  it('re-packs an x saved against a wider grid, preserving reading order', () => {
    // Saved against three columns: the third widget sits past the new last
    // column, and so does the fourth once the third moves down.
    const saved = [
      widget(LandingPageWidgetKeys.PLATFORM_HEALTH, 0, 0),
      widget(LandingPageWidgetKeys.DATA_ESTATE, 1, 0),
      widget(LandingPageWidgetKeys.ACTIVITY_FEED, 2, 0),
      widget(LandingPageWidgetKeys.KPI, 0, 3),
    ];

    expect(normalize(saved).map(({ i, x, y }) => ({ i, x, y }))).toEqual([
      { i: LandingPageWidgetKeys.PLATFORM_HEALTH, x: 0, y: 0 },
      { i: LandingPageWidgetKeys.DATA_ESTATE, x: 1, y: 0 },
      { i: LandingPageWidgetKeys.ACTIVITY_FEED, x: 0, y: 3 },
      { i: LandingPageWidgetKeys.KPI, x: 1, y: 3 },
    ]);
  });
});
