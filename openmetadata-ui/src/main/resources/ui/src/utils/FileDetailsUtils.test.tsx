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
  FileDetailPageTabProps,
  getFileDetailsPageTabs,
  getFileWidgetsFromKey,
} from './FileDetailsUtils';

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

jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

jest.mock('../components/DataContract/ContractTab/ContractTab.tsx', () => {
  return jest.fn().mockImplementation(() => <p>DataContractComponent</p>);
});

const mockProps: FileDetailPageTabProps = {
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
  activeTab: EntityTabs.OVERVIEW,
  feedCount: { totalCount: 15 },
};

describe('FileDetailsUtils', () => {
  describe('getFileDetailsPageTabs', () => {
    it('should return correct number of tabs', () => {
      const tabs = getFileDetailsPageTabs(mockProps);

      expect(tabs).toHaveLength(5);
    });

    it('should return tabs with correct keys', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const tabKeys = tabs.map((tab) => tab.key);

      expect(tabKeys).toEqual([
        EntityTabs.OVERVIEW,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CONTRACT,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });

    it('should render overview tab with correct active state', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const overviewTab = tabs[0];

      render(<MemoryRouter>{overviewTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.overview')
      ).toBeInTheDocument();
      expect(screen.getByText('label.overview - Active')).toBeInTheDocument();
    });

    it('should render activity feed tab with correct count', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.activity-feed-and-task-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.activity-feed-and-task-plural (15)')
      ).toBeInTheDocument();
    });

    it('should render lineage tab without count', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByTestId('tab-label-label.lineage')).toBeInTheDocument();
      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should render custom properties tab without count', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.custom-property-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.custom-property-plural')
      ).toBeInTheDocument();
    });

    it('should render overview tab content correctly', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const overviewTab = tabs[0];

      render(<MemoryRouter>{overviewTab.children}</MemoryRouter>);

      expect(screen.getByTestId('generic-tab')).toBeInTheDocument();
      expect(screen.getByText('Generic Tab - File')).toBeInTheDocument();
    });

    it('should render activity feed tab content correctly', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.children}</MemoryRouter>);

      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });

    it('should render lineage tab content correctly', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.children}</MemoryRouter>);

      expect(screen.getByTestId('lineage')).toBeInTheDocument();
    });

    it('should render contract tab without count', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const contractTab = tabs[3];

      render(<MemoryRouter>{contractTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.contract')
      ).toBeInTheDocument();
      expect(screen.getByText('label.contract')).toBeInTheDocument();
    });

    it('should render custom properties tab content correctly', () => {
      const tabs = getFileDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.children}</MemoryRouter>);

      expect(screen.getByTestId('custom-properties')).toBeInTheDocument();
    });

    it('should handle different active tab', () => {
      const propsWithDifferentActiveTab = {
        ...mockProps,
        activeTab: EntityTabs.LINEAGE,
      };

      const tabs = getFileDetailsPageTabs(propsWithDifferentActiveTab);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should handle zero feed count', () => {
      const propsWithZeroCount = {
        ...mockProps,
        feedCount: { totalCount: 0 },
      };

      const tabs = getFileDetailsPageTabs(propsWithZeroCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (0)')
      ).toBeInTheDocument();
    });

    it('should handle large feed count', () => {
      const propsWithLargeCount = {
        ...mockProps,
        feedCount: { totalCount: 999 },
      };

      const tabs = getFileDetailsPageTabs(propsWithLargeCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (999)')
      ).toBeInTheDocument();
    });
  });

  describe('getFileWidgetsFromKey', () => {
    it('should return CommonWidgets for description widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - file - KnowledgePanel.Description')
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

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - file - KnowledgePanel.DataProducts')
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

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - file - KnowledgePanel.Tags')
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

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - file - KnowledgePanel.GlossaryTerms')
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

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - file - KnowledgePanel.CustomProperties'
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

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - file - unknown-widget')
      ).toBeInTheDocument();
    });

    it('should handle widget config with different dimensions', () => {
      const widgetConfig: WidgetConfig = {
        h: 10,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 12,
        x: 2,
        y: 5,
        static: true,
      };

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - file - KnowledgePanel.Description')
      ).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing feedCount gracefully', () => {
      const propsWithoutFeedCount = {
        ...mockProps,
        feedCount: { totalCount: 0 },
      };

      const tabs = getFileDetailsPageTabs(propsWithoutFeedCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (0)')
      ).toBeInTheDocument();
    });

    it('should handle null widget config', () => {
      const widgetConfig = null as unknown as WidgetConfig;

      expect(() => getFileWidgetsFromKey(widgetConfig)).not.toThrow();
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

      const result = getFileWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });

    it('should handle all tab states correctly', () => {
      const tabs = getFileDetailsPageTabs(mockProps);

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

      const tabs = getFileDetailsPageTabs(propsWithInactiveTab);
      const overviewTab = tabs[0];

      render(<MemoryRouter>{overviewTab.label}</MemoryRouter>);

      expect(screen.getByText('label.overview')).toBeInTheDocument();
      expect(screen.queryByText('- Active')).not.toBeInTheDocument();
    });

    it('should handle missing labelMap gracefully', () => {
      const propsWithoutLabelMap = {
        ...mockProps,
        labelMap: undefined,
      };

      const tabs = getFileDetailsPageTabs(propsWithoutLabelMap);

      expect(tabs).toHaveLength(5);

      tabs.forEach((tab) => {
        expect(tab.key).toBeDefined();
        expect(tab.label).toBeDefined();
        expect(tab.children).toBeDefined();
      });
    });
  });

  describe('labelMap props', () => {
    it('should use custom labels from labelMap when provided', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.OVERVIEW]: 'Custom Overview Label',
          [EntityTabs.ACTIVITY_FEED]: 'Custom Activity Feed',
          [EntityTabs.LINEAGE]: 'Custom Lineage',
          [EntityTabs.CONTRACT]: 'Custom Contract',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getFileDetailsPageTabs(propsWithLabelMap);
      const overviewTab = tabs[0];

      render(<MemoryRouter>{overviewTab.label}</MemoryRouter>);

      expect(
        screen.getByText('Custom Overview Label - Active')
      ).toBeInTheDocument();
    });

    it('should use custom label for activity feed tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.ACTIVITY_FEED]: 'Custom Activity',
        } as Record<EntityTabs, string>,
      };

      const tabs = getFileDetailsPageTabs(propsWithLabelMap);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(screen.getByText('Custom Activity (15)')).toBeInTheDocument();
    });

    it('should use custom label for lineage tab from labelMap', () => {
      const propsWithLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.LINEAGE]: 'Custom Lineage Label',
        } as Record<EntityTabs, string>,
      };

      const tabs = getFileDetailsPageTabs(propsWithLabelMap);
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

      const tabs = getFileDetailsPageTabs(propsWithLabelMap);
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

      const tabs = getFileDetailsPageTabs(propsWithLabelMap);
      const customPropertiesTab = tabs[4];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(screen.getByText('My Custom Properties')).toBeInTheDocument();
    });

    it('should fallback to default i18n labels when labelMap is empty', () => {
      const propsWithEmptyLabelMap = {
        ...mockProps,
        labelMap: {} as Record<EntityTabs, string>,
      };

      const tabs = getFileDetailsPageTabs(propsWithEmptyLabelMap);
      const overviewTab = tabs[0];

      render(<MemoryRouter>{overviewTab.label}</MemoryRouter>);

      expect(screen.getByText('label.overview - Active')).toBeInTheDocument();
    });

    it('should use partial labelMap and fallback to defaults for missing keys', () => {
      const propsWithPartialLabelMap = {
        ...mockProps,
        labelMap: {
          [EntityTabs.OVERVIEW]: 'Custom Overview',
          [EntityTabs.CONTRACT]: 'Custom Contract',
        } as Record<EntityTabs, string>,
      };

      const tabs = getFileDetailsPageTabs(propsWithPartialLabelMap);

      const overviewTab = tabs[0];

      render(<MemoryRouter>{overviewTab.label}</MemoryRouter>);

      expect(screen.getByText('Custom Overview - Active')).toBeInTheDocument();

      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });
  });
});
