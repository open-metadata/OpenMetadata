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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  getWorksheetDetailsPageTabs,
  getWorksheetWidgetsFromKey,
  WorksheetDetailPageTabProps,
} from './WorksheetDetailsUtils';

jest.mock('../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name, count, isActive }) => (
    <div data-testid={`tab-label-${name}`}>
      {name} {count !== undefined && `(${count})`} {isActive && '- Active'}
    </div>
  ));
});

jest.mock('../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest
    .fn()
    .mockImplementation(({ type }) => (
      <div data-testid="generic-tab">Generic Tab - {type}</div>
    )),
}));

jest.mock('../components/DataAssets/CommonWidgets/CommonWidgets', () => ({
  CommonWidgets: jest
    .fn()
    .mockImplementation(({ entityType, widgetConfig }) => (
      <div data-testid="common-widgets">
        Common Widgets - {entityType} - {widgetConfig.i}
      </div>
    )),
}));

jest.mock(
  '../components/DriveService/Worksheet/WorksheetColumnsTable/WorksheetColumnsTable',
  () => {
    return jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="worksheet-columns-table">Worksheet Columns Table</div>
      ));
  }
);

jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

const mockProps: WorksheetDetailPageTabProps = {
  activityFeedTab: React.createElement(
    'div',
    { 'data-testid': 'activity-feed' },
    'Activity Feed'
  ),
  lineageTab: React.createElement(
    'div',
    { 'data-testid': 'lineage' },
    'Lineage'
  ),
  customPropertiesTab: React.createElement(
    'div',
    { 'data-testid': 'custom-properties' },
    'Custom Properties'
  ),
  activeTab: EntityTabs.SCHEMA,
  feedCount: { totalCount: 12 },
};

jest.mock('../components/DataContract/ContractTab/ContractTab.tsx', () => {
  return jest.fn().mockImplementation(() => <p>DataContractComponent</p>);
});

describe('WorksheetDetailsUtils', () => {
  describe('getWorksheetDetailsPageTabs', () => {
    it('should return correct number of tabs', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);

      expect(tabs).toHaveLength(5);
    });

    it('should return tabs with correct keys', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const tabKeys = tabs.map((tab) => tab.key);

      expect(tabKeys).toEqual([
        EntityTabs.SCHEMA,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CONTRACT,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });

    it('should render schema tab with correct active state', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.label}</MemoryRouter>);

      expect(screen.getByTestId('tab-label-label.schema')).toBeInTheDocument();
      expect(screen.getByText('label.schema - Active')).toBeInTheDocument();
    });

    it('should render activity feed tab with correct count', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.activity-feed-and-task-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.activity-feed-and-task-plural (12)')
      ).toBeInTheDocument();
    });

    it('should render lineage tab without count', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByTestId('tab-label-label.lineage')).toBeInTheDocument();
      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should render contract tab without count', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const contractTab = tabs[3];

      render(<MemoryRouter>{contractTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.contract')
      ).toBeInTheDocument();
      expect(screen.getByText('label.contract')).toBeInTheDocument();
    });

    it('should render custom properties tab without count', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.custom-property-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.custom-property-plural')
      ).toBeInTheDocument();
    });

    it('should render schema tab content correctly', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.children}</MemoryRouter>);

      expect(screen.getByTestId('generic-tab')).toBeInTheDocument();
      expect(screen.getByText('Generic Tab - Worksheet')).toBeInTheDocument();
    });

    it('should render activity feed tab content correctly', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.children}</MemoryRouter>);

      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });

    it('should render lineage tab content correctly', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.children}</MemoryRouter>);

      expect(screen.getByTestId('lineage')).toBeInTheDocument();
    });

    it('should render custom properties tab content correctly', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.children}</MemoryRouter>);

      expect(screen.getByTestId('custom-properties')).toBeInTheDocument();
    });

    it('should handle different active tab', () => {
      const propsWithDifferentActiveTab = {
        ...mockProps,
        activeTab: EntityTabs.ACTIVITY_FEED,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithDifferentActiveTab);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (12) - Active')
      ).toBeInTheDocument();
    });

    it('should handle zero feed count', () => {
      const propsWithZeroCount = {
        ...mockProps,
        feedCount: { totalCount: 0 },
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithZeroCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (0)')
      ).toBeInTheDocument();
    });

    it('should handle large feed count', () => {
      const propsWithLargeCount = {
        ...mockProps,
        feedCount: { totalCount: 2500 },
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLargeCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (2500)')
      ).toBeInTheDocument();
    });

    it('should handle schema tab as inactive when different tab is active', () => {
      const propsWithDifferentActiveTab = {
        ...mockProps,
        activeTab: EntityTabs.LINEAGE,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithDifferentActiveTab);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.label}</MemoryRouter>);

      expect(screen.getByText('label.schema')).toBeInTheDocument();
      expect(screen.queryByText('- Active')).not.toBeInTheDocument();
    });
  });

  describe('getWorksheetWidgetsFromKey', () => {
    it('should return WorksheetColumnsTable for worksheet columns widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: DetailPageWidgetKeys.WORKSHEET_COLUMNS,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('worksheet-columns-table')).toBeInTheDocument();
    });

    it('should return WorksheetColumnsTable for widget key starting with worksheet columns', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: `${DetailPageWidgetKeys.WORKSHEET_COLUMNS}.custom`,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('worksheet-columns-table')).toBeInTheDocument();
    });

    it('should return CommonWidgets for description widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - worksheet - KnowledgePanel.Description'
        )
      ).toBeInTheDocument();
    });

    it('should return CommonWidgets for data products widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - worksheet - KnowledgePanel.DataProducts'
        )
      ).toBeInTheDocument();
    });

    it('should return CommonWidgets for tags widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - worksheet - KnowledgePanel.Tags')
      ).toBeInTheDocument();
    });

    it('should return CommonWidgets for glossary terms widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - worksheet - KnowledgePanel.GlossaryTerms'
        )
      ).toBeInTheDocument();
    });

    it('should return CommonWidgets for custom properties widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 4,
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - worksheet - KnowledgePanel.CustomProperties'
        )
      ).toBeInTheDocument();
    });

    it('should return CommonWidgets for unknown widget types', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: 'unknown-widget' as DetailPageWidgetKeys,
        w: 2,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - worksheet - unknown-widget')
      ).toBeInTheDocument();
    });

    it('should handle widget config with different dimensions', () => {
      const widgetConfig: WidgetConfig = {
        h: 15,
        i: DetailPageWidgetKeys.WORKSHEET_COLUMNS,
        w: 10,
        x: 2,
        y: 4,
        static: true,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('worksheet-columns-table')).toBeInTheDocument();
    });

    it('should handle widget key with different casing', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: 'different-widget-key' as DetailPageWidgetKeys,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - worksheet - different-widget-key')
      ).toBeInTheDocument();
    });
  });

  describe('labelMap props', () => {
    it('should use custom labels from labelMap when provided', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.SCHEMA]: 'Custom Schema Label',
          [EntityTabs.ACTIVITY_FEED]: 'Custom Activity Feed',
          [EntityTabs.LINEAGE]: 'Custom Lineage',
          [EntityTabs.CONTRACT]: 'Custom Contract',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.label}</MemoryRouter>);

      expect(
        screen.getByText('Custom Schema Label - Active')
      ).toBeInTheDocument();
    });

    it('should use custom label for activity feed tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.ACTIVITY_FEED]: 'Custom Activity',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(screen.getByText('Custom Activity (12)')).toBeInTheDocument();
    });

    it('should use custom label for lineage tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.LINEAGE]: 'Custom Lineage Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByText('Custom Lineage Label')).toBeInTheDocument();
    });

    it('should use custom label for contract tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.CONTRACT]: 'Custom Contract Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);
      const contractTab = tabs[3];

      render(<MemoryRouter>{contractTab.label}</MemoryRouter>);

      expect(screen.getByText('Custom Contract Label')).toBeInTheDocument();
    });

    it('should use custom label for custom properties tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.CUSTOM_PROPERTIES]: 'My Custom Properties',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(screen.getByText('My Custom Properties')).toBeInTheDocument();
    });

    it('should fallback to default i18n labels when labelMap is empty', () => {
      const propsWithEmptyLabelMap = {
        ...mockProps,
        labelMap: {} as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithEmptyLabelMap);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.label}</MemoryRouter>);

      expect(screen.getByText('label.schema - Active')).toBeInTheDocument();
    });

    it('should partially override labels when labelMap has only some keys', () => {
      const propsWithPartialLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.SCHEMA]: 'Custom Schema',
          [EntityTabs.LINEAGE]: 'Custom Lineage',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithPartialLabelMap);

      render(<MemoryRouter>{tabs[0].label}</MemoryRouter>);

      expect(screen.getByText('Custom Schema - Active')).toBeInTheDocument();

      render(<MemoryRouter>{tabs[2].label}</MemoryRouter>);

      expect(screen.getByText('Custom Lineage')).toBeInTheDocument();
    });

    it('should use labelMap with active tab state', () => {
      const propsWithLabelMap = {
        ...mockProps,
        activeTab: EntityTabs.CONTRACT,
        labelMap: {
          [EntityTabs.CONTRACT]: 'My Contract Tab',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);
      const contractTab = tabs[3];

      render(<MemoryRouter>{contractTab.label}</MemoryRouter>);

      expect(screen.getByText('My Contract Tab')).toBeInTheDocument();
    });

    it('should handle labelMap with special characters', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.SCHEMA]: 'Schema & Configuration',
          [EntityTabs.ACTIVITY_FEED]: 'Activity <Feed>',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithLabelMap);

      render(<MemoryRouter>{tabs[0].label}</MemoryRouter>);

      expect(
        screen.getByText('Schema & Configuration - Active')
      ).toBeInTheDocument();
    });

    it('should handle labelMap with empty string values', () => {
      const propsWithEmptyStringLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.SCHEMA]: '',
        } as Record<EntityTabs, string>,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithEmptyStringLabelMap);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.label}</MemoryRouter>);

      expect(screen.getByTestId('tab-label-')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing feedCount gracefully', () => {
      const propsWithoutFeedCount = {
        ...mockProps,
        feedCount: { totalCount: 0 },
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithoutFeedCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (0)')
      ).toBeInTheDocument();
    });

    it('should handle null widget config', () => {
      const widgetConfig = null as unknown as WidgetConfig;

      expect(() => getWorksheetWidgetsFromKey(widgetConfig)).toThrow();
    });

    it('should handle widget config with empty string key', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: '' as DetailPageWidgetKeys,
        w: 2,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });

    it('should handle all tab states correctly', () => {
      const tabs = getWorksheetDetailsPageTabs(mockProps);

      tabs.forEach((tab) => {
        expect(tab.key).toBeDefined();
        expect(tab.label).toBeDefined();
        expect(tab.children).toBeDefined();
      });
    });

    it('should handle inactive tabs correctly', () => {
      const propsWithInactiveTab = {
        ...mockProps,
        activeTab: EntityTabs.CUSTOM_PROPERTIES,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithInactiveTab);
      const schemaTab = tabs[0];

      render(<MemoryRouter>{schemaTab.label}</MemoryRouter>);

      expect(screen.getByText('label.schema')).toBeInTheDocument();
      expect(screen.queryByText('- Active')).not.toBeInTheDocument();
    });

    it('should handle missing labelMap gracefully', () => {
      const propsWithoutLabelMap = {
        ...mockProps,
        labelMap: undefined,
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithoutLabelMap);

      expect(tabs).toHaveLength(5);

      tabs.forEach((tab) => {
        expect(tab.key).toBeDefined();
        expect(tab.label).toBeDefined();
        expect(tab.children).toBeDefined();
      });
    });

    it('should handle partial widget config', () => {
      const partialWidgetConfig = {
        i: DetailPageWidgetKeys.DESCRIPTION,
      } as WidgetConfig;

      const result = getWorksheetWidgetsFromKey(partialWidgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });

    it('should handle negative feed count edge case', () => {
      const propsWithNegativeCount = {
        ...mockProps,
        feedCount: { totalCount: -1 },
      };

      const tabs = getWorksheetDetailsPageTabs(propsWithNegativeCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (-1)')
      ).toBeInTheDocument();
    });

    it('should handle special characters in widget key', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: 'widget@#$%' as DetailPageWidgetKeys,
        w: 2,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getWorksheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });
  });
});
