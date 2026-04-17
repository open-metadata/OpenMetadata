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
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { EntityTabs } from '../../enums/entity.enum';
import { GlossaryTermDetailPageTabProps } from './GlossaryTermClassBase';
import { getGlossaryTermDetailPageTabs } from './GlossaryTermUtils';

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({ ActivityFeedTab: () => null })
);

jest.mock(
  '../../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({ CustomPropertyTable: () => null })
);

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: () => null,
}));

jest.mock(
  '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock(
  '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock(
  '../../components/Glossary/GlossaryTermTab/GlossaryTermTab.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock('../../utils/CommonUtils', () => ({
  ...jest.requireActual('../../utils/CommonUtils'),
  getCountBadge: jest.fn().mockReturnValue(null),
}));

const mockGlossaryTerm: GlossaryTermDetailPageTabProps['glossaryTerm'] = {
  id: 'glossary-term-id',
  name: 'Revenue',
  description: 'Revenue glossary term',
  glossary: {
    id: 'glossary-id',
    type: 'glossary',
    name: 'Finance',
  },
  fullyQualifiedName: 'Finance.Revenue',
  childrenCount: 3,
  reviewers: [],
};

const mockProps: GlossaryTermDetailPageTabProps = {
  glossaryTerm: mockGlossaryTerm,
  activeTab: EntityTabs.OVERVIEW,
  isVersionView: false,
  assetCount: 5,
  feedCount: { ...FEED_COUNT_INITIAL_DATA, totalCount: 2 },
  permissions: {
    EditAll: true,
    EditCustomFields: true,
  } as GlossaryTermDetailPageTabProps['permissions'],
  assetPermissions: {} as GlossaryTermDetailPageTabProps['assetPermissions'],
  viewCustomPropertiesPermission: true,
  assetTabRef: { current: null },
  tabLabelMap: {},
  handleAssetClick: jest.fn(),
  handleAssetSave: jest.fn(),
  getEntityFeedCount: jest.fn(),
  setAssetModalVisible: jest.fn(),
  setPreviewAsset: jest.fn(),
};

describe('getGlossaryTermDetailPageTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('non-version view', () => {
    it('returns 6 tabs when isVersionView is false', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);

      expect(tabs).toHaveLength(6);
    });

    it('first tab key is OVERVIEW', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);

      expect(tabs[0].key).toBe(EntityTabs.OVERVIEW);
    });

    it('includes GLOSSARY_TERMS tab', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);

      expect(
        tabs.find((t) => t.key === EntityTabs.GLOSSARY_TERMS)
      ).toBeDefined();
    });

    it('includes ASSETS tab', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);

      expect(tabs.find((t) => t.key === EntityTabs.ASSETS)).toBeDefined();
    });

    it('includes ACTIVITY_FEED tab', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);

      expect(
        tabs.find((t) => t.key === EntityTabs.ACTIVITY_FEED)
      ).toBeDefined();
    });

    it('includes CUSTOM_PROPERTIES tab', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);

      expect(
        tabs.find((t) => t.key === EntityTabs.CUSTOM_PROPERTIES)
      ).toBeDefined();
    });

    it('tabs are in correct order', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);
      const keys = tabs.map((t) => t.key);

      expect(keys).toEqual([
        EntityTabs.OVERVIEW,
        EntityTabs.GLOSSARY_TERMS,
        EntityTabs.ASSETS,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.RELATIONS_GRAPH,
        EntityTabs.CUSTOM_PROPERTIES,
      ]);
    });
  });

  describe('version view', () => {
    it('returns only 1 tab when isVersionView is true', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        isVersionView: true,
      });

      expect(tabs).toHaveLength(1);
    });

    it('only OVERVIEW tab is returned in version view', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        isVersionView: true,
      });

      expect(tabs[0].key).toBe(EntityTabs.OVERVIEW);
    });

    it('GLOSSARY_TERMS tab is absent in version view', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        isVersionView: true,
      });

      expect(
        tabs.find((t) => t.key === EntityTabs.GLOSSARY_TERMS)
      ).toBeUndefined();
    });
  });

  describe('ACTIVITY_FEED tab label', () => {
    it('label isActive is true when activeTab is ACTIVITY_FEED', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        activeTab: EntityTabs.ACTIVITY_FEED,
      });
      const activityTab = tabs.find((t) => t.key === EntityTabs.ACTIVITY_FEED);
      const labelProps = (activityTab?.label as React.ReactElement).props;

      expect(labelProps.isActive).toBe(true);
    });

    it('label isActive is false when activeTab is not ACTIVITY_FEED', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);
      const activityTab = tabs.find((t) => t.key === EntityTabs.ACTIVITY_FEED);
      const labelProps = (activityTab?.label as React.ReactElement).props;

      expect(labelProps.isActive).toBe(false);
    });

    it('label count reflects feedCount.totalCount', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        feedCount: { ...FEED_COUNT_INITIAL_DATA, totalCount: 7 },
      });
      const activityTab = tabs.find((t) => t.key === EntityTabs.ACTIVITY_FEED);
      const labelProps = (activityTab?.label as React.ReactElement).props;

      expect(labelProps.count).toBe(7);
    });
  });

  describe('CUSTOM_PROPERTIES tab', () => {
    it('hasEditAccess is true when not version view and has EditAll', () => {
      const tabs = getGlossaryTermDetailPageTabs(mockProps);
      const customPropsTab = tabs.find(
        (t) => t.key === EntityTabs.CUSTOM_PROPERTIES
      );
      const childProps = (customPropsTab?.children as React.ReactElement).props;

      expect(childProps.hasEditAccess).toBe(true);
    });

    it('hasEditAccess is false when EditAll and EditCustomFields are both false', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        isVersionView: false,
        permissions: {
          ...mockProps.permissions,
          EditAll: false,
          EditCustomFields: false,
        },
      });
      const customPropsTab = tabs.find(
        (t) => t.key === EntityTabs.CUSTOM_PROPERTIES
      );
      const childProps = (customPropsTab?.children as React.ReactElement).props;

      expect(childProps.hasEditAccess).toBe(false);
    });
  });
});
