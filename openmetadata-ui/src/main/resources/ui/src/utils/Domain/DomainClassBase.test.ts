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
import { EntityTabs } from '../../enums/entity.enum';
import domainClassBase, {
  DomainClassBase,
  DomainDetailPageTabProps,
} from './DomainClassBase';

jest.mock('../../constants/Domain.constants', () => ({
  DOMAIN_DUMMY_DATA: {},
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

jest.mock('../CustomizePage/CustomizePageUtils', () => ({
  getTabLabelFromId: jest.fn((tab: string) => tab),
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
        .props;

      expect(childProps.isGovernanceView).toBe(true);
    });

    it('DQ tab passes domain.fullyQualifiedName as initialFilters.domainFqn', () => {
      const tabs = instance.getDomainDetailPageTabs(mockProps);
      const childProps = (
        tabs.at(-1)?.children as ReturnType<typeof createElement>
      ).props;

      expect(childProps.initialFilters?.domainFqn).toBe('Finance');
    });

    it('DQ tab passes undefined initialFilters when domain.fullyQualifiedName is absent', () => {
      const props = {
        ...mockProps,
        domain: { fullyQualifiedName: undefined },
      } as unknown as DomainDetailPageTabProps;
      const tabs = instance.getDomainDetailPageTabs(props);
      const childProps = (
        tabs.at(-1)?.children as ReturnType<typeof createElement>
      ).props;

      expect(childProps.initialFilters).toBeUndefined();
    });

    it('DQ tab passes className as data-quality-governance-tab-wrapper', () => {
      const tabs = instance.getDomainDetailPageTabs(mockProps);
      const childProps = (
        tabs.at(-1)?.children as ReturnType<typeof createElement>
      ).props;

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

  describe('singleton export', () => {
    it('default export is an instance of DomainClassBase', () => {
      expect(domainClassBase).toBeInstanceOf(DomainClassBase);
    });
  });
});
