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
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { FILE_DUMMY_DATA } from '../constants/File.constant';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { File } from '../generated/entity/data/file';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import fileClassBase, { FileClassBase } from './FileClassBase';
import { FileDetailPageTabProps } from './FileDetailsUtils';

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

jest.mock('../constants/File.constant', () => ({
  FILE_DUMMY_DATA: {
    id: 'test-file-id',
    name: 'test-file.txt',
    fullyQualifiedName: 'testService.testDirectory.test-file.txt',
    description: 'Test file description',
    fileType: 'Document',
    size: 1024,
    service: { id: 'service-id', name: 'test-service', type: 'DriveService' },
  } as File,
}));

jest.mock('./CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tabId: EntityTabs) => {
    const labelMap: Partial<Record<EntityTabs, string>> = {
      [EntityTabs.OVERVIEW]: 'Overview',
      [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
      [EntityTabs.LINEAGE]: 'Lineage',
      [EntityTabs.CONTRACT]: 'Contract',
      [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
    };

    return labelMap[tabId] || tabId;
  }),
}));

jest.mock('./FileDetailsUtils', () => ({
  getFileDetailsPageTabs: jest.fn((): TabProps[] => [
    {
      label: React.createElement('div', {}, 'Overview') as JSX.Element,
      key: EntityTabs.OVERVIEW,
      children: React.createElement(
        'div',
        {},
        'Mock Overview Tab'
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
  getFileWidgetsFromKey: jest.fn(
    (widgetConfig: WidgetConfig) =>
      `Mock ${widgetConfig?.i || 'unknown'} Widget`
  ),
}));

describe('FileClassBase', () => {
  let fileClass: FileClassBase;

  beforeEach(() => {
    fileClass = new FileClassBase();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize default widget heights correctly', () => {
      expect(fileClass.defaultWidgetHeight).toEqual({
        [DetailPageWidgetKeys.DESCRIPTION]: 2,
        [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
        [DetailPageWidgetKeys.TAGS]: 2,
        [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
        [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
      });
    });
  });

  describe('getFileDetailPageTabs', () => {
    it('should call getFileDetailsPageTabs with correct props', () => {
      const mockProps: FileDetailPageTabProps = {
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
        activeTab: EntityTabs.OVERVIEW,
        feedCount: { totalCount: 5 },
        labelMap: {
          [EntityTabs.OVERVIEW]: 'File Overview',
          [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
          [EntityTabs.LINEAGE]: 'Lineage',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
        } as Record<string, string>,
      };

      const { getFileDetailsPageTabs } = jest.requireMock('./FileDetailsUtils');
      fileClass.getFileDetailPageTabs(mockProps);

      expect(getFileDetailsPageTabs).toHaveBeenCalledWith(mockProps);
    });
  });

  describe('getFileDetailPageTabsIds', () => {
    it('should return correct tab configuration', () => {
      const result = fileClass.getFileDetailPageTabsIds();

      expect(result).toHaveLength(6);
      expect(result[0]).toEqual({
        id: EntityTabs.OVERVIEW,
        name: EntityTabs.OVERVIEW,
        displayName: 'Overview',
        layout: expect.any(Array),
        editable: true,
      });
      expect(result[1]).toEqual({
        id: EntityTabs.SCHEMA,
        name: EntityTabs.SCHEMA,
        displayName: 'schema',
        layout: [],
        editable: false,
      });
      expect(result[2]).toEqual({
        id: EntityTabs.ACTIVITY_FEED,
        name: EntityTabs.ACTIVITY_FEED,
        displayName: 'Activity Feed',
        layout: [],
        editable: false,
      });
      expect(result[3]).toEqual({
        id: EntityTabs.LINEAGE,
        name: EntityTabs.LINEAGE,
        displayName: 'Lineage',
        layout: [],
        editable: false,
      });
      expect(result[4]).toEqual({
        id: EntityTabs.CONTRACT,
        name: EntityTabs.CONTRACT,
        displayName: 'Contract',
        layout: [],
        editable: false,
      });
      expect(result[5]).toEqual({
        id: EntityTabs.CUSTOM_PROPERTIES,
        name: EntityTabs.CUSTOM_PROPERTIES,
        displayName: 'Custom Properties',
        layout: [],
        editable: false,
      });
    });

    it('should mark only OVERVIEW tab as editable', () => {
      const result = fileClass.getFileDetailPageTabsIds();
      const overviewTab = result.find((tab) => tab.id === EntityTabs.OVERVIEW);
      const otherTabs = result.filter((tab) => tab.id !== EntityTabs.OVERVIEW);

      expect(overviewTab?.editable).toBe(true);

      otherTabs.forEach((tab) => {
        expect(tab.editable).toBe(false);
      });
    });
  });

  describe('getDefaultLayout', () => {
    it('should return empty layout for non-OVERVIEW tabs', () => {
      const tabs = [
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CUSTOM_PROPERTIES,
      ];

      tabs.forEach((tab) => {
        const result = fileClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });

    it('should return default layout for OVERVIEW tab', () => {
      const result = fileClass.getDefaultLayout(EntityTabs.OVERVIEW);

      expect(result).toHaveLength(5);

      // Check left panel
      const leftPanel = result[0];

      expect(leftPanel.i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
      expect(leftPanel.w).toBe(6);
      expect(leftPanel.children).toHaveLength(1);
      expect(leftPanel.static).toBe(true);

      // Check description widget in left panel
      const descriptionWidget = leftPanel.children?.[0];

      expect(descriptionWidget?.i).toBe(DetailPageWidgetKeys.DESCRIPTION);
      expect(descriptionWidget?.h).toBe(2);
    });

    it('should return default layout for undefined tab', () => {
      const result = fileClass.getDefaultLayout(undefined);

      expect(result).toHaveLength(5);
      expect(result[0].i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
    });

    it('should include all widget types in default layout', () => {
      const result = fileClass.getDefaultLayout(EntityTabs.OVERVIEW);
      const widgetKeys = result.flatMap((widget) =>
        widget.children
          ? [widget.i, ...widget.children.map((child) => child.i)]
          : [widget.i]
      );

      expect(widgetKeys).toContain(DetailPageWidgetKeys.LEFT_PANEL);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DESCRIPTION);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DATA_PRODUCTS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.TAGS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.GLOSSARY_TERMS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.CUSTOM_PROPERTIES);
    });

    it('should set correct widget positions and sizes', () => {
      const result = fileClass.getDefaultLayout(EntityTabs.OVERVIEW);

      // Check data products widget
      const dataProductsWidget = result.find(
        (w) => w.i === DetailPageWidgetKeys.DATA_PRODUCTS
      );

      expect(dataProductsWidget).toEqual({
        h: 2,
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      });

      // Check tags widget
      const tagsWidget = result.find((w) => w.i === DetailPageWidgetKeys.TAGS);

      expect(tagsWidget).toEqual({
        h: 2,
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      });
    });
  });

  describe('getAlertEnableStatus', () => {
    it('should always return false', () => {
      const result = fileClass.getAlertEnableStatus();

      expect(result).toBe(false);
    });
  });

  describe('getDummyData', () => {
    it('should return file dummy data', () => {
      const result = fileClass.getDummyData();

      expect(result).toBe(FILE_DUMMY_DATA);
      expect(result.name).toBe('test-file.txt');
      expect(result.fileType).toBe('Document');
    });
  });

  describe('getCommonWidgetList', () => {
    it('should return correct widget list', () => {
      const result = fileClass.getCommonWidgetList();

      expect(result).toHaveLength(5);
      expect(result[0]).toBe(DESCRIPTION_WIDGET);
      expect(result[1]).toBe(DATA_PRODUCTS_WIDGET);
      expect(result[2]).toBe(TAGS_WIDGET);
      expect(result[3]).toBe(GLOSSARY_TERMS_WIDGET);
      expect(result[4]).toBe(CUSTOM_PROPERTIES_WIDGET);
    });

    it('should not include file-specific widgets in common list', () => {
      const result = fileClass.getCommonWidgetList();
      const widgetNames = result.map((widget) => widget.fullyQualifiedName);

      expect(widgetNames).not.toContain(
        DetailPageWidgetKeys.DIRECTORY_CHILDREN
      );
      expect(widgetNames).not.toContain(DetailPageWidgetKeys.WORKSHEETS);
      expect(widgetNames).not.toContain(DetailPageWidgetKeys.WORKSHEET_COLUMNS);
    });
  });

  describe('getWidgetsFromKey', () => {
    it('should call getFileWidgetsFromKey with widget config', () => {
      const mockWidgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
      };

      const { getFileWidgetsFromKey } = jest.requireMock('./FileDetailsUtils');
      fileClass.getWidgetsFromKey(mockWidgetConfig);

      expect(getFileWidgetsFromKey).toHaveBeenCalledWith(mockWidgetConfig);
    });
  });

  describe('getWidgetHeight', () => {
    it('should return correct height for DESCRIPTION widget', () => {
      const result = fileClass.getWidgetHeight(
        DetailPageWidgetKeys.DESCRIPTION
      );

      expect(result).toBe(2);
    });

    it('should return correct height for DATA_PRODUCTS widget', () => {
      const result = fileClass.getWidgetHeight(
        DetailPageWidgetKeys.DATA_PRODUCTS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for TAGS widget', () => {
      const result = fileClass.getWidgetHeight(DetailPageWidgetKeys.TAGS);

      expect(result).toBe(2);
    });

    it('should return correct height for GLOSSARY_TERMS widget', () => {
      const result = fileClass.getWidgetHeight(
        DetailPageWidgetKeys.GLOSSARY_TERMS
      );

      expect(result).toBe(2);
    });

    it('should return correct height for CUSTOM_PROPERTIES widget', () => {
      const result = fileClass.getWidgetHeight(
        DetailPageWidgetKeys.CUSTOM_PROPERTIES
      );

      expect(result).toBe(4);
    });

    it('should return default height for unknown widget', () => {
      const result = fileClass.getWidgetHeight('unknown-widget');

      expect(result).toBe(1);
    });

    it('should return default height for unsupported file widget', () => {
      const result = fileClass.getWidgetHeight(
        DetailPageWidgetKeys.DIRECTORY_CHILDREN
      );

      expect(result).toBe(1);
    });

    it('should handle empty string widget name', () => {
      const result = fileClass.getWidgetHeight('');

      expect(result).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle null widget config in getWidgetsFromKey', () => {
      const nullWidgetConfig = null as unknown as WidgetConfig;

      expect(() => {
        fileClass.getWidgetsFromKey(nullWidgetConfig);
      }).not.toThrow();
    });

    it('should handle invalid tab types in getDefaultLayout', () => {
      const invalidTab = 'INVALID_TAB' as EntityTabs;
      const result = fileClass.getDefaultLayout(invalidTab);

      expect(result).toEqual([]);
    });
  });

  describe('singleton instance', () => {
    it('should export a default singleton instance', () => {
      expect(fileClassBase).toBeInstanceOf(FileClassBase);
    });

    it('should have same methods as new instance', () => {
      const newInstance = new FileClassBase();

      expect(typeof fileClassBase.getFileDetailPageTabs).toBe('function');
      expect(typeof fileClassBase.getDefaultLayout).toBe('function');
      expect(typeof fileClassBase.getAlertEnableStatus).toBe('function');
      expect(typeof fileClassBase.getDummyData).toBe('function');

      expect(fileClassBase.getAlertEnableStatus()).toBe(
        newInstance.getAlertEnableStatus()
      );
      expect(fileClassBase.getDummyData()).toBe(newInstance.getDummyData());
    });
  });
});
