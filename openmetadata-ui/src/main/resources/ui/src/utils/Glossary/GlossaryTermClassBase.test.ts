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
import { EntityTabs } from '../../enums/entity.enum';
import glossaryTermClassBase, {
  GlossaryTermClassBase,
  GlossaryTermDetailPageTabProps,
} from './GlossaryTermClassBase';
import { getGlossaryTermDetailPageTabs } from './GlossaryTermUtils';

jest.mock('./GlossaryTermUtils', () => ({
  getGlossaryTermDetailPageTabs: jest
    .fn()
    .mockReturnValue([{ key: 'mock-tab' }]),
}));

jest.mock('../../utils/CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tab: string) => tab),
}));

jest.mock(
  '../../components/DataQuality/DataQualityDashboard/DataQualityDashboard.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: jest.fn((key: string) => key) },
}));

const mockProps = {
  glossaryTerm: { fullyQualifiedName: 'Finance.Revenue' },
  isVersionView: false,
} as unknown as GlossaryTermDetailPageTabProps;

describe('GlossaryTermClassBase', () => {
  let instance: GlossaryTermClassBase;

  beforeEach(() => {
    jest.clearAllMocks();
    instance = new GlossaryTermClassBase();
  });

  describe('getGlossaryTermDetailPageTabs', () => {
    it('delegates to getGlossaryTermDetailPageTabs util', () => {
      instance.getGlossaryTermDetailPageTabs(mockProps);

      expect(getGlossaryTermDetailPageTabs).toHaveBeenCalledWith(mockProps);
    });
  });

  describe('getGlossaryTermDetailPageTabs — DATA_OBSERVABILITY tab', () => {
    it('appends DATA_OBSERVABILITY tab in non-version view', () => {
      const tabs = instance.getGlossaryTermDetailPageTabs(mockProps);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab).toBeDefined();
    });

    it('DATA_OBSERVABILITY tab is NOT present in version view', () => {
      const props = { ...mockProps, isVersionView: true };
      const tabs = instance.getGlossaryTermDetailPageTabs(props);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab).toBeUndefined();
    });

    it('DQ tab passes isGovernanceView as true', () => {
      const tabs = instance.getGlossaryTermDetailPageTabs(mockProps);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);
      const childProps = (
        dqTab?.children as React.ReactElement<{
          isGovernanceView: boolean;
          hiddenFilters: string[];
          initialFilters?: Record<string, string[]>;
        }>
      ).props;

      expect(childProps.isGovernanceView).toBe(true);
    });

    it('DQ tab passes glossaryTerm.fqn as initialFilters.glossaryTerms', () => {
      const tabs = instance.getGlossaryTermDetailPageTabs(mockProps);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);
      const childProps = (
        dqTab?.children as React.ReactElement<{
          isGovernanceView: boolean;
          hiddenFilters: string[];
          initialFilters?: Record<string, string[]>;
        }>
      ).props;

      expect(childProps.initialFilters?.glossaryTerms).toEqual([
        'Finance.Revenue',
      ]);
    });

    it('DQ tab hides glossaryTerms filter', () => {
      const tabs = instance.getGlossaryTermDetailPageTabs(mockProps);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);
      const childProps = (
        dqTab?.children as React.ReactElement<{
          isGovernanceView: boolean;
          hiddenFilters: string[];
          initialFilters?: Record<string, string[]>;
        }>
      ).props;

      expect(childProps.hiddenFilters).toContain('glossaryTerms');
    });

    it('DQ tab passes className as data-quality-governance-tab-wrapper', () => {
      const tabs = instance.getGlossaryTermDetailPageTabs(mockProps);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);
      const childProps = (
        dqTab?.children as React.ReactElement<{
          className?: string;
        }>
      ).props;

      expect(childProps.className).toBe('data-quality-governance-tab-wrapper');
    });
  });

  describe('getGlossaryTermDetailPageTabsIds', () => {
    it('returns all 6 expected tab IDs', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs).toHaveLength(6);
    });

    it('includes OVERVIEW tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs.find((t) => t.id === EntityTabs.OVERVIEW)).toBeDefined();
    });

    it('includes GLOSSARY_TERMS tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(
        tabs.find((t) => t.id === EntityTabs.GLOSSARY_TERMS)
      ).toBeDefined();
    });

    it('includes ASSETS tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs.find((t) => t.id === EntityTabs.ASSETS)).toBeDefined();
    });

    it('includes ACTIVITY_FEED tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(tabs.find((t) => t.id === EntityTabs.ACTIVITY_FEED)).toBeDefined();
    });

    it('includes CUSTOM_PROPERTIES tab', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(
        tabs.find((t) => t.id === EntityTabs.CUSTOM_PROPERTIES)
      ).toBeDefined();
    });

    it('all tabs have editable set to false', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      tabs.forEach((tab) => {
        expect(tab.editable).toBe(false);
      });
    });

    it('all tabs have empty layout array', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      tabs.forEach((tab) => {
        expect(tab.layout).toEqual([]);
      });
    });

    it('tabs are in correct order', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();
      const ids = tabs.map((t) => t.id);

      expect(ids).toEqual([
        EntityTabs.OVERVIEW,
        EntityTabs.GLOSSARY_TERMS,
        EntityTabs.ASSETS,
        EntityTabs.ACTIVITY_FEED,
        EntityTabs.CUSTOM_PROPERTIES,
        EntityTabs.DATA_OBSERVABILITY,
      ]);
    });

    it('includes DATA_OBSERVABILITY tab ID', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();

      expect(
        tabs.find((t) => t.id === EntityTabs.DATA_OBSERVABILITY)
      ).toBeDefined();
    });

    it('DATA_OBSERVABILITY tab is not editable', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();
      const dqTab = tabs.find((t) => t.id === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab?.editable).toBe(false);
    });

    it('DATA_OBSERVABILITY tab has empty layout', () => {
      const tabs = instance.getGlossaryTermDetailPageTabsIds();
      const dqTab = tabs.find((t) => t.id === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab?.layout).toEqual([]);
    });
  });

  describe('singleton export', () => {
    it('default export is an instance of GlossaryTermClassBase', () => {
      expect(glossaryTermClassBase).toBeInstanceOf(GlossaryTermClassBase);
    });
  });
});
