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

import { createElement } from 'react';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { EntityTabs } from '../../enums/entity.enum';
import domainClassBase, {
  DomainClassBase,
  DomainDetailPageTabProps,
} from './DomainClassBase';

jest.mock('../../constants/Domain.constants', () => ({
  DOMAIN_DUMMY_DATA: {},
  DOMAIN_FILTERS: [{ label: 'label.owner-plural', key: 'owners.displayName' }],
  SUB_DOMAIN_FILTERS: [{ label: 'label.tag-plural', key: 'tags.tagFQN' }],
  DOMAIN_DEFAULT_QUICK_FILTERS: ['owners.displayName'],
  SUBDOMAIN_DEFAULT_QUICK_FILTERS: ['tags.tagFQN'],
}));

jest.mock('../DomainUtils', () => ({
  getDomainDetailTabs: jest
    .fn()
    .mockReturnValue([{ key: EntityTabs.DOCUMENTATION, children: null }]),
  getDomainWidgetsFromKey: jest.fn().mockReturnValue([]),
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
  domain: { fullyQualifiedName: 'Finance' },
  isVersionsView: false,
} as unknown as DomainDetailPageTabProps;

describe('DomainClassBase', () => {
  let instance: DomainClassBase;

  beforeEach(() => {
    jest.clearAllMocks();
    instance = new DomainClassBase();
  });

  describe('getDomainDetailPageTabs', () => {
    it('in non-version view appends DATA_OBSERVABILITY tab after base tabs', () => {
      const tabs = instance.getDomainDetailPageTabs(mockProps);

      expect(tabs.at(-1)?.key).toBe(EntityTabs.DATA_OBSERVABILITY);
    });

    it('in version view returns only base tabs without DATA_OBSERVABILITY', () => {
      const props = { ...mockProps, isVersionsView: true };
      const tabs = instance.getDomainDetailPageTabs(props);
      const dqTab = tabs.find((t) => t.key === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab).toBeUndefined();
    });

    it('DQ tab passes isGovernanceView as true', () => {
      const tabs = instance.getDomainDetailPageTabs(mockProps);
      const dqTab = tabs.at(-1);
      const childProps = (dqTab?.children as ReturnType<typeof createElement>)
        .props as Record<string, unknown>;

      expect(childProps.isGovernanceView).toBe(true);
    });

    it('DQ tab passes domain.fullyQualifiedName as initialFilters.domainFqn', () => {
      const tabs = instance.getDomainDetailPageTabs(mockProps);
      const childProps = (
        tabs.at(-1)?.children as ReturnType<typeof createElement>
      ).props as Record<string, unknown>;

      expect(
        (childProps.initialFilters as Record<string, unknown> | undefined)
          ?.domainFqn
      ).toBe('Finance');
    });

    it('DQ tab passes undefined initialFilters when domain.fullyQualifiedName is absent', () => {
      const props = {
        ...mockProps,
        domain: { fullyQualifiedName: undefined },
      } as unknown as DomainDetailPageTabProps;
      const tabs = instance.getDomainDetailPageTabs(props);
      const childProps = (
        tabs.at(-1)?.children as ReturnType<typeof createElement>
      ).props as Record<string, unknown>;

      expect(childProps.initialFilters).toBeUndefined();
    });

    it('DQ tab passes className as data-quality-governance-tab-wrapper', () => {
      const tabs = instance.getDomainDetailPageTabs(mockProps);
      const childProps = (
        tabs.at(-1)?.children as ReturnType<typeof createElement>
      ).props as Record<string, unknown>;

      expect(childProps.className).toBe('data-quality-governance-tab-wrapper');
    });
  });

  describe('getDomainDetailPageTabsIds', () => {
    it('includes DATA_OBSERVABILITY tab ID', () => {
      const tabs = instance.getDomainDetailPageTabsIds();
      const dqTab = tabs.find((t) => t.id === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab).toBeDefined();
    });

    it('DATA_OBSERVABILITY tab is not editable', () => {
      const tabs = instance.getDomainDetailPageTabsIds();
      const dqTab = tabs.find((t) => t.id === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab?.editable).toBe(false);
    });

    it('DATA_OBSERVABILITY tab has empty layout', () => {
      const tabs = instance.getDomainDetailPageTabsIds();
      const dqTab = tabs.find((t) => t.id === EntityTabs.DATA_OBSERVABILITY);

      expect(dqTab?.layout).toEqual([]);
    });

    it('DATA_OBSERVABILITY is the last tab ID', () => {
      const tabs = instance.getDomainDetailPageTabsIds();

      expect(tabs.at(-1)?.id).toBe(EntityTabs.DATA_OBSERVABILITY);
    });
  });

  describe('getReviewersField', () => {
    it('returns null so OSS never renders the Collate-only reviewers field', () => {
      expect(instance.getReviewersField()).toBeNull();
    });
  });

  describe('listing filters', () => {
    it('returns the domain filter set by default', () => {
      expect(instance.getListingFilters()).toEqual([
        { label: 'label.owner-plural', key: 'owners.displayName' },
      ]);
    });

    it('returns the sub-domain filter set when isSubDomain is true', () => {
      expect(instance.getListingFilters(true)).toEqual([
        { label: 'label.tag-plural', key: 'tags.tagFQN' },
      ]);
    });

    it('omits the Collate-only status filter from both sets', () => {
      const keys = [
        ...instance.getListingFilters(),
        ...instance.getListingFilters(true),
      ].map((filter) => filter.key);

      expect(keys).not.toContain(EntityFields.ENTITY_STATUS);
    });

    it('returns the matching quick-filter keys for each listing', () => {
      expect(instance.getListingQuickFilterKeys()).toEqual([
        'owners.displayName',
      ]);
      expect(instance.getListingQuickFilterKeys(true)).toEqual(['tags.tagFQN']);
    });

    it('omits the Collate-only status key from both quick-filter sets', () => {
      expect([
        ...instance.getListingQuickFilterKeys(),
        ...instance.getListingQuickFilterKeys(true),
      ]).not.toContain(EntityFields.ENTITY_STATUS);
    });
  });

  describe('getListingExtraColumns', () => {
    it('contributes no extra listing column in OSS', () => {
      expect(instance.getListingExtraColumns()).toEqual([]);
    });

    // Callers feed the result straight into a useMemo dep list, so a fresh
    // array per call would recompute the columns on every render.
    it('returns the same array identity on every call', () => {
      expect(instance.getListingExtraColumns()).toBe(
        instance.getListingExtraColumns()
      );
    });
  });

  describe('singleton export', () => {
    it('default export is an instance of DomainClassBase', () => {
      expect(domainClassBase).toBeInstanceOf(DomainClassBase);
    });
  });
});
