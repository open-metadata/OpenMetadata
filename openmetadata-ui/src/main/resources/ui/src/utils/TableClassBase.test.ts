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
  KNOWLEDGE_ARTICLE_WIDGET,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { TABLE_DUMMY_DATA } from '../constants/Table.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Table } from '../generated/entity/data/table';
import { useApplicationStore } from '../hooks/useApplicationStore';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import tableClassBase, {
  TableClassBase,
  TableDetailPageTabProps,
} from './TableClassBase';

jest.mock('../constants/Table.constants', () => ({
  TABLE_DUMMY_DATA: {
    id: 'test-table-id',
    name: 'Test Table',
    fullyQualifiedName: 'testService.testDb.testSchema.testTable',
    description: 'Test table description',
    columns: [],
    service: {
      id: 'service-id',
      name: 'test-service',
      type: 'DatabaseService',
    },
    databaseSchema: {
      id: 'schema-id',
      name: 'test-schema',
      type: 'DatabaseSchema',
    },
  } as Table,
}));

jest.mock('./TableTabsUtils', () => ({
  getTableDetailPageBaseTabs: jest.fn((): TabProps[] => [
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
  ]),
  getTableWidgetFromKey: jest.fn(
    (widgetConfig: WidgetConfig) =>
      `Mock ${widgetConfig?.i || 'unknown'} Widget`
  ),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'label.schema': 'Schema',
      'label.asset-health': 'Asset Health',
      'label.frequently-joined-table-plural': 'Frequently Joined Tables',
      'label.table-constraints': 'Table Constraints',
      'label.article-plural': 'Articles',
    };

    return translations[key] || key;
  }),
}));

jest.mock('../hooks/useApplicationStore', () => ({
  useApplicationStore: {
    getState: jest.fn(() => ({ rdfEnabled: false })),
  },
}));

describe('TableClassBase', () => {
  let tableClass: TableClassBase;

  beforeEach(() => {
    tableClass = new TableClassBase();
    jest.clearAllMocks();
    (useApplicationStore.getState as jest.Mock).mockReturnValue({
      rdfEnabled: false,
    });
  });

  describe('constructor', () => {
    it('should initialize default widget heights correctly', () => {
      expect(tableClass.defaultWidgetHeight).toEqual({
        [DetailPageWidgetKeys.DESCRIPTION]: 2,
        [DetailPageWidgetKeys.TABLE_SCHEMA]: 8.5,
        [DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]: 2,
        [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
        [DetailPageWidgetKeys.TAGS]: 2,
        [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
        [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
        [DetailPageWidgetKeys.KNOWLEDGE_ARTICLE]: 2,
        [DetailPageWidgetKeys.TABLE_CONSTRAINTS]: 2,
        [DetailPageWidgetKeys.PARTITIONED_KEYS]: 2,
        [DetailPageWidgetKeys.ASSET_HEALTH]: 3,
      });
    });
  });

  describe('getTableDetailPageTabs', () => {
    it('should call getTableDetailPageBaseTabs with correct props', () => {
      const mockProps: TableDetailPageTabProps = {
        queryCount: 5,
        isQueryCountLoading: false,
        isTourOpen: false,
        activeTab: EntityTabs.SCHEMA,
        feedCount: {
          conversationCount: 0,
          activityCount: 0,
          totalTasksCount: 0,
          openTaskCount: 0,
          closedTaskCount: 0,
          totalCount: 12,
          mentionCount: 0,
        },
        isViewTableType: false,
        viewAllPermission: true,
        viewCustomPropertiesPermission: true,
        viewQueriesPermission: true,
        editLineagePermission: true,
        viewProfilerPermission: true,
        viewSampleDataPermission: true,
        tablePermissions: {
          ViewAll: true,
          EditAll: true,
        } as TableDetailPageTabProps['tablePermissions'],
        editCustomAttributePermission: true,
        getEntityFeedCount: jest.fn(),
        fetchTableDetails: jest.fn(),
        handleFeedCount: jest.fn(),
      };

      const { getTableDetailPageBaseTabs } =
        jest.requireMock('./TableTabsUtils');
      tableClass.getTableDetailPageTabs(mockProps);

      expect(getTableDetailPageBaseTabs).toHaveBeenCalledWith(mockProps);
    });
  });

  describe('getTableDetailPageTabsIds', () => {
    it('should return correct tab configuration when rdf is disabled', () => {
      const result = tableClass.getTableDetailPageTabsIds();

      expect(result).toHaveLength(10);
      expect(result[0]).toEqual({
        id: EntityTabs.SCHEMA,
        name: EntityTabs.SCHEMA,
        layout: expect.any(Array),
        editable: true,
      });
      expect(result[1]).toEqual({
        id: EntityTabs.ACTIVITY_FEED,
        name: EntityTabs.ACTIVITY_FEED,
        layout: [],
        editable: false,
      });
      expect(result[2]).toEqual({
        id: EntityTabs.SAMPLE_DATA,
        name: EntityTabs.SAMPLE_DATA,
        layout: [],
        editable: false,
      });
      expect(result[3]).toEqual({
        id: EntityTabs.TABLE_QUERIES,
        name: EntityTabs.TABLE_QUERIES,
        layout: [],
        editable: false,
      });
      expect(result[4]).toEqual({
        id: EntityTabs.PROFILER,
        name: EntityTabs.PROFILER,
        layout: [],
        editable: false,
      });
      expect(result[5]).toEqual({
        id: EntityTabs.LINEAGE,
        name: EntityTabs.LINEAGE,
        layout: [],
        editable: false,
      });
      expect(result[6]).toEqual({
        id: EntityTabs.DBT,
        name: EntityTabs.DBT,
        layout: [],
        editable: false,
      });
      expect(result[7]).toEqual({
        id: EntityTabs.VIEW_DEFINITION,
        name: EntityTabs.VIEW_DEFINITION,
        layout: [],
        editable: false,
      });
      expect(result[8]).toEqual({
        id: EntityTabs.CONTRACT,
        name: EntityTabs.CONTRACT,
        layout: [],
        editable: false,
      });
      expect(result[9]).toEqual({
        id: EntityTabs.CUSTOM_PROPERTIES,
        name: EntityTabs.CUSTOM_PROPERTIES,
        layout: [],
        editable: false,
      });
    });

    it('should include the KNOWLEDGE_GRAPH tab when rdf is enabled', () => {
      (useApplicationStore.getState as jest.Mock).mockReturnValue({
        rdfEnabled: true,
      });

      const result = tableClass.getTableDetailPageTabsIds();

      expect(result).toHaveLength(11);
      expect(result[6]).toEqual({
        id: EntityTabs.KNOWLEDGE_GRAPH,
        name: EntityTabs.KNOWLEDGE_GRAPH,
        layout: [],
        editable: false,
      });
    });

    it('should mark only SCHEMA tab as editable', () => {
      const result = tableClass.getTableDetailPageTabsIds();
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
        EntityTabs.PROFILER,
      ];

      tabs.forEach((tab) => {
        const result = tableClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });

    it('should return default layout for SCHEMA tab', () => {
      const result = tableClass.getDefaultLayout(EntityTabs.SCHEMA);

      expect(result).toHaveLength(10);

      const leftPanel = result[0];

      expect(leftPanel.i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
      expect(leftPanel.w).toBe(6);
      expect(leftPanel.children).toHaveLength(2);
      expect(leftPanel.static).toBe(true);
    });

    it('should return default layout for undefined tab', () => {
      const result = tableClass.getDefaultLayout(undefined);

      expect(result).toHaveLength(10);
      expect(result[0].i).toBe(DetailPageWidgetKeys.LEFT_PANEL);
    });

    it('should include description and table schema widgets in the left panel', () => {
      const result = tableClass.getDefaultLayout(EntityTabs.SCHEMA);
      const leftPanel = result[0];
      const descriptionWidget = leftPanel.children?.[0];
      const tableSchemaWidget = leftPanel.children?.[1];

      expect(descriptionWidget?.i).toBe(DetailPageWidgetKeys.DESCRIPTION);
      expect(descriptionWidget?.h).toBe(2);

      expect(tableSchemaWidget?.i).toBe(DetailPageWidgetKeys.TABLE_SCHEMA);
      expect(tableSchemaWidget?.h).toBe(8.5);
    });

    it('should include all expected widget types in the default layout', () => {
      const result = tableClass.getDefaultLayout(EntityTabs.SCHEMA);
      const widgetKeys = result.flatMap((widget) =>
        widget.children
          ? [widget.i, ...widget.children.map((child) => child.i)]
          : [widget.i]
      );

      expect(widgetKeys).toContain(DetailPageWidgetKeys.LEFT_PANEL);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DESCRIPTION);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.TABLE_SCHEMA);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.DATA_PRODUCTS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.TAGS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.GLOSSARY_TERMS);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.CUSTOM_PROPERTIES);
      expect(widgetKeys).toContain(DetailPageWidgetKeys.KNOWLEDGE_ARTICLE);
    });

    it('should calculate correct left panel height', () => {
      const result = tableClass.getDefaultLayout(EntityTabs.SCHEMA);
      const leftPanel = result[0];
      const expectedHeight =
        tableClass.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] +
        tableClass.defaultWidgetHeight[DetailPageWidgetKeys.TABLE_SCHEMA] +
        0.5;

      expect(leftPanel.h).toBe(expectedHeight);
      expect(leftPanel.h).toBe(11); // 2 + 8.5 + 0.5
    });

    it('should ensure all widgets are non-static except left panel', () => {
      const result = tableClass.getDefaultLayout(EntityTabs.SCHEMA);
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

      leftPanel?.children?.forEach((child) => {
        expect(child.static).toBe(false);
      });
    });
  });

  describe('getAlertEnableStatus', () => {
    it('should always return false', () => {
      const result = tableClass.getAlertEnableStatus();

      expect(result).toBe(false);
    });
  });

  describe('getShowRequestDataAccess', () => {
    it('should always return false', () => {
      const result = tableClass.getShowRequestDataAccess();

      expect(result).toBe(false);
    });
  });

  describe('getRequestDataAccessBanner', () => {
    it('should always return null', () => {
      const result = tableClass.getRequestDataAccessBanner();

      expect(result).toBeNull();
    });
  });

  describe('getRequestDataAccessButton', () => {
    it('should always return null', () => {
      const result = tableClass.getRequestDataAccessButton();

      expect(result).toBeNull();
    });
  });

  describe('getRequestDataAccessDrawer', () => {
    it('should always return null', () => {
      const result = tableClass.getRequestDataAccessDrawer(
        true,
        jest.fn(),
        'fqn',
        'name',
        'table',
        jest.fn()
      );

      expect(result).toBeNull();
    });
  });

  describe('getDummyData', () => {
    it('should return table dummy data', () => {
      const result = tableClass.getDummyData();

      expect(result).toBe(TABLE_DUMMY_DATA);
      expect(result.name).toBe('Test Table');
    });
  });

  describe('getCommonWidgetList', () => {
    it('should return correct widget list', () => {
      const result = tableClass.getCommonWidgetList();

      expect(result).toHaveLength(10);
      expect(result[0]).toBe(DESCRIPTION_WIDGET);
      expect(result[1]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.TABLE_SCHEMA,
        name: 'Schema',
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      });
      expect(result[2]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.ASSET_HEALTH,
        name: 'Asset Health',
        data: {
          gridSizes: ['small'] as GridSizes[],
        },
      });
      expect(result[3]).toBe(DATA_PRODUCTS_WIDGET);
      expect(result[4]).toBe(TAGS_WIDGET);
      expect(result[5]).toBe(GLOSSARY_TERMS_WIDGET);
      expect(result[6]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
        name: 'Frequently Joined Tables',
        data: {
          gridSizes: ['small'] as GridSizes[],
        },
      });
      expect(result[7]).toEqual({
        fullyQualifiedName: DetailPageWidgetKeys.TABLE_CONSTRAINTS,
        name: 'Table Constraints',
        data: {
          gridSizes: ['small'] as GridSizes[],
        },
      });
      expect(result[8]).toBe(CUSTOM_PROPERTIES_WIDGET);
      expect(result[9]).toBe(KNOWLEDGE_ARTICLE_WIDGET);
    });

    it('should not duplicate the Knowledge Article widget', () => {
      const result = tableClass.getCommonWidgetList();
      const knowledgeArticleEntries = result.filter(
        (w) => w.fullyQualifiedName === DetailPageWidgetKeys.KNOWLEDGE_ARTICLE
      );

      expect(knowledgeArticleEntries).toHaveLength(1);
      expect(result[result.length - 1]).toBe(KNOWLEDGE_ARTICLE_WIDGET);
    });

    it('fullyQualifiedName values should be unique across the list', () => {
      const result = tableClass.getCommonWidgetList();
      const fqns = result.map((w) => w.fullyQualifiedName);
      const uniqueFqns = new Set(fqns);

      expect(uniqueFqns.size).toBe(fqns.length);
      expect(fqns.length).toBe(result.length);
    });

    it('should include the Knowledge Article widget with correct configuration matching the shared constant', () => {
      const result = tableClass.getCommonWidgetList();
      const knowledgeArticleWidget = result.find(
        (w) => w.fullyQualifiedName === DetailPageWidgetKeys.KNOWLEDGE_ARTICLE
      );

      expect(knowledgeArticleWidget).toBe(KNOWLEDGE_ARTICLE_WIDGET);
      expect(knowledgeArticleWidget?.data.gridSizes).toEqual(['large']);
    });
  });

  describe('getWidgetsFromKey', () => {
    it('should call getTableWidgetFromKey with widget config', () => {
      const mockWidgetConfig: WidgetConfig = {
        h: 8,
        i: DetailPageWidgetKeys.TABLE_SCHEMA,
        w: 6,
        x: 0,
        y: 1,
      };

      const { getTableWidgetFromKey } = jest.requireMock('./TableTabsUtils');
      tableClass.getWidgetsFromKey(mockWidgetConfig);

      expect(getTableWidgetFromKey).toHaveBeenCalledWith(mockWidgetConfig);
    });
  });

  describe('getWidgetHeight', () => {
    it('should return correct height for DESCRIPTION widget', () => {
      expect(tableClass.getWidgetHeight(DetailPageWidgetKeys.DESCRIPTION)).toBe(
        2
      );
    });

    it('should return correct height for TABLE_SCHEMA widget', () => {
      expect(
        tableClass.getWidgetHeight(DetailPageWidgetKeys.TABLE_SCHEMA)
      ).toBe(8.5);
    });

    it('should return correct height for FREQUENTLY_JOINED_TABLES widget', () => {
      expect(
        tableClass.getWidgetHeight(
          DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES
        )
      ).toBe(2);
    });

    it('should return correct height for DATA_PRODUCTS widget', () => {
      expect(
        tableClass.getWidgetHeight(DetailPageWidgetKeys.DATA_PRODUCTS)
      ).toBe(2);
    });

    it('should return correct height for TAGS widget', () => {
      expect(tableClass.getWidgetHeight(DetailPageWidgetKeys.TAGS)).toBe(2);
    });

    it('should return correct height for GLOSSARY_TERMS widget', () => {
      expect(
        tableClass.getWidgetHeight(DetailPageWidgetKeys.GLOSSARY_TERMS)
      ).toBe(2);
    });

    it('should return correct height for TABLE_CONSTRAINTS widget', () => {
      expect(
        tableClass.getWidgetHeight(DetailPageWidgetKeys.TABLE_CONSTRAINTS)
      ).toBe(2);
    });

    it('should return correct height for PARTITIONED_KEYS widget', () => {
      expect(
        tableClass.getWidgetHeight(DetailPageWidgetKeys.PARTITIONED_KEYS)
      ).toBe(2);
    });

    it('should return correct height for ASSET_HEALTH widget', () => {
      expect(
        tableClass.getWidgetHeight(DetailPageWidgetKeys.ASSET_HEALTH)
      ).toBe(3);
    });

    it('should return default height for unknown widget', () => {
      expect(tableClass.getWidgetHeight('unknown-widget')).toBe(1);
    });

    it('should handle empty string widget name', () => {
      expect(tableClass.getWidgetHeight('')).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle null widget config in getWidgetsFromKey', () => {
      const nullWidgetConfig = null as unknown as WidgetConfig;

      expect(() => {
        tableClass.getWidgetsFromKey(nullWidgetConfig);
      }).not.toThrow();
    });

    it('should handle invalid tab types in getDefaultLayout', () => {
      const invalidTab = 'INVALID_TAB' as EntityTabs;
      const result = tableClass.getDefaultLayout(invalidTab);

      expect(result).toEqual([]);
    });

    it('should handle other valid tabs correctly', () => {
      const validTabs = [
        EntityTabs.OVERVIEW,
        EntityTabs.SAMPLE_DATA,
        EntityTabs.PROFILER,
      ];

      validTabs.forEach((tab) => {
        const result = tableClass.getDefaultLayout(tab);

        expect(result).toEqual([]);
      });
    });
  });

  describe('singleton instance', () => {
    it('should export a default singleton instance', () => {
      expect(tableClassBase).toBeInstanceOf(TableClassBase);
    });

    it('should have same methods as new instance', () => {
      const newInstance = new TableClassBase();

      expect(typeof tableClassBase.getTableDetailPageTabs).toBe('function');
      expect(typeof tableClassBase.getDefaultLayout).toBe('function');
      expect(typeof tableClassBase.getAlertEnableStatus).toBe('function');
      expect(typeof tableClassBase.getDummyData).toBe('function');

      expect(tableClassBase.getAlertEnableStatus()).toBe(
        newInstance.getAlertEnableStatus()
      );
      expect(tableClassBase.getDummyData()).toBe(newInstance.getDummyData());
    });
  });
});
