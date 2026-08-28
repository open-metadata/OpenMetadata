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

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useGlossaryStore } from '../../components/Glossary/useGlossary.store';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { EntityTabs } from '../../enums/entity.enum';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import {
  getFirstLevelGlossaryTermsPaginated,
  searchGlossaryTermsPaginated,
} from '../../rest/glossaryAPI';
import { getCountBadge } from '../../utils/EntityDisplayPureUtils';
import glossaryTermClassBase, {
  GlossaryTermDetailPageTabProps,
} from './GlossaryTermClassBase';
import { getGlossaryTermDetailPageTabs } from './GlossaryTermUtils';

const mockGetCountBadge = getCountBadge as jest.Mock;

jest.mock('../../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn(),
  searchGlossaryTermsPaginated: jest.fn(),
}));

const mockGetFirstLevelGlossaryTermsPaginated =
  getFirstLevelGlossaryTermsPaginated as jest.Mock;
const mockSearchGlossaryTermsPaginated =
  searchGlossaryTermsPaginated as jest.Mock;

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

jest.mock('../EntityDisplayPureUtils', () => ({
  ...jest.requireActual('../EntityDisplayPureUtils'),
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
    useGlossaryStore.setState({
      childrenCounts: {},
      termsStatusFilter: undefined,
      termsSearchTerm: undefined,
    } as never);
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

    it('passes a status message and disables Add on the ASSETS tab when the term is not Approved', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        glossaryTerm: {
          ...mockGlossaryTerm,
          entityStatus: EntityStatus.InReview,
        },
      });
      const assetsTab = tabs.find((t) => t.key === EntityTabs.ASSETS);
      const resizable = assetsTab?.children as React.ReactElement;
      const assetsTabsProps = (
        resizable.props.firstPanel.children as React.ReactElement
      ).props;

      expect(assetsTabsProps.addDisabledMessage).toBeTruthy();
    });

    it('does not pass a disabled message on the ASSETS tab when the term is Approved', () => {
      const tabs = getGlossaryTermDetailPageTabs({
        ...mockProps,
        glossaryTerm: {
          ...mockGlossaryTerm,
          entityStatus: EntityStatus.Approved,
        },
      });
      const assetsTab = tabs.find((t) => t.key === EntityTabs.ASSETS);
      const resizable = assetsTab?.children as React.ReactElement;
      const assetsTabsProps = (
        resizable.props.firstPanel.children as React.ReactElement
      ).props;

      expect(assetsTabsProps.addDisabledMessage).toBeUndefined();
    });

    it('uses a different, status-appropriate disabled message for terminal statuses vs pending ones', () => {
      const getAssetsMessage = (entityStatus: EntityStatus) => {
        const tabs = getGlossaryTermDetailPageTabs({
          ...mockProps,
          glossaryTerm: { ...mockGlossaryTerm, entityStatus },
        });
        const assetsTab = tabs.find((t) => t.key === EntityTabs.ASSETS);
        const resizable = assetsTab?.children as React.ReactElement;

        return (resizable.props.firstPanel.children as React.ReactElement).props
          .addDisabledMessage;
      };

      // Pending (can still be approved) vs terminal (Deprecated will not) must
      // not share the misleading "once it is approved" copy.
      const pendingMessage = getAssetsMessage(EntityStatus.InReview);
      const terminalMessage = getAssetsMessage(EntityStatus.Deprecated);

      expect(pendingMessage).toBeTruthy();
      expect(terminalMessage).toBeTruthy();
      expect(terminalMessage).not.toEqual(pendingMessage);
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

  describe('GLOSSARY_TERMS tab count badge', () => {
    const renderGlossaryTermsTabLabel = (
      props: GlossaryTermDetailPageTabProps = mockProps
    ) => {
      const tabs = getGlossaryTermDetailPageTabs(props);
      const glossaryTermsTab = tabs.find(
        (t) => t.key === EntityTabs.GLOSSARY_TERMS
      );

      return render(glossaryTermsTab?.label as React.ReactElement);
    };

    it('requests a status-filtered, count-only page of direct children for the term', async () => {
      useGlossaryStore.setState({
        termsStatusFilter: 'Approved,Draft,In Review',
      } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 4 },
      });

      renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
        'Finance.Revenue',
        0,
        undefined,
        'Approved,Draft,In Review'
      );
    });

    it('falls back to 0 when the fetch fails', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockRejectedValueOnce(
        new Error('network error')
      );

      renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);
    });

    it('does not fetch when the term has no fullyQualifiedName', () => {
      renderGlossaryTermsTabLabel({
        ...mockProps,
        glossaryTerm: { ...mockGlossaryTerm, fullyQualifiedName: undefined },
      });

      expect(mockGetFirstLevelGlossaryTermsPaginated).not.toHaveBeenCalled();
    });

    it('re-fetches when termsStatusFilter changes, e.g. after the table status filter is saved', async () => {
      useGlossaryStore.setState({
        termsStatusFilter: 'Approved,Draft,In Review',
      } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 4 },
      });

      const { rerender } = renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);

      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 1 },
      });

      useGlossaryStore.setState({ termsStatusFilter: 'Approved' } as never);
      const tabs = getGlossaryTermDetailPageTabs(mockProps);
      const glossaryTermsTab = tabs.find(
        (t) => t.key === EntityTabs.GLOSSARY_TERMS
      );
      rerender(glossaryTermsTab?.label as React.ReactElement);

      await screen.findAllByTestId('terms');

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenLastCalledWith(
        'Finance.Revenue',
        0,
        undefined,
        'Approved'
      );
      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
    });

    // Mirrors GlossaryTermTab.component.tsx's fetchAllTerms's own
    // fetchRequestSeqRef guard: a rapid filter change fires a second, newer
    // request before the first, slower one resolves. Without a per-fqn
    // sequence guard in fetchChildrenCount, the first request resolving
    // *after* the second would overwrite the correct, newer count with a
    // stale one.
    it('discards a stale, slower-resolving response when a newer request for the same fqn has since been issued', async () => {
      useGlossaryStore.setState({
        termsStatusFilter: 'Approved,Draft,In Review',
      } as never);

      let resolveFirstRequest: (value: {
        data: never[];
        paging: { total: number };
      }) => void;
      const firstRequest = new Promise<{
        data: never[];
        paging: { total: number };
      }>((resolve) => {
        resolveFirstRequest = resolve;
      });
      mockGetFirstLevelGlossaryTermsPaginated.mockImplementationOnce(
        () => firstRequest
      );

      const { rerender } = renderGlossaryTermsTabLabel();

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(
          1
        );
      });

      // A rapid filter change fires a second, newer request for the same
      // fqn before the first one has resolved. This one resolves quickly.
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 7 },
      });
      useGlossaryStore.setState({ termsStatusFilter: 'Approved' } as never);
      const tabs = getGlossaryTermDetailPageTabs(mockProps);
      const glossaryTermsTab = tabs.find(
        (t) => t.key === EntityTabs.GLOSSARY_TERMS
      );
      rerender(glossaryTermsTab?.label as React.ReactElement);

      await waitFor(() => {
        expect(mockGetCountBadge).toHaveBeenLastCalledWith(7, '', false);
      });

      // The first (older, slower) request finally resolves with a
      // different count. It must be discarded, not applied.
      await act(async () => {
        resolveFirstRequest({ data: [], paging: { total: 4 } });
        await Promise.resolve();
      });

      expect(mockGetCountBadge).toHaveBeenLastCalledWith(7, '', false);
    });

    // Edge case in the sequence guard itself: resetChildrenCounts() must
    // NOT reset the per-fqn request-sequence counter, only childrenCounts.
    // If it did, a fqn re-fetched right after a reset would restart its
    // counter at the same number a still-in-flight, pre-reset request for
    // that same fqn had already captured — letting the stale response
    // coincidentally pass the "is this still the latest?" check and briefly
    // overwrite the fresh count.
    it('does not let a request in-flight during a reset pass the staleness check once a fresh same-fqn request resolves', async () => {
      let resolveStaleRequest: (value: {
        data: never[];
        paging: { total: number };
      }) => void;
      const staleRequest = new Promise<{
        data: never[];
        paging: { total: number };
      }>((resolve) => {
        resolveStaleRequest = resolve;
      });
      mockGetFirstLevelGlossaryTermsPaginated.mockImplementationOnce(
        () => staleRequest
      );

      const stalePromise = useGlossaryStore
        .getState()
        .fetchChildrenCount('Finance.Revenue');

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(
          1
        );
      });

      // A reset happens while the request above is still in-flight (e.g.
      // the user navigates away and back to the same entity).
      useGlossaryStore.getState().resetChildrenCounts();

      // A fresh request for the SAME fqn fires and resolves first.
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 7 },
      });
      await useGlossaryStore.getState().fetchChildrenCount('Finance.Revenue');

      expect(
        useGlossaryStore.getState().childrenCounts['Finance.Revenue']
      ).toBe(7);

      // The stale, pre-reset request finally resolves with a different
      // count. It must be discarded, not applied.
      await act(async () => {
        resolveStaleRequest({ data: [], paging: { total: 4 } });
        await stalePromise;
      });

      expect(
        useGlossaryStore.getState().childrenCounts['Finance.Revenue']
      ).toBe(7);
    });

    // useGlossary.store seeds termsStatusFilter with the default filter
    // string, so a genuinely undefined termsStatusFilter here only happens
    // once the table has mounted and the user explicitly selected "All"
    // statuses and saved — it must NOT be defaulted, since that would
    // silently re-apply a filter the user just turned off.
    it('sends no entityStatus filter when termsStatusFilter is undefined (user selected All statuses)', async () => {
      useGlossaryStore.setState({ termsStatusFilter: undefined } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 9 },
      });

      renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
        'Finance.Revenue',
        0,
        undefined,
        undefined
      );
    });

    // Same root cause as the entityStatus mismatch: the table switches from
    // the plain listing API to the search API the moment a search term is
    // active (GlossaryTermTab.component.tsx's fetchAllTerms), so the badge
    // must switch with it via termsSearchTerm, or it keeps counting the
    // unfiltered listing while the table shows only the search matches.
    //
    // Uses AGGREGATE_PAGE_SIZE_LARGE (1000) + data.length, not limit: 0 +
    // paging.total: the search endpoint's `limit` has a server-side @Min(1)
    // constraint (limit: 0 is rejected outright), and even with a valid
    // limit its paging.total is a pagination heuristic
    // (offset + terms.size() + (hasMore ? 1 : 0)), not a real count — the
    // table itself already works around this the same way (its own
    // fetchAllTerms uses data.length for the search branch). 1000, not the
    // table's own PAGE_SIZE_LARGE (50): the badge is a one-shot count with
    // no "load more" to fall back on, so a 50-row cap would silently
    // undercount any term with more than 50 matching children.
    it('uses the search API with AGGREGATE_PAGE_SIZE_LARGE and counts the returned rows, not paging.total, when termsSearchTerm is set', async () => {
      useGlossaryStore.setState({
        termsStatusFilter: 'Approved,Draft,In Review',
        termsSearchTerm: 'bridge',
      } as never);
      mockSearchGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [{ id: 'bridge-term' }],
        // Deliberately misleading paging.total (the search endpoint's own
        // pagination heuristic) to prove the count comes from data.length.
        paging: { total: 99 },
      });

      renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockSearchGlossaryTermsPaginated).toHaveBeenCalledWith({
        q: 'bridge',
        glossaryFqn: 'Finance.Revenue',
        limit: 1000,
        offset: 0,
        entityStatus: 'Approved,Draft,In Review',
      });
      expect(mockGetFirstLevelGlossaryTermsPaginated).not.toHaveBeenCalled();
      // The badge must show 1 (data.length), not 99 (the misleading
      // paging.total above).
      expect(mockGetCountBadge).toHaveBeenLastCalledWith(1, '', false);
    });

    // The concrete regression this guards: with the old PAGE_SIZE_LARGE
    // (50) limit, a term with more than 50 matching children would have
    // its badge silently capped at 50 while the table (which can "load
    // more") displays the true, larger count.
    it('does not cap the count at 50 when more than 50 terms match the search', async () => {
      useGlossaryStore.setState({ termsSearchTerm: 'bridge' } as never);
      mockSearchGlossaryTermsPaginated.mockResolvedValueOnce({
        data: Array.from({ length: 60 }, (_, i) => ({ id: `term-${i}` })),
        paging: { total: 60 },
      });

      renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockGetCountBadge).toHaveBeenLastCalledWith(60, '', false);
    });

    // Real reviewer feedback: fetchAllTerms's own search branch supports
    // "load more" via offset/hasMore, exactly like the plain listing does —
    // a single AGGREGATE_PAGE_SIZE_LARGE (1000) request silently truncated
    // the badge for any term with more than 1000 matching children, the
    // same category of bug as the earlier 50-row cap above.
    it('pages through offset/hasMore and sums every page when more than 1000 terms match the search', async () => {
      useGlossaryStore.setState({ termsSearchTerm: 'bridge' } as never);
      mockSearchGlossaryTermsPaginated
        .mockResolvedValueOnce({
          data: Array.from({ length: 1000 }, (_, i) => ({ id: `term-${i}` })),
          paging: { total: 1001 },
        })
        .mockResolvedValueOnce({
          data: Array.from({ length: 250 }, (_, i) => ({
            id: `term-${1000 + i}`,
          })),
          paging: { total: 1251 },
        });

      renderGlossaryTermsTabLabel();

      await waitFor(() => {
        expect(mockGetCountBadge).toHaveBeenLastCalledWith(1250, '', false);
      });

      expect(mockSearchGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
      expect(mockSearchGlossaryTermsPaginated).toHaveBeenNthCalledWith(1, {
        q: 'bridge',
        glossaryFqn: 'Finance.Revenue',
        limit: 1000,
        offset: 0,
        entityStatus: undefined,
      });
      expect(mockSearchGlossaryTermsPaginated).toHaveBeenNthCalledWith(2, {
        q: 'bridge',
        glossaryFqn: 'Finance.Revenue',
        limit: 1000,
        offset: 1000,
        entityStatus: undefined,
      });
    });

    it('switches back to the plain listing API once the search term is cleared', async () => {
      useGlossaryStore.setState({ termsSearchTerm: 'bridge' } as never);
      mockSearchGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [{ id: 'bridge-term' }],
        paging: { total: 1 },
      });

      const { rerender } = renderGlossaryTermsTabLabel();

      await screen.findByTestId('terms');

      expect(mockSearchGlossaryTermsPaginated).toHaveBeenCalledTimes(1);

      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 5 },
      });

      useGlossaryStore.setState({ termsSearchTerm: undefined } as never);
      const tabs = getGlossaryTermDetailPageTabs(mockProps);
      const glossaryTermsTab = tabs.find(
        (t) => t.key === EntityTabs.GLOSSARY_TERMS
      );
      rerender(glossaryTermsTab?.label as React.ReactElement);

      await screen.findAllByTestId('terms');

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);
      expect(mockSearchGlossaryTermsPaginated).toHaveBeenCalledTimes(1);
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

  // Invariant: every tab rendered by the glossary term page MUST also be
  // registered in the customize-page tab IDs list. Without this guard, the
  // Customize UI seeds personas from an incomplete tab list, and saving any
  // edit (even unrelated, like moving a widget) silently drops the missing
  // tabs for that persona — exactly the regression from PR #25886 that hid
  // Relations Graph on the glossary term page.
  describe('tab registration invariant', () => {
    it('every key from getGlossaryTermDetailPageTabs is registered in getGlossaryTermDetailPageTabsIds', () => {
      const renderedKeys = getGlossaryTermDetailPageTabs(mockProps).map(
        (t) => t.key
      );
      const registeredIds = glossaryTermClassBase
        .getGlossaryTermDetailPageTabsIds()
        .map((t) => t.id);

      renderedKeys.forEach((key) => {
        expect(registeredIds).toContain(key);
      });
    });

    it('every key from glossaryTermClassBase.getGlossaryTermDetailPageTabs is registered (covers wrapper-added tabs like DATA_OBSERVABILITY)', () => {
      const renderedKeys = glossaryTermClassBase
        .getGlossaryTermDetailPageTabs(mockProps)
        .map((t) => t.key);
      const registeredIds = glossaryTermClassBase
        .getGlossaryTermDetailPageTabsIds()
        .map((t) => t.id);

      renderedKeys.forEach((key) => {
        expect(registeredIds).toContain(key);
      });
    });

    it('RELATIONS_GRAPH is rendered AND registered', () => {
      const renderedKeys = getGlossaryTermDetailPageTabs(mockProps).map(
        (t) => t.key
      );
      const registeredIds = glossaryTermClassBase
        .getGlossaryTermDetailPageTabsIds()
        .map((t) => t.id);

      expect(renderedKeys).toContain(EntityTabs.RELATIONS_GRAPH);
      expect(registeredIds).toContain(EntityTabs.RELATIONS_GRAPH);
    });
  });
});
