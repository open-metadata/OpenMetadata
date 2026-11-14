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
import { MemoryRouter } from 'react-router-dom';
import { EntityTabs } from '../enums/entity.enum';
import { Chart } from '../generated/entity/data/chart';
import { FeedCounts } from '../interface/feed.interface';
import { ChartDetailsTabsProps } from './ChartDetailsClassBase';
import { getChartDetailPageTabs } from './ChartDetailsUtils';

jest.mock('i18next', () => ({
  t: (key: string) => key,
}));

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
    .mockImplementation(() => <div data-testid="common-widgets" />),
}));

jest.mock(
  '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <div data-testid="activity-feed-tab" />),
  })
);

jest.mock('../components/Lineage/EntityLineageTab/EntityLineageTab', () => ({
  EntityLineageTab: jest
    .fn()
    .mockImplementation(() => <div data-testid="entity-lineage-tab" />),
}));

jest.mock(
  '../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({
    CustomPropertyTable: jest
      .fn()
      .mockImplementation(() => <div data-testid="custom-property-table" />),
  })
);

jest.mock('../components/DataContract/ContractTab/ContractTab', () => ({
  ContractTab: jest
    .fn()
    .mockImplementation(() => <div data-testid="contract-tab" />),
}));

const mockFeedCount: FeedCounts = {
  totalCount: 7,
  openTaskCount: 3,
  closedTaskCount: 4,
  conversationCount: 0,
};

const mockChartDetails: Chart = {
  id: 'chart-id-1',
  name: 'sample_chart',
  fullyQualifiedName: 'sample_superset.sample_chart',
};

const mockProps: Omit<ChartDetailsTabsProps, 'labelMap'> = {
  chartDetails: mockChartDetails,
  editLineagePermission: true,
  editCustomAttributePermission: true,
  viewAllPermission: true,
  viewCustomPropertiesPermission: true,
  handleFeedCount: jest.fn(),
  feedCount: mockFeedCount,
  activeTab: EntityTabs.DETAILS,
  deleted: false,
  getEntityFeedCount: jest.fn(),
  fetchChart: jest.fn(),
};

describe('ChartDetailsUtils', () => {
  describe('getChartDetailPageTabs labelMap handling', () => {
    it('uses each tab own key in labelMap rather than EntityTabs.LINEAGE', () => {
      const tabs = getChartDetailPageTabs({
        ...mockProps,
        labelMap: {
          [EntityTabs.DETAILS]: 'Details',
          [EntityTabs.ACTIVITY_FEED]: 'Activity Feeds & Tasks',
          [EntityTabs.LINEAGE]: 'Lineage',
          [EntityTabs.CONTRACT]: 'Contract',
          [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties',
        } as Record<EntityTabs, string>,
      });

      const byKey = Object.fromEntries(tabs.map((tab) => [tab.key, tab]));

      render(
        <MemoryRouter>
          {byKey[EntityTabs.DETAILS].label}
          {byKey[EntityTabs.ACTIVITY_FEED].label}
          {byKey[EntityTabs.LINEAGE].label}
          {byKey[EntityTabs.CONTRACT].label}
          {byKey[EntityTabs.CUSTOM_PROPERTIES].label}
        </MemoryRouter>
      );

      expect(screen.getByTestId('tab-label-Details')).toBeInTheDocument();
      expect(
        screen.getByTestId('tab-label-Activity Feeds & Tasks')
      ).toBeInTheDocument();
      expect(screen.getByTestId('tab-label-Lineage')).toBeInTheDocument();
      expect(screen.getByTestId('tab-label-Contract')).toBeInTheDocument();
      expect(
        screen.getByTestId('tab-label-Custom Properties')
      ).toBeInTheDocument();
    });

    it('falls back to default i18n labels for DETAILS and ACTIVITY_FEED when only LINEAGE is in labelMap', () => {
      const tabs = getChartDetailPageTabs({
        ...mockProps,
        labelMap: {
          [EntityTabs.LINEAGE]: 'Lineage',
        } as Record<EntityTabs, string>,
      });

      const byKey = Object.fromEntries(tabs.map((tab) => [tab.key, tab]));

      render(
        <MemoryRouter>
          {byKey[EntityTabs.DETAILS].label}
          {byKey[EntityTabs.ACTIVITY_FEED].label}
          {byKey[EntityTabs.LINEAGE].label}
        </MemoryRouter>
      );

      expect(
        screen.getByTestId('tab-label-label.detail-plural')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('tab-label-label.activity-feed-and-task-plural')
      ).toBeInTheDocument();
      expect(screen.getByTestId('tab-label-Lineage')).toBeInTheDocument();
    });
  });
});
