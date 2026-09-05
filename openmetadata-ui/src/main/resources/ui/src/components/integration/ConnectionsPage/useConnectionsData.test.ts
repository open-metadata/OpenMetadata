/*
 *  Copyright 2026 Collate.
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

import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { ServiceHealth } from '../../../generated/api/services/servicesOverview';
import { queryClient } from '../../../queryClient';
import { LIST_PAGE_SIZE_OPTIONS } from './ConnectionsPage.constants';
import { ConnectionsCategory, useConnectionsData } from './useConnectionsData';

const mockGetServicesOverview = jest.fn();
let routeActivationCallback: ((reason?: string) => void) | undefined;

jest.mock('../../../rest/serviceAPI', () => ({
  getServicesOverview: (...args: unknown[]) => mockGetServicesOverview(...args),
}));

jest.mock('../../platform/ai-shell/context/useRouteActivation', () => ({
  useRouteActivation: (callback: (reason?: string) => void) => {
    routeActivationCallback = callback;
  },
}));

// Minimal stand-in for the real usePaging hook: mirrors its externally observable behavior
// (current page, page size, reset-to-page-1 on resize) without its URL/user-preference machinery.
jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: (defaultPageSize?: number) => {
    const { useCallback, useState } = jest.requireActual('react');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(defaultPageSize ?? 10);
    const handlePageChange = useCallback(
      (page: number | ((page: number) => number)) => {
        setCurrentPage((current: number) =>
          typeof page === 'function' ? page(current) : page
        );
      },
      []
    );
    const handlePageSizeChange = useCallback((nextPageSize: number) => {
      setPageSize(nextPageSize);
      setCurrentPage(1);
    }, []);

    return {
      currentPage,
      handlePageChange,
      handlePageSizeChange,
      handlePagingChange: jest.fn(),
      paging: { total: 0 },
      pageSize,
      pagingCursor: {},
      showPagination: true,
    };
  },
}));

interface ServiceSpec {
  name: string;
  entityType?: string;
  serviceType?: string;
  health?: string;
}

const service = (spec: ServiceSpec) => ({
  entityType: spec.entityType ?? 'databaseService',
  fullyQualifiedName: spec.name,
  health: spec.health ?? 'success',
  id: `${spec.name}-id`,
  name: spec.name,
  serviceType: spec.serviceType ?? 'Mysql',
});

/** Builds a response whose count maps agree with its data, the way the endpoint's do. */
const overview = (specs: ServiceSpec[], total?: number) => {
  const data = specs.map(service);
  const counts: Record<string, number> = {};
  const serviceTypeCounts: Record<string, Record<string, number>> = {};
  const healthCounts: Record<string, Record<string, number>> = {};
  data.forEach((row) => {
    counts[row.entityType] = (counts[row.entityType] ?? 0) + 1;
    serviceTypeCounts[row.entityType] = serviceTypeCounts[row.entityType] ?? {};
    serviceTypeCounts[row.entityType][row.serviceType] =
      (serviceTypeCounts[row.entityType][row.serviceType] ?? 0) + 1;
    healthCounts[row.entityType] = healthCounts[row.entityType] ?? {};
    healthCounts[row.entityType][row.health] =
      (healthCounts[row.entityType][row.health] ?? 0) + 1;
  });

  return {
    counts,
    data,
    healthCounts,
    paging: { limit: 500, offset: 0, total: total ?? data.length },
    serviceTypeCounts,
    total: total ?? data.length,
  };
};

const withQueryClient = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: queryClient }, children);

const defaultArgs = {
  category: 'all' as ConnectionsCategory,
  healthStates: [] as ServiceHealth[],
  searchTerm: '',
  serviceTypes: [] as string[],
};

const renderConnections = (overrides: Partial<typeof defaultArgs> = {}) =>
  renderHook((props: typeof defaultArgs) => useConnectionsData(props), {
    initialProps: { ...defaultArgs, ...overrides },
    wrapper: withQueryClient,
  });

describe('useConnectionsData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    routeActivationCallback = undefined;
    mockGetServicesOverview.mockResolvedValue(
      overview([
        { name: 'alpha' },
        { name: 'bravo', serviceType: 'Postgres' },
        {
          entityType: 'dashboardService',
          name: 'charlie',
          serviceType: 'Looker',
        },
      ])
    );
  });

  it('loads the estate once and serves every tab from it', async () => {
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({
      ...defaultArgs,
      category: 'databaseServices' as ConnectionsCategory,
    });
    rerender({
      ...defaultArgs,
      category: 'dashboardServices' as ConnectionsCategory,
    });
    rerender({ ...defaultArgs, category: 'all' as ConnectionsCategory });

    expect(mockGetServicesOverview).toHaveBeenCalledTimes(1);
  });

  it('filters by search term without issuing a request', async () => {
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockGetServicesOverview.mockClear();

    rerender({ ...defaultArgs, searchTerm: 'brav' });

    await waitFor(() => expect(result.current.totalRows).toBe(1));

    expect(result.current.rows[0].name).toBe('bravo');
    expect(mockGetServicesOverview).not.toHaveBeenCalled();
  });

  it('matches the search term against displayName as well as name', async () => {
    mockGetServicesOverview.mockResolvedValue({
      ...overview([{ name: 'svc-1' }]),
      data: [
        { ...service({ name: 'svc-1' }), displayName: 'Marketing Warehouse' },
      ],
    });
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ ...defaultArgs, searchTerm: 'marketing' });

    await waitFor(() => expect(result.current.totalRows).toBe(1));
  });

  it('scopes rows to the active tab', async () => {
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({
      ...defaultArgs,
      category: 'dashboardServices' as ConnectionsCategory,
    });

    await waitFor(() => expect(result.current.totalRows).toBe(1));

    expect(result.current.rows[0].name).toBe('charlie');
  });

  it('treats an empty selection as no filter rather than match-nothing', async () => {
    const { result } = renderConnections({
      healthStates: [],
      serviceTypes: [],
    });

    await waitFor(() => expect(result.current.totalRows).toBe(3));
  });

  it('returns the union when several connectors are selected', async () => {
    const { result } = renderConnections({ serviceTypes: ['Mysql', 'Looker'] });

    await waitFor(() => expect(result.current.totalRows).toBe(2));

    expect(result.current.rows.map((row) => row.name).sort()).toEqual([
      'alpha',
      'charlie',
    ]);
  });

  it('filters by health', async () => {
    mockGetServicesOverview.mockResolvedValue(
      overview([
        { health: 'failed', name: 'broken' },
        { health: 'success', name: 'fine' },
      ])
    );
    const { result } = renderConnections({
      healthStates: ['failed'] as ServiceHealth[],
    });

    await waitFor(() => expect(result.current.totalRows).toBe(1));

    expect(result.current.rows[0].name).toBe('broken');
  });

  it('offers only connectors that exist, and a selection does not shrink the menu', async () => {
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(
      result.current.serviceTypeOptions.map((option) => option.value).sort()
    ).toEqual(['Looker', 'Mysql', 'Postgres']);

    rerender({ ...defaultArgs, serviceTypes: ['Mysql'] });

    await waitFor(() =>
      expect(
        result.current.serviceTypeOptions.map((option) => option.value).sort()
      ).toEqual(['Looker', 'Mysql', 'Postgres'])
    );
  });

  it('offers health states with counts, and a selection does not shrink the menu', async () => {
    mockGetServicesOverview.mockResolvedValue(
      overview([
        { health: 'failed', name: 'broken' },
        { health: 'success', name: 'fine' },
      ])
    );
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.healthOptions).toEqual([
      { count: 1, value: 'failed' },
      { count: 1, value: 'success' },
    ]);

    rerender({
      ...defaultArgs,
      healthStates: ['failed'] as ServiceHealth[],
    });

    await waitFor(() =>
      expect(
        result.current.healthOptions.map((option) => option.value)
      ).toEqual(['failed', 'success'])
    );
  });

  it('reverses without refetching when the sort is toggled', async () => {
    const { result } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockGetServicesOverview.mockClear();
    const ascending = result.current.rows.map((row) => row.name);

    act(() => {
      result.current.toggleSortOrder();
    });

    await waitFor(() =>
      expect(result.current.rows.map((row) => row.name)).toEqual(
        [...ascending].reverse()
      )
    );

    expect(mockGetServicesOverview).not.toHaveBeenCalled();
  });

  describe('page reset', () => {
    const goToPageThree = async (
      result: { current: ReturnType<typeof useConnectionsData> },
      rerender: (props: typeof defaultArgs) => void
    ) => {
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => {
        result.current.setPage(3);
      });
      await waitFor(() => expect(result.current.page).toBe(3));

      return rerender;
    };

    it('returns to page 1 when the tab changes', async () => {
      const { result, rerender } = renderConnections();
      await goToPageThree(result, rerender);

      rerender({
        ...defaultArgs,
        category: 'databaseServices' as ConnectionsCategory,
      });

      await waitFor(() => expect(result.current.page).toBe(1));
    });

    it('returns to page 1 when the search term changes', async () => {
      const { result, rerender } = renderConnections();
      await goToPageThree(result, rerender);

      rerender({ ...defaultArgs, searchTerm: 'alpha' });

      await waitFor(() => expect(result.current.page).toBe(1));
    });

    it('returns to page 1 when a filter changes', async () => {
      const { result, rerender } = renderConnections();
      await goToPageThree(result, rerender);

      rerender({ ...defaultArgs, serviceTypes: ['Mysql'] });

      await waitFor(() => expect(result.current.page).toBe(1));
    });

    it('keeps the page when only the sort order changes', async () => {
      const { result, rerender } = renderConnections();
      await goToPageThree(result, rerender);

      act(() => {
        result.current.toggleSortOrder();
      });

      await waitFor(() => expect(result.current.sortOrder).toBe('desc'));

      expect(result.current.page).toBe(3);
    });

    it('honours a deep-linked page on first load', async () => {
      const { result } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => {
        result.current.setPage(2);
      });

      // No filter changed, so the reset must not fire and clobber the restored page.
      await waitFor(() => expect(result.current.page).toBe(2));
    });
  });

  it('offers connectors for the tab even when a search excludes them', async () => {
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect([...result.current.serviceTypesInTab].sort()).toEqual([
      'Looker',
      'Mysql',
      'Postgres',
    ]);

    // Searching narrows the dropdown's counts but must not narrow the set a selected connector is
    // pruned against, or typing would silently delete the filter.
    rerender({ ...defaultArgs, searchTerm: 'alpha' });

    await waitFor(() =>
      expect([...result.current.serviceTypesInTab].sort()).toEqual([
        'Looker',
        'Mysql',
        'Postgres',
      ])
    );
  });

  describe('search debouncing', () => {
    it('filters locally on the very next render, without waiting', async () => {
      const { result, rerender } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      rerender({ ...defaultArgs, searchTerm: 'brav' });

      // No timers advanced: filtering an in-memory list bounded by the estate limit has nothing
      // to gain from a delay, and the lag is felt on every keystroke.
      expect(result.current.totalRows).toBe(1);
      expect(result.current.rows[0].name).toBe('bravo');
    });

    it('waits before asking the server, so typing is not a request per keystroke', async () => {
      mockGetServicesOverview.mockResolvedValue(
        overview([{ name: 'alpha' }], 501)
      );
      const { result, rerender } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mockGetServicesOverview.mockClear();

      rerender({ ...defaultArgs, searchTerm: 's' });
      rerender({ ...defaultArgs, searchTerm: 'sn' });
      rerender({ ...defaultArgs, searchTerm: 'sno' });

      expect(
        mockGetServicesOverview.mock.calls.filter(([params]) => params.q)
      ).toHaveLength(0);

      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() =>
        expect(
          mockGetServicesOverview.mock.calls.filter(([params]) => params.q)
        ).toHaveLength(1)
      );

      expect(mockGetServicesOverview.mock.calls.at(-1)?.[0].q).toBe('sno');
    });
  });

  describe('faceted counts', () => {
    // Two Mysql services, one healthy one failed, plus a Postgres one — enough for each filter
    // to move the other's counts without emptying it.
    const estate = () =>
      overview([
        { health: 'success', name: 'a-mysql-ok' },
        { health: 'failed', name: 'b-mysql-bad' },
        { health: 'failed', name: 'c-postgres-bad', serviceType: 'Postgres' },
      ]);

    beforeEach(() => {
      mockGetServicesOverview.mockResolvedValue(estate());
    });

    it('narrows connector counts by the health filter', async () => {
      const { result, rerender } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.serviceTypeOptions).toEqual([
        { count: 2, value: 'Mysql' },
        { count: 1, value: 'Postgres' },
      ]);

      rerender({
        ...defaultArgs,
        healthStates: ['failed'] as ServiceHealth[],
      });

      await waitFor(() =>
        expect(result.current.serviceTypeOptions).toEqual([
          { count: 1, value: 'Mysql' },
          { count: 1, value: 'Postgres' },
        ])
      );
    });

    it('narrows health counts by the connector filter', async () => {
      const { result, rerender } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      rerender({ ...defaultArgs, serviceTypes: ['Mysql'] });

      await waitFor(() =>
        expect(result.current.healthOptions).toEqual([
          { count: 1, value: 'failed' },
          { count: 1, value: 'success' },
        ])
      );
    });

    it('never narrows a filter by its own selection', async () => {
      const { result } = renderConnections({ serviceTypes: ['Mysql'] });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Postgres must remain offered, or picking Mysql would strand the user with no way back.
      expect(
        result.current.serviceTypeOptions.map((option) => option.value)
      ).toEqual(['Mysql', 'Postgres']);
    });

    it('narrows the tab badges by both filters', async () => {
      const { result, rerender } = renderConnections();
      await waitFor(() => expect(result.current.totalConnections).toBe(3));

      rerender({
        ...defaultArgs,
        healthStates: ['failed'] as ServiceHealth[],
      });

      await waitFor(() => expect(result.current.totalConnections).toBe(2));

      expect(result.current.categoryCounts.databaseServices).toBe(2);
    });

    it('composes search with the filters', async () => {
      const { result } = renderConnections({
        healthStates: ['failed'] as ServiceHealth[],
        searchTerm: 'mysql',
        serviceTypes: ['Mysql'],
      });

      await waitFor(() => expect(result.current.totalRows).toBe(1));

      expect(result.current.rows[0].name).toBe('b-mysql-bad');
    });
  });

  describe('deleted services', () => {
    it('requests only live services by default', async () => {
      const { result } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGetServicesOverview.mock.calls[0][0]).toEqual(
        expect.objectContaining({ include: 'non-deleted' })
      );
    });

    it('requests only deleted services when the switch is on', async () => {
      const { result } = renderConnections({ showDeleted: true } as never);
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGetServicesOverview.mock.calls[0][0]).toEqual(
        expect.objectContaining({ include: 'deleted' })
      );
    });

    it('returns to page 1 when the switch is toggled', async () => {
      const { result, rerender } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => {
        result.current.setPage(3);
      });
      await waitFor(() => expect(result.current.page).toBe(3));

      rerender({ ...defaultArgs, showDeleted: true } as never);

      await waitFor(() => expect(result.current.page).toBe(1));
    });
  });

  it('reports a total that cannot lag the active tab', async () => {
    const { result, rerender } = renderConnections();
    await waitFor(() => expect(result.current.totalRows).toBe(3));

    // Read synchronously, before flushing anything: a stored total would still report the
    // previous tab's 3 here, which is the regression this guards.
    rerender({
      ...defaultArgs,
      category: 'dashboardServices' as ConnectionsCategory,
    });

    expect(result.current.totalRows).toBe(1);
  });

  describe('above the client-side threshold', () => {
    beforeEach(() => {
      mockGetServicesOverview.mockResolvedValue(
        overview([{ name: 'alpha' }], 501)
      );
    });

    it('asks the server for each page instead of slicing locally', async () => {
      const { result } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const requests = mockGetServicesOverview.mock.calls.map(
        ([params]) => params
      );

      expect(requests).toHaveLength(2);
      // The page query asks for exactly one page, so the limit is the default list page size.
      expect(requests[1]).toEqual(
        expect.objectContaining({
          limit: LIST_PAGE_SIZE_OPTIONS[0],
          offset: 0,
        })
      );
    });

    it('sends the tab, search and both filters to the server', async () => {
      const { result } = renderConnections({
        category: 'databaseServices' as ConnectionsCategory,
        healthStates: ['failed'] as ServiceHealth[],
        searchTerm: 'alpha',
        serviceTypes: ['Mysql'],
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGetServicesOverview.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          health: ['failed'],
          listEntityType: ['databaseService'],
          q: 'alpha',
          serviceType: ['Mysql'],
        })
      );
    });

    it('omits a cleared filter rather than sending an empty list', async () => {
      const { result } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const pageRequest = mockGetServicesOverview.mock.calls.at(-1)?.[0];

      expect(pageRequest.serviceType).toBeUndefined();
      expect(pageRequest.health).toBeUndefined();
      expect(pageRequest.q).toBeUndefined();
    });
  });

  describe('cache revalidation', () => {
    it('refetches when the page reports it is dirty', async () => {
      const { result } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mockGetServicesOverview.mockClear();

      act(() => {
        routeActivationCallback?.('dirty');
      });

      await waitFor(() => expect(mockGetServicesOverview).toHaveBeenCalled());
    });

    it('does not refetch on a plain re-activation inside the TTL', async () => {
      const { result } = renderConnections();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mockGetServicesOverview.mockClear();

      act(() => {
        routeActivationCallback?.('focus');
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockGetServicesOverview).not.toHaveBeenCalled();
    });
  });
});
