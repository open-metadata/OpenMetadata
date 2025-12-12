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
import { WORKSHEET_DUMMY_DATA } from '../constants/Worksheet.constant';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Worksheet } from '../generated/entity/data/worksheet';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import worksheetClassBase, { WorksheetClassBase } from './WorksheetClassBase';
import { WorksheetDetailPageTabProps } from './WorksheetDetailsUtils';

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

jest.mock('../constants/Worksheet.constant', () => ({
  WORKSHEET_DUMMY_DATA: {
    id: 'test-worksheet-id',
    name: 'Test Worksheet',
    fullyQualifiedName: 'testService.testSpreadsheet.testWorksheet',
    description: 'Test worksheet description',
    columns: [],
    service: { id: 'service-id', name: 'test-service', type: 'DriveService' },
    spreadsheet: {
      id: 'spreadsheet-id',
      name: 'test-spreadsheet',
      type: 'Spreadsheet',
    },
  } as Worksheet,
}));

jest.mock('./CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tabId: EntityTabs) => {
    const labelMap: Partial<Record<EntityTabs, string>> = {
      [EntityTabs.SCHEMA]: 'Schema',
      [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
      [EntityTabs.LINEAGE]: 'Lineage',
      [EntityTabs.CONTRACT]: 'Contract',
      [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
    };

    return labelMap[tabId] || tabId;
  }),
}));

jest.mock('./WorksheetDetailsUtils', () => ({
  getWorksheetDetailsPageTabs: jest.fn((): TabProps[] => [
    {
      label: React.createElement('div', {}, 'Schema') as JSX.Element,
      key: EntityTabs.SCHEMA,
      children: React.createElement(
        'div',
        {},
        'Mock Schema Tab'
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
  getWorksheetWidgetsFromKey: jest.fn(
    (widgetConfig: WidgetConfig) =>
      `Mock ${widgetConfig?.i || 'unknown'} Widget`
  ),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'label.column-plural': 'Columns',
    };

    return translations[key] || key;
  }),
}));

describe('WorksheetClassBase', () => {
  let worksheetClass: WorksheetClassBase;

  beforeEach(() => {
    worksheetClass = new WorksheetClassBase();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize default widget heights correctly', () => {
      expect(worksheetClass.defaultWidgetHeight).toEqual({
        [DetailPageWidgetKeys.DESCRIPTION]: 2,
        [DetailPageWidgetKeys.WORKSHEET_COLUMNS]: 8,
        [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
        [DetailPageWidgetKeys.TAGS]: 2,
        [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
        [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
      });
    });
  });

  describe('getWorksheetDetailPageTabs', () => {
    it('should call getWorksheetDetailsPageTabs with correct props', () => {
      const mockProps: WorksheetDetailPageTabProps = {
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
        activeTab: EntityTabs.SCHEMA,
        feedCount: { totalCount: 12 },
        labelMap: {
          [EntityTabs.SCHEMA]: 'Worksheet Schema',
          [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
          [EntityTabs.LINEAGE]: 'Lineage',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
        } as Record<string, string>,
      };

      const { getWorksheetDetailsPageTabs } = jest.requireMock(
        './WorksheetDetailsUtils'
      );
      worksheetClass.getWorksheetDetailPageTabs(mockProps);

      expect(getWorksheetDetailsPageTabs).toHaveBeenCalledWith(mockProps);
    });
  });

  describe('getWorksheetDetailPageTabsIds', () => {
    it('should return correct tab configuration', () => {
      const result = worksheetClass.getWorksheetDetailPageTabsIds();

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: EntityTabs.SCHEMA,
        name: EntityTabs.SCHEMA,
        displayName: 'Schema',
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

    it('should mark only SCHEMA tab as editable', () => {
      const result = worksheetClass.getWorksheetDetailPageTabsIds();
      const schemaTab = result.find((tab) => tab.id === EntityTabs.SCHEMA);
      const otherTabs = result.filter((tab) => tab.id !== EntityTabs.SCHEMA);

      expect(schemaTab?.editable).toBe(true);

      otherTabs.forEach((tab) => {
        expect(tab.editable).toBe(false);
      });
    });
  });

  describe('getDefaultLayout', () => {
    it('should return empty layout for non-SCHEMA tabs', () => {
      const tabs = [
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CUSTOM_PROPERTIES,
        EntityTabs.OVERVIEW,
        EntityTabs.CHILDREN,
      ];

      tabs.forEach((tab) => {
        const result = worksheetClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });

    it('should return default layout for SCHEMA tab', () => {
      const result = worksheetClass.getDefaultLayout(EntityTabs.SCHEMA);

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

      // Check worksheet columns widget in left panel
      const columnsWidget = leftPanel.children?.[1];

      expect(columnsWidget?.i).toBe(DetailPageWidgetKeys.WORKSHEET_COLUMNS);
      expect(columnsWidget?.h).toBe(8);
    });

    it('should return default layout for undefined tab', () => {
      const result = worksheetClass.getDefaultLayout(undefined);

      expect(result).toHaveLength(5);
      expect(result[0].i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
    });

    it('should include all widget types in default layout', () => {
      const result = worksheetClass.getDefaultLayout(EntityTabs.SCHEMA);
      const widgetKeys = result.flatMap((widget) =>
        widget.children
          ? [widget.i, ...widget.children.map((child) => child.i)]
          : [widget.i]
      );

      expect(widgetKeys).toContain(DetailPageWidgetKeys.LEFT_PANEL);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DESCRIPTION);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.WORKSHEET_COLUMNS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DATA_PRODUCTS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.TAGS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.GLOSSARY_TERMS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.CUSTOM_PROPERTIES);
    });

    it('should calculate correct left panel height', () => {
      const result = worksheetClass.getDefaultLayout(EntityTabs.SCHEMA);
      const leftPanel = result[0];

      const expectedHeight =
        worksheetClass.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] +
        worksheetClass.defaultWidgetHeight[
          DetailPageWidgetKeys.WORKSHEET_COLUMNS
        ] +
        0.5;

      expect(leftPanel.h).toBe(expectedHeight);
      expect(leftPanel.h).toBe(10.5); // 2 + 8 + 0.5
    });
  });

  describe('getAlertEnableStatus', () => {
    it('should always return false', () => {
      const result = worksheetClass.getAlertEnableStatus();

      expect(result).toBe(false);
    });
  });

  describe('getDummyData', () => {
    it('should return worksheet dummy data', () => {
      const result = worksheetClass.getDummyData();

      expect(result).toBe(WORKSHEET_DUMMY_DATA);
      expect(result.name).toBe('Test Worksheet');
    });
  });

  describe('getCommonWidgetList', () => {
    it('should return correct widget list', () => {
      const result = worksheetClass.getCommonWidgetList();

      expect(result).toHaveLength(6);
      expect(result[0]).toBe(DESCRIPTION_WIDGET);
      expect(result[1]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.WORKSHEET_COLUMNS,
        name: 'Columns',
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      });
      expect(result[2]).toBe(DATA_PRODUCTS_WIDGET);
      expect(result[3]).toBe(TAGS_WIDGET);
      expect(result[4]).toBe(GLOSSARY_TERMS_WIDGET);
      expect(result[5]).toBe(CUSTOM_PROPERTIES_WIDGET);
    });

    it('should include worksheet columns widget with correct configuration', () => {
      const result = worksheetClass.getCommonWidgetList();
      const columnsWidget = result[1];

      expect(columnsWidget).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.WORKSHEET_COLUMNS,
        name: 'Columns',
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      });
    });
  });

  describe('getWidgetsFromKey', () => {
    it('should call getWorksheetWidgetsFromKey with widget config', () => {
      const mockWidgetConfig: WidgetConfig = {
        h: 8,
        i: DetailPageWidgetKeys.WORKSHEET_COLUMNS,
        w: 6,
        x: 0,
        y: 1,
      };

      const { getWorksheetWidgetsFromKey } = jest.requireMock(
        './WorksheetDetailsUtils'
      );
      worksheetClass.getWidgetsFromKey(mockWidgetConfig);

      expect(getWorksheetWidgetsFromKey).toHaveBeenCalledWith(mockWidgetConfig);
    });
  });

  describe('getWidgetHeight', () => {
    it('should return correct height for DESCRIPTION widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.DESCRIPTION
      );

      expect(result).toBe(2);
    });

    it('should return correct height for WORKSHEET_COLUMNS widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.WORKSHEET_COLUMNS
      );

      expect(result).toBe(8);
    });

    it('should return correct height for DATA_PRODUCTS widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.DATA_PRODUCTS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for TAGS widget', () => {
      const result = worksheetClass.getWidgetHeight(DetailPageWidgetKeys.TAGS);

      expect(result).toBe(2);
    });

    it('should return correct height for GLOSSARY_TERMS widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.GLOSSARY_TERMS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for CUSTOM_PROPERTIES widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.CUSTOM_PROPERTIES
      );

      expect(result).toBe(4);
    });

    it('should return default height for unknown widget', () => {
      const result = worksheetClass.getWidgetHeight('unknown-widget');

      expect(result).toBe(1);
    });

    it('should return default height for unsupported widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.DIRECTORY_CHILDREN
      );

      expect(result).toBe(1);
    });

    it('should return default height for worksheets widget', () => {
      const result = worksheetClass.getWidgetHeight(
        DetailPageWidgetKeys.WORKSHEETS
      );

      expect(result).toBe(1);
    });

    it('should handle empty string widget name', () => {
      const result = worksheetClass.getWidgetHeight('');

      expect(result).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle null widget config in getWidgetsFromKey', () => {
      const nullWidgetConfig = null as unknown as WidgetConfig;

      expect(() => {
        worksheetClass.getWidgetsFromKey(nullWidgetConfig);
      }).not.toThrow();
    });

    it('should handle invalid tab types in getDefaultLayout', () => {
      const invalidTab = 'INVALID_TAB' as EntityTabs;
      const result = worksheetClass.getDefaultLayout(invalidTab);

      expect(result).toEqual([]);
    });

    it('should handle other valid tabs correctly', () => {
      const validTabs = [
        EntityTabs.OVERVIEW,
        EntityTabs.WORKSHEETS,
        EntityTabs.CHILDREN,
      ];

      validTabs.forEach((tab) => {
        const result = worksheetClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });
  });

  describe('widget positioning', () => {
    it('should position widgets correctly in default layout', () => {
      const result = worksheetClass.getDefaultLayout(EntityTabs.SCHEMA);

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

    it('should ensure all widgets are non-static except left panel', () => {
      const result = worksheetClass.getDefaultLayout(EntityTabs.SCHEMA);
      const leftPanel = result.find(
        (w) => w.i === DetailPageWidgetKeys.LEFT_PANEL
      );
      const otherWidgets = result.filter(
        (w) => w.i !== DetailPageWidgetKeys.LEFT_PANEL
      );

      expect(leftPanel?.static).toBe(true);

      otherWidgets.forEach((widget) => {
        expect(widget.static).toBe(false);
      });
    });

    it('should set correct dimensions for child widgets in left panel', () => {
      const result = worksheetClass.getDefaultLayout(EntityTabs.SCHEMA);
      const leftPanel = result.find(
        (w) => w.i === DetailPageWidgetKeys.LEFT_PANEL
      );
      const children = leftPanel?.children;

      expect(children).toHaveLength(2);

      const descriptionChild = children?.find(
        (child) => child.i === DetailPageWidgetKeys.DESCRIPTION
      );

      expect(descriptionChild).toMatchObject({
        h: 2,
        w: 1,
        x: 0,
        y: 0,
        static: false,
      });

      const columnsChild = children?.find(
        (child) => child.i === DetailPageWidgetKeys.WORKSHEET_COLUMNS
      );

      expect(columnsChild).toMatchObject({
        h: 8,
        w: 1,
        x: 0,
        y: 1,
        static: false,
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a default singleton instance', () => {
      expect(worksheetClassBase).toBeInstanceOf(WorksheetClassBase);
    });

    it('should have same methods as new instance', () => {
      const newInstance = new WorksheetClassBase();

      expect(typeof worksheetClassBase.getWorksheetDetailPageTabs).toBe(
        'function'
      );
      expect(typeof worksheetClassBase.getDefaultLayout).toBe('function');
      expect(typeof worksheetClassBase.getAlertEnableStatus).toBe('function');
      expect(typeof worksheetClassBase.getDummyData).toBe('function');

      expect(worksheetClassBase.getAlertEnableStatus()).toBe(
        newInstance.getAlertEnableStatus()
      );
      expect(worksheetClassBase.getDummyData()).toBe(
        newInstance.getDummyData()
      );
    });
  });
});
