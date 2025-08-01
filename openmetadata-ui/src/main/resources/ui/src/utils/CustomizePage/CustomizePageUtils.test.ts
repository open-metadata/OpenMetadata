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
import { PageType, Tab } from '../../generated/system/ui/page';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import {
  checkIfExpandViewSupported,
  getDefaultTabs,
  getTabLabelFromId,
  getTabLabelMapFromTabs,
  sortTabs,
  updateWidgetHeightRecursively,
} from './CustomizePageUtils';

describe('CustomizePageUtils', () => {
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

      expect(result).toBe('');
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
      const result = getTabLabelMapFromTabs(undefined);

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

    it('should return custom properties tab for unknown page type', () => {
      const result = getDefaultTabs('unknown-type');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(EntityTabs.CUSTOM_PROPERTIES);
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
});
