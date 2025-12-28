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
import { DIRECTORY_DUMMY_DATA } from '../constants/Directory.constant';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Directory } from '../generated/entity/data/directory';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import directoryClassBase, { DirectoryClassBase } from './DirectoryClassBase';
import { DirectoryDetailPageTabProps } from './DirectoryDetailsUtils';

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

jest.mock('../constants/Directory.constant', () => ({
  DIRECTORY_DUMMY_DATA: {
    id: 'test-directory-id',
    name: 'Test Directory',
    fullyQualifiedName: 'testService.testDirectory',
    description: 'Test directory description',
    children: [],
    service: { id: 'service-id', name: 'test-service', type: 'DriveService' },
  } as Directory,
}));

jest.mock('./CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tabId: EntityTabs) => {
    const labelMap: Partial<Record<EntityTabs, string>> = {
      [EntityTabs.CHILDREN]: 'Children',
      [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
      [EntityTabs.LINEAGE]: 'Lineage',
      [EntityTabs.CONTRACT]: 'Contract',
      [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
    };

    return labelMap[tabId] || tabId;
  }),
}));

jest.mock('./DirectoryDetailsUtils', () => ({
  getDirectoryDetailsPageTabs: jest.fn((): TabProps[] => [
    {
      label: React.createElement('div', {}, 'Children') as JSX.Element,
      key: EntityTabs.CHILDREN,
      children: React.createElement(
        'div',
        {},
        'Mock Children Tab'
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
  getDirectoryWidgetsFromKey: jest.fn(
    (widgetConfig: WidgetConfig) =>
      `Mock ${widgetConfig?.i || 'unknown'} Widget`
  ),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'label.children': 'Children',
    };

    return translations[key] || key;
  }),
}));

describe('DirectoryClassBase', () => {
  let directoryClass: DirectoryClassBase;

  beforeEach(() => {
    directoryClass = new DirectoryClassBase();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize default widget heights correctly', () => {
      expect(directoryClass.defaultWidgetHeight).toEqual({
        [DetailPageWidgetKeys.DESCRIPTION]: 2,
        [DetailPageWidgetKeys.DIRECTORY_CHILDREN]: 8,
        [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
        [DetailPageWidgetKeys.TAGS]: 2,
        [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
        [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
      });
    });
  });

  describe('getDirectoryDetailPageTabs', () => {
    it('should call getDirectoryDetailsPageTabs with correct props', () => {
      const mockProps: DirectoryDetailPageTabProps = {
        childrenCount: 5,
        activityFeedTab: {} as JSX.Element,
        lineageTab: {} as JSX.Element,
        customPropertiesTab: {} as JSX.Element,
        activeTab: EntityTabs.CHILDREN,
        feedCount: { totalCount: 10 },
        labelMap: {
          [EntityTabs.CHILDREN]: 'Directory Children',
          [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
          [EntityTabs.LINEAGE]: 'Lineage',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
        } as Record<EntityTabs, string>,
      };

      const mockGetDirectoryDetailsPageTabs = jest.requireMock(
        './DirectoryDetailsUtils'
      ).getDirectoryDetailsPageTabs;
      directoryClass.getDirectoryDetailPageTabs(mockProps);

      expect(mockGetDirectoryDetailsPageTabs).toHaveBeenCalledWith(mockProps);
    });
  });

  describe('getDirectoryDetailPageTabsIds', () => {
    it('should return correct tab configuration', () => {
      const result = directoryClass.getDirectoryDetailPageTabsIds();

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: EntityTabs.CHILDREN,
        name: EntityTabs.CHILDREN,
        displayName: 'Children',
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

    it('should mark only CHILDREN tab as editable', () => {
      const result = directoryClass.getDirectoryDetailPageTabsIds();
      const childrenTab = result.find((tab) => tab.id === EntityTabs.CHILDREN);
      const otherTabs = result.filter((tab) => tab.id !== EntityTabs.CHILDREN);

      expect(childrenTab?.editable).toBe(true);

      otherTabs.forEach((tab) => {
        expect(tab.editable).toBe(false);
      });
    });
  });

  describe('getDefaultLayout', () => {
    it('should return empty layout for non-CHILDREN tabs', () => {
      const tabs = [
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CUSTOM_PROPERTIES,
      ];

      tabs.forEach((tab) => {
        const result = directoryClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });

    it('should return default layout for CHILDREN tab', () => {
      const result = directoryClass.getDefaultLayout(EntityTabs.CHILDREN);

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

      // Check directory children widget in left panel
      const childrenWidget = leftPanel.children?.[1];

      expect(childrenWidget?.i).toBe(DetailPageWidgetKeys.DIRECTORY_CHILDREN);
      expect(childrenWidget?.h).toBe(8);
    });

    it('should return default layout for undefined tab', () => {
      const result = directoryClass.getDefaultLayout(undefined);

      expect(result).toHaveLength(5);
      expect(result[0].i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
    });

    it('should include all widget types in default layout', () => {
      const result = directoryClass.getDefaultLayout(EntityTabs.CHILDREN);
      const widgetKeys = result.flatMap((widget) =>
        widget.children
          ? [widget.i, ...widget.children.map((child) => child.i)]
          : [widget.i]
      );

      expect(widgetKeys).toContain(DetailPageWidgetKeys.LEFT_PANEL);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DESCRIPTION);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DIRECTORY_CHILDREN);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DATA_PRODUCTS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.TAGS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.GLOSSARY_TERMS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.CUSTOM_PROPERTIES);
    });
  });

  describe('getAlertEnableStatus', () => {
    it('should always return false', () => {
      const result = directoryClass.getAlertEnableStatus();

      expect(result).toBe(false);
    });
  });

  describe('getDummyData', () => {
    it('should return directory dummy data', () => {
      const result = directoryClass.getDummyData();

      expect(result).toBe(DIRECTORY_DUMMY_DATA);
      expect(result.name).toBe('Test Directory');
    });
  });

  describe('getCommonWidgetList', () => {
    it('should return correct widget list', () => {
      const result = directoryClass.getCommonWidgetList();

      expect(result).toHaveLength(6);
      expect(result[0]).toBe(DESCRIPTION_WIDGET);
      expect(result[1]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.DIRECTORY_CHILDREN,
        name: 'Children',
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      });
      expect(result[2]).toBe(DATA_PRODUCTS_WIDGET);
      expect(result[3]).toBe(TAGS_WIDGET);
      expect(result[4]).toBe(GLOSSARY_TERMS_WIDGET);
      expect(result[5]).toBe(CUSTOM_PROPERTIES_WIDGET);
    });
  });

  describe('getWidgetsFromKey', () => {
    it('should call getDirectoryWidgetsFromKey with widget config', () => {
      const mockWidgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
      };

      const mockGetDirectoryWidgetsFromKey = jest.requireMock(
        './DirectoryDetailsUtils'
      ).getDirectoryWidgetsFromKey;
      directoryClass.getWidgetsFromKey(mockWidgetConfig);

      expect(mockGetDirectoryWidgetsFromKey).toHaveBeenCalledWith(
        mockWidgetConfig
      );
    });
  });

  describe('getWidgetHeight', () => {
    it('should return correct height for DESCRIPTION widget', () => {
      const result = directoryClass.getWidgetHeight(
        DetailPageWidgetKeys.DESCRIPTION
      );

      expect(result).toBe(2);
    });

    it('should return correct height for DIRECTORY_CHILDREN widget', () => {
      const result = directoryClass.getWidgetHeight(
        DetailPageWidgetKeys.DIRECTORY_CHILDREN
      );

      expect(result).toBe(8);
    });

    it('should return correct height for DATA_PRODUCTS widget', () => {
      const result = directoryClass.getWidgetHeight(
        DetailPageWidgetKeys.DATA_PRODUCTS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for TAGS widget', () => {
      const result = directoryClass.getWidgetHeight(DetailPageWidgetKeys.TAGS);

      expect(result).toBe(2);
    });

    it('should return correct height for GLOSSARY_TERMS widget', () => {
      const result = directoryClass.getWidgetHeight(
        DetailPageWidgetKeys.GLOSSARY_TERMS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for CUSTOM_PROPERTIES widget', () => {
      const result = directoryClass.getWidgetHeight(
        DetailPageWidgetKeys.CUSTOM_PROPERTIES
      );

      expect(result).toBe(4);
    });

    it('should return default height for unknown widget', () => {
      const result = directoryClass.getWidgetHeight('unknown-widget');

      expect(result).toBe(1);
    });

    it('should handle empty string widget name', () => {
      const result = directoryClass.getWidgetHeight('');

      expect(result).toBe(1);
    });
  });

  describe('singleton instance', () => {
    it('should export a default singleton instance', () => {
      expect(directoryClassBase).toBeInstanceOf(DirectoryClassBase);
    });

    it('should have same methods as new instance', () => {
      const newInstance = new DirectoryClassBase();

      expect(typeof directoryClassBase.getDirectoryDetailPageTabs).toBe(
        'function'
      );
      expect(typeof directoryClassBase.getDefaultLayout).toBe('function');
      expect(typeof directoryClassBase.getAlertEnableStatus).toBe('function');
      expect(typeof directoryClassBase.getDummyData).toBe('function');

      expect(directoryClassBase.getAlertEnableStatus()).toBe(
        newInstance.getAlertEnableStatus()
      );
      expect(directoryClassBase.getDummyData()).toBe(
        newInstance.getDummyData()
      );
    });
  });
});
