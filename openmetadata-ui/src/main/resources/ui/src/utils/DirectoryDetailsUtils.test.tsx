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
  DirectoryDetailPageTabProps,
  getDirectoryDetailsPageTabs,
  getDirectoryWidgetsFromKey,
} from './DirectoryDetailsUtils';

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
  '../components/DriveService/Directory/DirectoryChildrenTable/DirectoryChildrenTable',
  () => {
    return jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="directory-children-table">
          Directory Children Table
        </div>
      ));
  }
);

jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

const mockProps: DirectoryDetailPageTabProps = {
  childrenCount: 5,
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
  activeTab: EntityTabs.CHILDREN,
  feedCount: { totalCount: 10 },
  labelMap: {
    [EntityTabs.CHILDREN]: 'Children',
    [EntityTabs.ACTIVITY_FEED]: 'Activity Feed',
    [EntityTabs.LINEAGE]: 'Lineage',
    [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
  } as Record<EntityTabs, string>,
};

describe('DirectoryDetailsUtils', () => {
  describe('getDirectoryDetailsPageTabs', () => {
    it('should return correct number of tabs', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);

      expect(tabs).toHaveLength(4);
    });

    it('should return tabs with correct keys', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const tabKeys = tabs.map((tab) => tab.key);

      expect(tabKeys).toEqual([
        EntityTabs.CHILDREN,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.LINEAGE,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });

    it('should render children tab with correct count and active state', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const childrenTab = tabs[0];

      render(<MemoryRouter>{childrenTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.children')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.children (5) - Active')
      ).toBeInTheDocument();
    });

    it('should render activity feed tab with correct count', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.activity-feed-and-task-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.activity-feed-and-task-plural (10)')
      ).toBeInTheDocument();
    });

    it('should render lineage tab without count', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.label}</MemoryRouter>);

      expect(screen.getByTestId('tab-label-label.lineage')).toBeInTheDocument();
      expect(screen.getByText('label.lineage')).toBeInTheDocument();
    });

    it('should render custom properties tab without count', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[3];

      render(<MemoryRouter>{customPropertiesTab.label}</MemoryRouter>);

      expect(
        screen.getByTestId('tab-label-label.custom-property-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByText('label.custom-property-plural')
      ).toBeInTheDocument();
    });

    it('should render children tab content correctly', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const childrenTab = tabs[0];

      render(<MemoryRouter>{childrenTab.children}</MemoryRouter>);

      expect(screen.getByTestId('generic-tab')).toBeInTheDocument();
      expect(screen.getByText('Generic Tab - Directory')).toBeInTheDocument();
    });

    it('should render activity feed tab content correctly', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.children}</MemoryRouter>);

      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    });

    it('should render lineage tab content correctly', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const lineageTab = tabs[2];

      render(<MemoryRouter>{lineageTab.children}</MemoryRouter>);

      expect(screen.getByTestId('lineage')).toBeInTheDocument();
    });

    it('should render custom properties tab content correctly', () => {
      const tabs = getDirectoryDetailsPageTabs(mockProps);
      const customPropertiesTab = tabs[3];

      render(<MemoryRouter>{customPropertiesTab.children}</MemoryRouter>);

      expect(screen.getByTestId('custom-properties')).toBeInTheDocument();
    });

    it('should handle different active tab', () => {
      const propsWithDifferentActiveTab = {
        ...mockProps,
        activeTab: EntityTabs.ACTIVITY_FEED,
      };

      const tabs = getDirectoryDetailsPageTabs(propsWithDifferentActiveTab);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (10) - Active')
      ).toBeInTheDocument();
    });

    it('should handle zero children count', () => {
      const propsWithZeroCount = {
        ...mockProps,
        childrenCount: 0,
      };

      const tabs = getDirectoryDetailsPageTabs(propsWithZeroCount);
      const childrenTab = tabs[0];

      render(<MemoryRouter>{childrenTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.children (0) - Active')
      ).toBeInTheDocument();
    });

    it('should handle undefined children count', () => {
      const propsWithUndefinedCount = {
        ...mockProps,
        childrenCount: undefined as unknown as number,
      };

      const tabs = getDirectoryDetailsPageTabs(propsWithUndefinedCount);
      const childrenTab = tabs[0];

      render(<MemoryRouter>{childrenTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.children (0) - Active')
      ).toBeInTheDocument();
    });
  });

  describe('getDirectoryWidgetsFromKey', () => {
    it('should return DirectoryChildrenTable for directory children widget', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: DetailPageWidgetKeys.DIRECTORY_CHILDREN,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(
        screen.getByTestId('directory-children-table')
      ).toBeInTheDocument();
    });

    it('should return DirectoryChildrenTable for widget key starting with directory children', () => {
      const widgetConfig: WidgetConfig = {
        h: 8,
        i: `${DetailPageWidgetKeys.DIRECTORY_CHILDREN}.custom`,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(
        screen.getByTestId('directory-children-table')
      ).toBeInTheDocument();
    });

    it('should return CommonWidgets for other widget types', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - directory - KnowledgePanel.Description'
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

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - directory - KnowledgePanel.Tags')
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

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - directory - KnowledgePanel.DataProducts'
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

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Common Widgets - directory - KnowledgePanel.CustomProperties'
        )
      ).toBeInTheDocument();
    });

    it('should handle unknown widget types gracefully', () => {
      const widgetConfig: WidgetConfig = {
        h: 2,
        i: 'unknown-widget' as DetailPageWidgetKeys,
        w: 2,
        x: 0,
        y: 0,
        static: false,
      };

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
      expect(
        screen.getByText('Common Widgets - directory - unknown-widget')
      ).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing feedCount gracefully', () => {
      const propsWithoutFeedCount = {
        ...mockProps,
        feedCount: { totalCount: 0 },
      };

      const tabs = getDirectoryDetailsPageTabs(propsWithoutFeedCount);
      const activityTab = tabs[1];

      render(<MemoryRouter>{activityTab.label}</MemoryRouter>);

      expect(
        screen.getByText('label.activity-feed-and-task-plural (0)')
      ).toBeInTheDocument();
    });

    it('should handle null widget config', () => {
      const widgetConfig = null as unknown as WidgetConfig;

      expect(() => getDirectoryWidgetsFromKey(widgetConfig)).toThrow();
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

      const result = getDirectoryWidgetsFromKey(widgetConfig);

      render(<MemoryRouter>{result}</MemoryRouter>);

      expect(screen.getByTestId('common-widgets')).toBeInTheDocument();
    });
  });
});
