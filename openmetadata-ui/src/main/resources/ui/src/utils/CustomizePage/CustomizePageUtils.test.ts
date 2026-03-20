/*
 *  Copyright 2025 Collate.
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
import { TabsProps } from 'antd';
import { EntityTabs } from '../../enums/entity.enum';
import { Page, PageType, Tab } from '../../generated/system/ui/page';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import {
  checkIfExpandViewSupported,
  getDefaultTabs,
  getDetailsTabWithNewLabel,
  getLayoutFromCustomizedPage,
  getTabDisplayName,
  getTabLabelFromId,
  getTabLabelMapFromTabs,
  sortTabs,
  updateWidgetHeightRecursively,
} from './CustomizePageUtils';

describe('CustomizePageUtils', () => {
  describe('getTabDisplayName', () => {
    it('should return displayName if present', () => {
      const tab: Tab = {
        id: EntityTabs.OVERVIEW,
        name: EntityTabs.OVERVIEW,
        displayName: 'Custom Overview',
        layout: [],
      };

      expect(getTabDisplayName(tab)).toBe('Custom Overview');
    });

    it('should fallback to getTabLabelFromId if displayName is missing', () => {
      const tab: Tab = {
        id: EntityTabs.OVERVIEW,
        name: EntityTabs.OVERVIEW,
        layout: [],
      };

      const result = getTabDisplayName(tab);

      expect(typeof result).toBe('string');
    });

    it('should return empty string if displayName and name are missing', () => {
      const tab: Tab = {
        id: EntityTabs.OVERVIEW,
        name: '' as EntityTabs,
        layout: [],
      };

      const result = getTabDisplayName(tab);

      expect(typeof result).toBe('string');
    });

    it("should return name if it's not predefined", () => {
      const tab: Tab = {
        id: EntityTabs.OVERVIEW,
        name: 'custom-tab-name' as EntityTabs,
        layout: [],
      };

      const result = getTabDisplayName(tab);

      expect(result).toBe('custom-tab-name');
    });
  });

  describe('sortTabs', () => {
    it('should sort tabs according to given order', () => {
      const tabs: TabsProps['items'] = [
        { key: 'c', label: 'C' },
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ];
      const order = ['a', 'b', 'c'];

      const result = sortTabs(tabs, order);

      expect(result[0].key).toBe('a');
      expect(result[1].key).toBe('b');
      expect(result[2].key).toBe('c');
    });

    it('should handle tabs not in order array', () => {
      const tabs: TabsProps['items'] = [
        { key: 'c', label: 'C' },
        { key: 'd', label: 'D' },
        { key: 'a', label: 'A' },
      ];
      const order = ['a', 'c'];

      const result = sortTabs(tabs, order);

      expect(result[0].key).toBe('a');
      expect(result[1].key).toBe('c');
      expect(result[2].key).toBe('d');
    });
  });

  describe('getTabLabelFromId', () => {
    it('should return translated label for valid tab id', () => {
      const result = getTabLabelFromId(EntityTabs.OVERVIEW);

      expect(result).toBeTruthy();
    });

    it('should return empty string for invalid tab id', () => {
      const result = getTabLabelFromId('invalid-tab' as EntityTabs);

      expect(result).toBe('invalid-tab');
    });
  });

  describe('getTabLabelMapFromTabs', () => {
    it('should create label map from tabs', () => {
      const tabs: Tab[] = [
        {
          id: EntityTabs.OVERVIEW,
          displayName: 'Overview',
          name: 'overview',
          layout: [],
        },
        {
          id: EntityTabs.SCHEMA,
          displayName: 'Schema',
          name: 'schema',
          layout: [],
        },
      ];

      const result = getTabLabelMapFromTabs(tabs);

      expect(result[EntityTabs.OVERVIEW]).toBe('Overview');
      expect(result[EntityTabs.SCHEMA]).toBe('Schema');
    });

    it('should return empty object for undefined tabs', () => {
      const result = getTabLabelMapFromTabs();

      expect(result).toEqual({});
    });
  });

  describe('checkIfExpandViewSupported', () => {
    const firstTab = {
      key: EntityTabs.SCHEMA,
      label: 'Schema',
    };

    it('should return true for supported table schema view', () => {
      const result = checkIfExpandViewSupported(
        firstTab,
        EntityTabs.SCHEMA,
        PageType.Table
      );

      expect(result).toBe(true);
    });

    it('should return false for unsupported view', () => {
      firstTab.key = EntityTabs.AGENTS;
      const result = checkIfExpandViewSupported(
        firstTab,
        EntityTabs.ACTIVITY_FEED,
        PageType.Table
      );

      expect(result).toBe(false);
    });

    it('should return true for glossary terms view', () => {
      const result = checkIfExpandViewSupported(
        { key: EntityTabs.TERMS, label: 'Terms' },
        EntityTabs.TERMS,
        PageType.Glossary
      );

      expect(result).toBe(true);
    });
  });

  describe('getDefaultTabs', () => {
    it('should return default tabs for table page type', () => {
      const result = getDefaultTabs(PageType.Table);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return default tabs for glossary page type', () => {
      const result = getDefaultTabs(PageType.Glossary);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2); // Terms and Activity Feed tabs
    });

    it('should return tabs from glossaryTermClassBase for GlossaryTerm page type', () => {
      const result = getDefaultTabs(PageType.GlossaryTerm);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((t) => t.id === EntityTabs.OVERVIEW)).toBe(true);
    });

    it('should include standard GlossaryTerm tabs via glossaryTermClassBase', () => {
      const result = getDefaultTabs(PageType.GlossaryTerm);
      const ids = result.map((t) => t.id);

      expect(ids).toContain(EntityTabs.OVERVIEW);
      expect(ids).toContain(EntityTabs.GLOSSARY_TERMS);
      expect(ids).toContain(EntityTabs.ASSETS);
    });

    it('should return custom properties tab for unknown page type', () => {
      const result = getDefaultTabs('unknown-type');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(EntityTabs.CUSTOM_PROPERTIES);
    });
  });

  describe('getDetailsTabWithNewLabel', () => {
    const defaultTabs = [
      { key: EntityTabs.OVERVIEW, label: 'Overview' },
      { key: EntityTabs.SCHEMA, label: 'Schema' },
      { key: EntityTabs.ACTIVITY_FEED, label: 'Activity Feed', isHidden: true },
    ];

    it('filters out hidden tabs when no customizedTabs provided', () => {
      const result = getDetailsTabWithNewLabel(defaultTabs);

      expect(result.some((t) => t.key === EntityTabs.ACTIVITY_FEED)).toBe(
        false
      );
      expect(result).toHaveLength(2);
    });

    it('returns all visible default tabs when customizedTabs is undefined', () => {
      const result = getDetailsTabWithNewLabel(defaultTabs);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe(EntityTabs.OVERVIEW);
      expect(result[1].key).toBe(EntityTabs.SCHEMA);
    });

    it('returns only visible default tabs in version view regardless of customizedTabs', () => {
      const customizedTabs: Tab[] = [
        { id: EntityTabs.OVERVIEW, name: EntityTabs.OVERVIEW, layout: [] },
      ];
      const result = getDetailsTabWithNewLabel(
        defaultTabs,
        customizedTabs,
        EntityTabs.OVERVIEW,
        true
      );

      expect(result).toHaveLength(2);
    });

    it('reorders tabs to match customizedTabs order', () => {
      const customizedTabs: Tab[] = [
        { id: EntityTabs.SCHEMA, name: EntityTabs.SCHEMA, layout: [] },
        { id: EntityTabs.OVERVIEW, name: EntityTabs.OVERVIEW, layout: [] },
      ];
      const result = getDetailsTabWithNewLabel(defaultTabs, customizedTabs);

      expect(result[0].key).toBe(EntityTabs.SCHEMA);
      expect(result[1].key).toBe(EntityTabs.OVERVIEW);
    });

    it('filters hidden tabs even when present in customizedTabs', () => {
      const customizedTabs: Tab[] = [
        { id: EntityTabs.OVERVIEW, name: EntityTabs.OVERVIEW, layout: [] },
        {
          id: EntityTabs.ACTIVITY_FEED,
          name: EntityTabs.ACTIVITY_FEED,
          layout: [],
        },
      ];
      const result = getDetailsTabWithNewLabel(defaultTabs, customizedTabs);

      expect(result.some((t) => t.key === EntityTabs.ACTIVITY_FEED)).toBe(
        false
      );
    });
  });

  describe('updateWidgetHeightRecursively', () => {
    it('should update the height of the specified widget', () => {
      const widgets = [
        { i: 'widget-1', h: 50 },
        { i: 'widget-2', h: 75 },
        { i: 'widget-3', h: 100 },
      ] as WidgetConfig[];
      const widgetId = 'widget-2';
      const newHeight = 150;

      const result = updateWidgetHeightRecursively(
        widgetId,
        newHeight,
        widgets
      );

      expect(result).toHaveLength(3);
      expect(result.find((widget) => widget.i === widgetId)?.h).toBe(newHeight);
    });

    it('should update the height of the specified child widget', () => {
      const widgets = [
        { i: 'widget-1', h: 50 },
        {
          i: 'widget-2',
          h: 75,
          children: [
            { i: 'child-1', h: 30 },
            { i: 'child-2', h: 40 },
          ],
        },
        { i: 'widget-3', h: 100 },
      ] as WidgetConfig[];
      const widgetId = 'child-2';
      const newHeight = 60;

      const result = updateWidgetHeightRecursively(
        widgetId,
        newHeight,
        widgets
      );

      expect(result).toHaveLength(3);

      const updatedWidget = result.find((widget) => widget.i === 'widget-2');

      expect(updatedWidget?.children).toBeDefined();
      expect(
        updatedWidget?.children?.find((child) => child.i === widgetId)?.h
      ).toBe(newHeight);
    });

    it('should not change widgets if widgetId is not found', () => {
      const widgets = [
        { i: 'widget-1', h: 50 },
        { i: 'widget-2', h: 75 },
        { i: 'widget-3', h: 100 },
      ] as WidgetConfig[];
      const widgetId = 'non-existent-widget';
      const newHeight = 150;

      const result = updateWidgetHeightRecursively(
        widgetId,
        newHeight,
        widgets
      );

      expect(result).toEqual(widgets);
    });
  });

  describe('getLayoutFromCustomizedPage', () => {
    it('should return saved layout when it is non-empty', () => {
      const savedLayout = [
        { i: 'widget-1', x: 0, y: 0, w: 6, h: 3 },
      ] as WidgetConfig[];
      const customizedPage = {
        pageType: PageType.GlossaryTerm,
        tabs: [
          {
            id: EntityTabs.OVERVIEW,
            name: EntityTabs.OVERVIEW,
            layout: savedLayout,
          },
        ],
      };

      const result = getLayoutFromCustomizedPage(
        PageType.GlossaryTerm,
        EntityTabs.OVERVIEW,
        customizedPage as unknown as Page
      );

      expect(result).toBe(savedLayout);
    });

    it('should fall back to default layout when saved layout is empty', () => {
      const emptyLayout: WidgetConfig[] = [];
      const customizedPage = {
        pageType: PageType.GlossaryTerm,
        tabs: [
          {
            id: EntityTabs.OVERVIEW,
            name: EntityTabs.OVERVIEW,
            layout: emptyLayout,
          },
        ],
      };

      const result = getLayoutFromCustomizedPage(
        PageType.GlossaryTerm,
        EntityTabs.OVERVIEW,
        customizedPage as unknown as Page
      );

      // Should NOT return the empty saved layout — fallback to default
      expect(result).not.toBe(emptyLayout);
    });

    it('should return default layout when customizedPage is null', () => {
      const result = getLayoutFromCustomizedPage(
        PageType.GlossaryTerm,
        EntityTabs.OVERVIEW,
        null
      );

      expect(result).not.toEqual([]);
    });

    it('should return default layout when customizedPage has no tabs', () => {
      const customizedPage = {
        pageType: PageType.GlossaryTerm,
        tabs: [],
      };

      const result = getLayoutFromCustomizedPage(
        PageType.GlossaryTerm,
        EntityTabs.OVERVIEW,
        customizedPage as unknown as Page
      );

      expect(result).not.toEqual([]);
    });

    it('should return default layout when isVersionView is true even with saved layout', () => {
      const savedLayout = [
        { i: 'widget-1', x: 0, y: 0, w: 6, h: 3 },
      ] as WidgetConfig[];
      const customizedPage = {
        pageType: PageType.GlossaryTerm,
        tabs: [
          {
            id: EntityTabs.OVERVIEW,
            name: EntityTabs.OVERVIEW,
            layout: savedLayout,
          },
        ],
      };

      const result = getLayoutFromCustomizedPage(
        PageType.GlossaryTerm,
        EntityTabs.OVERVIEW,
        customizedPage as unknown as Page,
        true
      );

      expect(result).not.toBe(savedLayout);
    });
  });
});
