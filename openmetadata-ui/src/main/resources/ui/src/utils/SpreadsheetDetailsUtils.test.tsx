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
  getSpreadsheetDetailsPageTabs,
  getSpreadsheetWidgetsFromKey,
  SpreadsheetDetailPageTabProps,
} from './SpreadsheetDetailsUtils';

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
  '../components/DriveService/Spreadsheet/WorkflowsTable/WorkflowsTable',
  () => {
    return jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="workflows-table">Workflows Table</div>
      ));
  }
);

jest.mock('../components/DataContract/ContractTab/ContractTab.tsx', () => {
  return jest.fn().mockImplementation(() => <p>DataContractComponent</p>);
});

jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

const mockProps: SpreadsheetDetailPageTabProps = {
  childrenCount: 8,
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
  activeTab: EntityTabs.WORKSHEETS,
  feedCount: { totalCount: 25 },
};

describe('SpreadsheetDetailsUtils', () => {
  describe('getSpreadsheetDetailsPageTabs', () => {
    it('should return correct number of tabs', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);

      expect(tabs).toHaveLength(5);
    });

    it('should return tabs with correct keys', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const tabKeys = tabs.map((tab) => tab.key);

      expect(tabKeys).toEqual([
        EntityTabs.WORKSHEETS,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CONTRACT,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });

    it('should render worksheets tab with correct count and active state', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.worksheet-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.worksheet-plural (8) - Active')
      ).toBeInTheDocument();
    });

    it('should render activity feed tab with correct count', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.activity-feed-and-task-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.activity-feed-and-task-plural (25)')
      ).toBeInTheDocument();
    });

    it('should render lineage tab without count', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByTestId('tab-label-label.lineage')).toBeInTheDocument();
      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should render contract tab without count', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const contractTab = tabs[3];

      render(<MemoryRouter>{contractTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.contract')
      ).toBeInTheDocument();
      expect(screen.getByText('label.contract')).toBeInTheDocument();
    });

    it('should render custom properties tab without count', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.custom-property-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.custom-property-plural')
      ).toBeInTheDocument();
    });

    it('should render worksheets tab content correctly', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.children}</MemoryRouter>);

      expect(screen.getByTestId('generic-tab')).toBeInTheDocument();
      expect(screen.getByText('Generic Tab - Spreadsheet')).toBeInTheDocument();
    });

    it('should render activity feed tab content correctly', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.children}</MemoryRouter>);

      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });

    it('should render lineage tab content correctly', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.children}</MemoryRouter>);

      expect(screen.getByTestId('lineage')).toBeInTheDocument();
    });

    it('should render custom properties tab content correctly', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.children}</MemoryRouter>);

      expect(screen.getByTestId('custom-properties')).toBeInTheDocument();
    });

    it('should handle different active tab', () => {
      const propsWithDifferentActiveTab = {
        ...mockProps,
        activeTab: EntityTabs.LINEAGE,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithDifferentActiveTab);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should handle zero children count', () => {
      const propsWithZeroCount = {
        ...mockProps,
        childrenCount: 0,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithZeroCount);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.worksheet-plural (0) - Active')
      ).toBeInTheDocument();
    });

    it('should handle undefined children count', () => {
      const propsWithUndefinedCount = {
        ...mockProps,
        childrenCount: undefined as unknown as number,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithUndefinedCount);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.worksheet-plural (0) - Active')
      ).toBeInTheDocument();
    });

    it('should handle large children count', () => {
      const propsWithLargeCount = {
        ...mockProps,
        childrenCount: 1000,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithLargeCount);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.worksheet-plural (1000) - Active')
      ).toBeInTheDocument();
    });
  });

  describe('getSpreadsheetWidgetsFromKey', () => {
    it('should return WorkflowsTable for worksheets widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: DetailPageWidgetKeys.WORKSHEETS,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('workflows-table')).toBeInTheDocument();
    });

    it('should return WorkflowsTable for widget key starting with worksheets', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: `${DetailPageWidgetKeys.WORKSHEETS}.custom`,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('workflows-table')).toBeInTheDocument();
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - spreadsheet - KnowledgePanel.Description'
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - spreadsheet - KnowledgePanel.DataProducts'
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - spreadsheet - KnowledgePanel.Tags')
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - spreadsheet - KnowledgePanel.GlossaryTerms'
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - spreadsheet - KnowledgePanel.CustomProperties'
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - spreadsheet - unknown-widget')
      ).toBeInTheDocument();
    });

    it('should handle widget config with different dimensions', () => {
      const widgetConfig: WidgetConfig = {
        h: 12,
        i: DetailPageWidgetKeys.WORKSHEETS,
        w: 8,
        x: 1,
        y: 3,
        static: true,
      };

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('workflows-table')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing feedCount gracefully', () => {
      const propsWithoutFeedCount = {
        ...mockProps,
        feedCount: { totalCount: 0 },
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithoutFeedCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (0)')
      ).toBeInTheDocument();
    });

    it('should handle null widget config', () => {
      const widgetConfig = null as unknown as WidgetConfig;

      expect(() => getSpreadsheetWidgetsFromKey(widgetConfig)).toThrow();
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

      const result = getSpreadsheetWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });

    it('should handle all tab states correctly', () => {
      const tabs = getSpreadsheetDetailsPageTabs(mockProps);

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

      const tabs = getSpreadsheetDetailsPageTabs(propsWithInactiveTab);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.worksheet-plural (8)')
      ).toBeInTheDocument();
      expect(screen.queryByText('- Active')).not.toBeInTheDocument();
    });

    it('should handle partial widget config', () => {
      const partialWidgetConfig = {
        i: DetailPageWidgetKeys.DESCRIPTION,
      } as WidgetConfig;

      const result = getSpreadsheetWidgetsFromKey(partialWidgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });
  });

  describe('labelMap props', () => {
    it('should use custom labels from labelMap when provided', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.WORKSHEETS]: 'Custom Worksheets Label',
          [EntityTabs.ACTIVITY_FEED]: 'Custom Activity Feed',
          [EntityTabs.LINEAGE]: 'Custom Lineage',
          [EntityTabs.CONTRACT]: 'Custom Contract',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithLabelMap);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('Custom Worksheets Label (8) - Active')
      ).toBeInTheDocument();
    });

    it('should use custom label for activity feed tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.ACTIVITY_FEED]: 'Custom Activity',
        } as Record<EntityTabs, string>,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithLabelMap);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(screen.getByText('Custom Activity (25)')).toBeInTheDocument();
    });

    it('should use custom label for lineage tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.LINEAGE]: 'Custom Lineage Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithLabelMap);
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

      const tabs = getSpreadsheetDetailsPageTabs(propsWithLabelMap);
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

      const tabs = getSpreadsheetDetailsPageTabs(propsWithLabelMap);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(screen.getByText('My Custom Properties')).toBeInTheDocument();
    });

    it('should fallback to default i18n labels when labelMap is empty', () => {
      const propsWithEmptyLabelMap = {
        ...mockProps,
        labelMap: {} as Record<EntityTabs, string>,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithEmptyLabelMap);
      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.worksheet-plural (8) - Active')
      ).toBeInTheDocument();
    });

    it('should use partial labelMap and fallback to defaults for missing keys', () => {
      const propsWithPartialLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.WORKSHEETS]: 'Custom Worksheets',
          [EntityTabs.CONTRACT]: 'Custom Contract',
        } as Record<EntityTabs, string>,
      };

      const tabs = getSpreadsheetDetailsPageTabs(propsWithPartialLabelMap);

      const worksheetsTab = tabs[0];

      render(<MemoryRouter>{worksheetsTab.label}</MemoryRouter>);

      expect(
        screen.getByText('Custom Worksheets (8) - Active')
      ).toBeInTheDocument();

      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });
  });
});
