/*
 *  Copyright 2024 Collate.
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

import React from 'react';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { SPREADSHEET_DUMMY_DATA } from '../constants/Spreadsheet.constant';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Spreadsheet } from '../generated/entity/data/spreadsheet';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import spreadsheetClassBase, {
  SpreadsheetClassBase,
} from './SpreadsheetClassBase';
import { SpreadsheetDetailPageTabProps } from './SpreadsheetDetailsUtils';

// Mock dependencies
jest.mock('../constants/CustomizeWidgets.constants', () => ({
  CUSTOM_PROPERTIES_WIDGET: {
    fullyQualifiedName: 'customProperties',
    name: 'Custom Properties',
    data: { gridSizes: ['small', 'medium', 'large'] },
  },
  DATA_PRODUCTS_WIDGET: {
    fullyQualifiedName: 'dataProducts',
    name: 'Data Products',
    data: { gridSizes: ['medium', 'large'] },
  },
  DESCRIPTION_WIDGET: {
    fullyQualifiedName: 'description',
    name: 'Description',
    data: { gridSizes: ['small', 'medium', 'large'] },
  },
  GLOSSARY_TERMS_WIDGET: {
    fullyQualifiedName: 'glossaryTerms',
    name: 'Glossary Terms',
    data: { gridSizes: ['medium', 'large'] },
  },
  TAGS_WIDGET: {
    fullyQualifiedName: 'tags',
    name: 'Tags',
    data: { gridSizes: ['medium', 'large'] },
  },
}));

jest.mock('../constants/Spreadsheet.constant', () => ({
  SPREADSHEET_DUMMY_DATA: {
    id: 'test-spreadsheet-id',
    name: 'Test Spreadsheet',
    fullyQualifiedName: 'testService.testSpreadsheet',
    description: 'Test spreadsheet description',
    worksheets: [],
    service: { id: 'service-id', name: 'test-service', type: 'DriveService' },
  } as Spreadsheet,
}));

jest.mock('./CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tabId: EntityTabs) => {
    const labelMap: Partial<Record<EntityTabs, string>> = {
      [EntityTabs.WORKSHEETS]: 'Worksheets',
      [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
      [EntityTabs.LINEAGE]: 'Lineage',
      [EntityTabs.CONTRACT]: 'Contract',
      [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
    };

    return labelMap[tabId] || tabId;
  }),
}));

jest.mock('./SpreadsheetDetailsUtils', () => ({
  getSpreadsheetDetailsPageTabs: jest.fn((): TabProps[] => [
    {
      label: React.createElement('div', {}, 'Worksheets') as JSX.Element,
      key: EntityTabs.WORKSHEETS,
      children: React.createElement(
        'div',
        {},
        'Mock Worksheets Tab'
      ) as JSX.Element,
    },
    {
      label: React.createElement('div', {}, 'Activity Feed') as JSX.Element,
      key: EntityTabs.ACTIVITY_FEED,
      children: React.createElement(
        'div',
        {},
        'Mock Activity Feed Tab'
      ) as JSX.Element,
    },
    {
      label: React.createElement('div', {}, 'Lineage') as JSX.Element,
      key: EntityTabs.LINEAGE,
      children: React.createElement(
        'div',
        {},
        'Mock Lineage Tab'
      ) as JSX.Element,
    },
    {
      label: React.createElement('div', {}, 'Custom Properties') as JSX.Element,
      key: EntityTabs.CUSTOM_PROPERTIES,
      children: React.createElement(
        'div',
        {},
        'Mock Custom Properties Tab'
      ) as JSX.Element,
    },
  ]),
  getSpreadsheetWidgetsFromKey: jest.fn(
    (widgetConfig: WidgetConfig) =>
      `Mock ${widgetConfig?.i || 'unknown'} Widget`
  ),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'label.worksheet-plural': 'Worksheets',
    };

    return translations[key] || key;
  }),
}));

describe('SpreadsheetClassBase', () => {
  let spreadsheetClass: SpreadsheetClassBase;

  beforeEach(() => {
    spreadsheetClass = new SpreadsheetClassBase();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize default widget heights correctly', () => {
      expect(spreadsheetClass.defaultWidgetHeight).toEqual({
        [DetailPageWidgetKeys.DESCRIPTION]: 2,
        [DetailPageWidgetKeys.WORKSHEETS]: 8,
        [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
        [DetailPageWidgetKeys.TAGS]: 2,
        [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
        [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
      });
    });
  });

  describe('getSpreadsheetDetailPageTabs', () => {
    it('should call getSpreadsheetDetailsPageTabs with correct props', () => {
      const mockProps: SpreadsheetDetailPageTabProps = {
        childrenCount: 3,
        activityFeedTab: React.createElement(
          'div',
          {},
          'Activity Feed'
        ) as JSX.Element,
        lineageTab: React.createElement('div', {}, 'Lineage') as JSX.Element,
        customPropertiesTab: React.createElement(
          'div',
          {},
          'Custom Properties'
        ) as JSX.Element,
        activeTab: EntityTabs.WORKSHEETS,
        feedCount: { totalCount: 8 },
        labelMap: {
          [EntityTabs.WORKSHEETS]: 'Spreadsheet Worksheets',
          [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
          [EntityTabs.LINEAGE]: 'Lineage',
          [EntityTabs.CONTRACT]: 'Contract',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
        } as Record<string, string>,
      };

      const { getSpreadsheetDetailsPageTabs } = jest.requireMock(
        './SpreadsheetDetailsUtils'
      );
      spreadsheetClass.getSpreadsheetDetailPageTabs(mockProps);

      expect(getSpreadsheetDetailsPageTabs).toHaveBeenCalledWith(mockProps);
    });
  });

  describe('getSpreadsheetDetailPageTabsIds', () => {
    it('should return correct tab configuration', () => {
      const result = spreadsheetClass.getSpreadsheetDetailPageTabsIds();

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: EntityTabs.WORKSHEETS,
        name: EntityTabs.WORKSHEETS,
        displayName: 'Worksheets',
        layout: expect.any(Array),
        editable: true,
      });
      expect(result[1]).toEqual({
        id: EntityTabs.ACTIVITY_FEED,
        name: EntityTabs.ACTIVITY_FEED,
        displayName: 'Activity Feed',
        layout: [],
        editable: false,
      });
      expect(result[2]).toEqual({
        id: EntityTabs.LINEAGE,
        name: EntityTabs.LINEAGE,
        displayName: 'Lineage',
        layout: [],
        editable: false,
      });
      expect(result[3]).toEqual({
        id: EntityTabs.CONTRACT,
        name: EntityTabs.CONTRACT,
        displayName: 'Contract',
        layout: [],
        editable: false,
      });
      expect(result[4]).toEqual({
        id: EntityTabs.CUSTOM_PROPERTIES,
        name: EntityTabs.CUSTOM_PROPERTIES,
        displayName: 'Custom Properties',
        layout: [],
        editable: false,
      });
    });

    it('should mark only WORKSHEETS tab as editable', () => {
      const result = spreadsheetClass.getSpreadsheetDetailPageTabsIds();
      const worksheetsTab = result.find(
        (tab) => tab.id === EntityTabs.WORKSHEETS
      );
      const otherTabs = result.filter(
        (tab) => tab.id !== EntityTabs.WORKSHEETS
      );

      expect(worksheetsTab?.editable).toBe(true);

      otherTabs.forEach((tab) => {
        expect(tab.editable).toBe(false);
      });
    });
  });

  describe('getDefaultLayout', () => {
    it('should return empty layout for non-WORKSHEETS tabs', () => {
      const tabs = [
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CUSTOM_PROPERTIES,
      ];

      tabs.forEach((tab) => {
        const result = spreadsheetClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });

    it('should return default layout for WORKSHEETS tab', () => {
      const result = spreadsheetClass.getDefaultLayout(EntityTabs.WORKSHEETS);

      expect(result).toHaveLength(5);

      // Check left panel
      const leftPanel = result[0];

      expect(leftPanel.i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
      expect(leftPanel.w).toBe(6);
      expect(leftPanel.children).toHaveLength(2);
      expect(leftPanel.static).toBe(true);

      // Check description widget in left panel
      const descriptionWidget = leftPanel.children?.[0];

      expect(descriptionWidget?.i).toBe(DetailPageWidgetKeys.DESCRIPTION);
      expect(descriptionWidget?.h).toBe(2);

      // Check worksheets widget in left panel
      const worksheetsWidget = leftPanel.children?.[1];

      expect(worksheetsWidget?.i).toBe(DetailPageWidgetKeys.WORKSHEETS);
      expect(worksheetsWidget?.h).toBe(8);
    });

    it('should return default layout for undefined tab', () => {
      const result = spreadsheetClass.getDefaultLayout(undefined);

      expect(result).toHaveLength(5);
      expect(result[0].i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
    });

    it('should include all widget types in default layout', () => {
      const result = spreadsheetClass.getDefaultLayout(EntityTabs.WORKSHEETS);
      const widgetKeys = result.flatMap((widget) =>
        widget.children
          ? [widget.i, ...widget.children.map((child) => child.i)]
          : [widget.i]
      );

      expect(widgetKeys).toContain(DetailPageWidgetKeys.LEFT_PANEL);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DESCRIPTION);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.WORKSHEETS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DATA_PRODUCTS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.TAGS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.GLOSSARY_TERMS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.CUSTOM_PROPERTIES);
    });

    it('should calculate correct left panel height', () => {
      const result = spreadsheetClass.getDefaultLayout(EntityTabs.WORKSHEETS);
      const leftPanel = result[0];

      const expectedHeight =
        spreadsheetClass.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] +
        spreadsheetClass.defaultWidgetHeight[DetailPageWidgetKeys.WORKSHEETS] +
        0.5;

      expect(leftPanel.h).toBe(expectedHeight);
      expect(leftPanel.h).toBe(10.5); // 2 + 8 + 0.5
    });
  });

  describe('getAlertEnableStatus', () => {
    it('should always return false', () => {
      const result = spreadsheetClass.getAlertEnableStatus();

      expect(result).toBe(false);
    });
  });

  describe('getDummyData', () => {
    it('should return spreadsheet dummy data', () => {
      const result = spreadsheetClass.getDummyData();

      expect(result).toBe(SPREADSHEET_DUMMY_DATA);
      expect(result.name).toBe('Test Spreadsheet');
    });
  });

  describe('getCommonWidgetList', () => {
    it('should return correct widget list', () => {
      const result = spreadsheetClass.getCommonWidgetList();

      expect(result).toHaveLength(6);
      expect(result[0]).toBe(DESCRIPTION_WIDGET);
      expect(result[1]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.WORKSHEETS,
        name: 'Worksheets',
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      });
      expect(result[2]).toBe(DATA_PRODUCTS_WIDGET);
      expect(result[3]).toBe(TAGS_WIDGET);
      expect(result[4]).toBe(GLOSSARY_TERMS_WIDGET);
      expect(result[5]).toBe(CUSTOM_PROPERTIES_WIDGET);
    });

    it('should include worksheets widget with correct configuration', () => {
      const result = spreadsheetClass.getCommonWidgetList();
      const worksheetsWidget = result[1];

      expect(worksheetsWidget).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.WORKSHEETS,
        name: 'Worksheets',
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      });
    });
  });

  describe('getWidgetsFromKey', () => {
    it('should call getSpreadsheetWidgetsFromKey with widget config', () => {
      const mockWidgetConfig: WidgetConfig = {
        h: 8,
        i: DetailPageWidgetKeys.WORKSHEETS,
        w: 6,
        x: 0,
        y: 1,
      };

      const { getSpreadsheetWidgetsFromKey } = jest.requireMock(
        './SpreadsheetDetailsUtils'
      );
      spreadsheetClass.getWidgetsFromKey(mockWidgetConfig);

      expect(getSpreadsheetWidgetsFromKey).toHaveBeenCalledWith(
        mockWidgetConfig
      );
    });
  });

  describe('getWidgetHeight', () => {
    it('should return correct height for DESCRIPTION widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.DESCRIPTION
      );

      expect(result).toBe(2);
    });

    it('should return correct height for WORKSHEETS widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.WORKSHEETS
      );

      expect(result).toBe(8);
    });

    it('should return correct height for DATA_PRODUCTS widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.DATA_PRODUCTS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for TAGS widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.TAGS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for GLOSSARY_TERMS widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.GLOSSARY_TERMS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for CUSTOM_PROPERTIES widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.CUSTOM_PROPERTIES
      );

      expect(result).toBe(4);
    });

    it('should return default height for unknown widget', () => {
      const result = spreadsheetClass.getWidgetHeight('unknown-widget');

      expect(result).toBe(1);
    });

    it('should return default height for unsupported widget', () => {
      const result = spreadsheetClass.getWidgetHeight(
        DetailPageWidgetKeys.DIRECTORY_CHILDREN
      );

      expect(result).toBe(1);
    });

    it('should handle empty string widget name', () => {
      const result = spreadsheetClass.getWidgetHeight('');

      expect(result).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle null widget config in getWidgetsFromKey', () => {
      const nullWidgetConfig = null as unknown as WidgetConfig;

      expect(() => {
        spreadsheetClass.getWidgetsFromKey(nullWidgetConfig);
      }).not.toThrow();
    });

    it('should handle invalid tab types in getDefaultLayout', () => {
      const invalidTab = 'INVALID_TAB' as EntityTabs;
      const result = spreadsheetClass.getDefaultLayout(invalidTab);

      expect(result).toEqual([]);
    });

    it('should handle other valid tabs correctly', () => {
      const validTabs = [
        EntityTabs.OVERVIEW,
        EntityTabs.SCHEMA,
        EntityTabs.CHILDREN,
      ];

      validTabs.forEach((tab) => {
        const result = spreadsheetClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });
  });

  describe('widget positioning', () => {
    it('should position widgets correctly in default layout', () => {
      const result = spreadsheetClass.getDefaultLayout(EntityTabs.WORKSHEETS);

      // Check that right-side widgets have correct positions
      const dataProductsWidget = result.find(
        (w) => w.i === DetailPageWidgetKeys.DATA_PRODUCTS
      );

      expect(dataProductsWidget).toMatchObject({ x: 6, y: 1, w: 2 });

      const tagsWidget = result.find((w) => w.i === DetailPageWidgetKeys.TAGS);

      expect(tagsWidget).toMatchObject({ x: 6, y: 2, w: 2 });

      const glossaryWidget = result.find(
        (w) => w.i === DetailPageWidgetKeys.GLOSSARY_TERMS
      );

      expect(glossaryWidget).toMatchObject({ x: 6, y: 3, w: 2 });

      const customPropsWidget = result.find(
        (w) => w.i === DetailPageWidgetKeys.CUSTOM_PROPERTIES
      );

      expect(customPropsWidget).toMatchObject({ x: 6, y: 6, w: 2 });
    });
  });

  describe('singleton instance', () => {
    it('should export a default singleton instance', () => {
      expect(spreadsheetClassBase).toBeInstanceOf(SpreadsheetClassBase);
    });

    it('should have same methods as new instance', () => {
      const newInstance = new SpreadsheetClassBase();

      expect(typeof spreadsheetClassBase.getSpreadsheetDetailPageTabs).toBe(
        'function'
      );
      expect(typeof spreadsheetClassBase.getDefaultLayout).toBe('function');
      expect(typeof spreadsheetClassBase.getAlertEnableStatus).toBe('function');
      expect(typeof spreadsheetClassBase.getDummyData).toBe('function');

      expect(spreadsheetClassBase.getAlertEnableStatus()).toBe(
        newInstance.getAlertEnableStatus()
      );
      expect(spreadsheetClassBase.getDummyData()).toBe(
        newInstance.getDummyData()
      );
    });
  });
});
