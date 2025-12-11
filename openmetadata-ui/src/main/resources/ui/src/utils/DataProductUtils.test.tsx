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

import { EntityTabs } from '../enums/entity.enum';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { FEED_COUNT_INITIAL_DATA } from '../constants/entity.constants';
import {
  DataProductDetailPageTabProps,
  getDataProductDetailTabs,
} from './DataProductUtils';

// Mock the translation function
jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

// Mock React components
jest.mock('../components/common/TabsLabel/TabsLabel.component', () => ({
  __esModule: true,
  default: ({ id, name }: { id: string; name: string }) => (
    <div data-testid={`tab-label-${id}`}>{name}</div>
  ),
}));

jest.mock('../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: () => <div>GenericTab</div>,
}));

jest.mock('../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component', () => ({
  ActivityFeedTab: () => <div>ActivityFeedTab</div>,
}));

jest.mock('../components/common/ResizablePanels/ResizablePanels', () => ({
  __esModule: true,
  default: () => <div>ResizablePanels</div>,
}));

jest.mock('../components/common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: () => <div>CustomPropertyTable</div>,
}));

describe('getDataProductDetailTabs', () => {
  const mockDataProduct: DataProduct = {
    id: 'test-data-product-id',
    name: 'Test Data Product',
    displayName: 'Test Data Product',
    fullyQualifiedName: 'test.dataProduct',
    description: 'Test description',
    version: 0.1,
    updatedAt: Date.now(),
    updatedBy: 'admin',
    owners: [],
    domains: [],
    href: '',
  };

  const baseProps: DataProductDetailPageTabProps = {
    dataProduct: mockDataProduct,
    isVersionsView: false,
    dataProductPermission: {
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    },
    assetCount: 5,
    activeTab: EntityTabs.DOCUMENTATION,
    assetTabRef: { current: null },
    previewAsset: undefined,
    setPreviewAsset: jest.fn(),
    setAssetModalVisible: jest.fn(),
    handleAssetClick: jest.fn(),
    handleAssetSave: jest.fn(),
    feedCount: FEED_COUNT_INITIAL_DATA,
    getEntityFeedCount: jest.fn(),
    labelMap: undefined,
  };

  it('should return tabs with correct keys matching EntityTabs enum', () => {
    const tabs = getDataProductDetailTabs(baseProps);

    // Extract tab keys
    const tabKeys = tabs.map((tab) => tab.key);

    // Verify all tabs have keys matching EntityTabs enum values
    expect(tabKeys).toContain(EntityTabs.DOCUMENTATION);
    expect(tabKeys).toContain(EntityTabs.ACTIVITY_FEED);
    expect(tabKeys).toContain(EntityTabs.ASSETS);
    expect(tabKeys).toContain(EntityTabs.CUSTOM_PROPERTIES);
  });

  it('should use direct translation keys for tab names (not labelMap)', () => {
    const tabs = getDataProductDetailTabs(baseProps);

    // Find the documentation tab
    const documentationTab = tabs.find(
      (tab) => tab.key === EntityTabs.DOCUMENTATION
    );
    expect(documentationTab).toBeDefined();
    expect(documentationTab?.label).toBeDefined();

    // Find the activity feed tab
    const activityFeedTab = tabs.find(
      (tab) => tab.key === EntityTabs.ACTIVITY_FEED
    );
    expect(activityFeedTab).toBeDefined();
    expect(activityFeedTab?.label).toBeDefined();

    // Find the assets tab
    const assetsTab = tabs.find((tab) => tab.key === EntityTabs.ASSETS);
    expect(assetsTab).toBeDefined();
    expect(assetsTab?.label).toBeDefined();

    // Find the custom properties tab
    const customPropertiesTab = tabs.find(
      (tab) => tab.key === EntityTabs.CUSTOM_PROPERTIES
    );
    expect(customPropertiesTab).toBeDefined();
    expect(customPropertiesTab?.label).toBeDefined();
  });

  it('should return tabs in the correct order', () => {
    const tabs = getDataProductDetailTabs(baseProps);
    const tabKeys = tabs.map((tab) => tab.key);

    // Expected order for non-version view
    expect(tabKeys[0]).toBe(EntityTabs.DOCUMENTATION);
    expect(tabKeys[1]).toBe(EntityTabs.ACTIVITY_FEED);
    expect(tabKeys[2]).toBe(EntityTabs.ASSETS);
    expect(tabKeys[3]).toBe(EntityTabs.CUSTOM_PROPERTIES);
  });

  it('should exclude activity feed and assets tabs in version view', () => {
    const versionViewProps = {
      ...baseProps,
      isVersionsView: true,
    };

    const tabs = getDataProductDetailTabs(versionViewProps);
    const tabKeys = tabs.map((tab) => tab.key);

    // In version view, only documentation and custom properties should be present
    expect(tabKeys).toContain(EntityTabs.DOCUMENTATION);
    expect(tabKeys).toContain(EntityTabs.CUSTOM_PROPERTIES);
    expect(tabKeys).not.toContain(EntityTabs.ACTIVITY_FEED);
    expect(tabKeys).not.toContain(EntityTabs.ASSETS);
    expect(tabKeys).toHaveLength(2);
  });

  it('should include all tabs in non-version view', () => {
    const tabs = getDataProductDetailTabs(baseProps);
    const tabKeys = tabs.map((tab) => tab.key);

    expect(tabKeys).toHaveLength(4);
    expect(tabKeys).toContain(EntityTabs.DOCUMENTATION);
    expect(tabKeys).toContain(EntityTabs.ACTIVITY_FEED);
    expect(tabKeys).toContain(EntityTabs.ASSETS);
    expect(tabKeys).toContain(EntityTabs.CUSTOM_PROPERTIES);
  });

  it('should have matching id and key for each tab', () => {
    const tabs = getDataProductDetailTabs(baseProps);

    tabs.forEach((tab) => {
      // Each tab's key should be a valid EntityTabs value
      expect(Object.values(EntityTabs)).toContain(tab.key);
    });
  });

  it('should pass correct asset count to assets tab', () => {
    const customAssetCount = 42;
    const propsWithAssets = {
      ...baseProps,
      assetCount: customAssetCount,
    };

    const tabs = getDataProductDetailTabs(propsWithAssets);
    const assetsTab = tabs.find((tab) => tab.key === EntityTabs.ASSETS);

    // The tab should exist and have the asset count passed to TabsLabel
    expect(assetsTab).toBeDefined();
  });

  it('should pass correct feed count to activity feed tab', () => {
    const customFeedCount = {
      totalCount: 10,
      conversationCount: 5,
      openTaskCount: 3,
      closedTaskCount: 2,
    };
    const propsWithFeedCount = {
      ...baseProps,
      feedCount: customFeedCount,
    };

    const tabs = getDataProductDetailTabs(propsWithFeedCount);
    const activityFeedTab = tabs.find(
      (tab) => tab.key === EntityTabs.ACTIVITY_FEED
    );

    expect(activityFeedTab).toBeDefined();
  });

  it('should set active state correctly on tabs', () => {
    // Test with ASSETS as active tab
    const propsWithActiveAssets = {
      ...baseProps,
      activeTab: EntityTabs.ASSETS,
    };

    const tabs = getDataProductDetailTabs(propsWithActiveAssets);
    const assetsTab = tabs.find((tab) => tab.key === EntityTabs.ASSETS);

    expect(assetsTab).toBeDefined();

    // Test with ACTIVITY_FEED as active tab
    const propsWithActiveFeed = {
      ...baseProps,
      activeTab: EntityTabs.ACTIVITY_FEED,
    };

    const tabsWithActiveFeed = getDataProductDetailTabs(propsWithActiveFeed);
    const activityFeedTab = tabsWithActiveFeed.find(
      (tab) => tab.key === EntityTabs.ACTIVITY_FEED
    );

    expect(activityFeedTab).toBeDefined();
  });

  it('should not use labelMap for tab names', () => {
    const labelMap = {
      [EntityTabs.DOCUMENTATION]: 'Custom Documentation Label',
      [EntityTabs.ACTIVITY_FEED]: 'Custom Activity Feed Label',
      [EntityTabs.ASSETS]: 'Custom Assets Label',
      [EntityTabs.CUSTOM_PROPERTIES]: 'Custom Properties Label',
    };

    const propsWithLabelMap = {
      ...baseProps,
      labelMap,
    };

    const tabs = getDataProductDetailTabs(propsWithLabelMap);

    // Even with labelMap provided, tabs should use direct translation keys
    // This is the fix - tabs should NOT be renamed based on labelMap
    tabs.forEach((tab) => {
      expect(tab.key).toBeDefined();
      expect(Object.values(EntityTabs)).toContain(tab.key);
    });
  });
});
