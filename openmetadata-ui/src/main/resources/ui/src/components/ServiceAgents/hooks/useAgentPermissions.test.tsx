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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Access } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { getEntityPermissionByFqn } from '../../../rest/permissionAPI';
import { useAgentPermissions } from './useAgentPermissions';

/**
 * Characterization suite (Task 9, Step 0) — pins the observable behavior of
 * useAgentPermissions. Originally written against the usePermissionProvider
 * mock (the pre-fold implementation's own dependency) and confirmed to PASS
 * there; the hook is now folded onto useBulkEntityPermissions, so the mock
 * target moved to rest/permissionAPI's getEntityPermissionByFqn (the same
 * seam useBulkEntityPermissions.test.tsx mocks) — every case below is
 * unchanged in intent, none of this hook's derivations are the
 * OR-vs-prioritized shape called out for useAlertDetailsPermissions.
 */
jest.mock('../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn(),
}));

const mockGetEntityPermissionByFqn = getEntityPermissionByFqn as jest.Mock;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const GRANTED_RESPONSE = {
  resource: 'ingestionPipeline',
  permissions: [
    { operation: 'Trigger', access: Access.Allow },
    { operation: 'EditAll', access: Access.Allow },
    { operation: 'Delete', access: Access.Allow },
  ],
};

describe('useAgentPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityPermissionByFqn.mockImplementation((_resource, fqn: string) =>
      fqn === 'bad'
        ? Promise.reject(new Error('403'))
        : Promise.resolve(GRANTED_RESPONSE)
    );
  });

  it('starts with a no-permission placeholder per fqn before the fetch resolves', () => {
    // Pre-fold, the map started genuinely empty ({}) until the
    // Promise.allSettled loop resolved. Post-fold, useBulkEntityPermissions's
    // combine() always derives an entry per fqn (defaulting to
    // DEFAULT_ENTITY_PERMISSION while the query is in flight), so the
    // pre-resolve value is a same-shape all-false entry instead of a missing
    // key. This is not consumer-visible: agents.utils.ts's
    // NO_AGENT_PERMISSIONS (the fallback every consumer already applies to a
    // missing map entry) is exactly { trigger: false, edit: false, delete:
    // false } — the same value this placeholder now provides directly.
    const { result } = renderHook(() => useAgentPermissions(['agentA']), {
      wrapper: createWrapper(),
    });

    expect(result.current.agentPermissions).toEqual({
      agentA: { trigger: false, edit: false, delete: false },
    });
  });

  it('resolves a permission entry per fqn keyed by fqn', async () => {
    const { result } = renderHook(
      () => useAgentPermissions(['agentA', 'agentB']),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(result.current.agentPermissions).toEqual({
        agentA: { trigger: true, edit: true, delete: true },
        agentB: { trigger: true, edit: true, delete: true },
      })
    );
  });

  it('degrades a failed lookup to no-permission for that fqn only', async () => {
    const { result } = renderHook(
      () => useAgentPermissions(['agentA', 'bad']),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(result.current.agentPermissions).toEqual({
        agentA: { trigger: true, edit: true, delete: true },
        bad: { trigger: false, edit: false, delete: false },
      })
    );
  });

  it('maps false when a named operation key is absent from the response', async () => {
    mockGetEntityPermissionByFqn.mockResolvedValueOnce({
      resource: 'ingestionPipeline',
      permissions: [{ operation: 'EditAll', access: Access.Allow }],
    });

    const { result } = renderHook(() => useAgentPermissions(['agentA']), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.agentPermissions).toEqual({
        agentA: { trigger: false, edit: true, delete: false },
      })
    );
  });

  it('empty fqns resolve to an empty map without any fetch', () => {
    const { result } = renderHook(() => useAgentPermissions([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.agentPermissions).toEqual({});
    expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
  });

  it('fetches every fqn against the given resourceEntity', async () => {
    renderHook(
      () =>
        useAgentPermissions(
          ['agentA', 'agentB'],
          ResourceEntity.INGESTION_PIPELINE
        ),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(2)
    );

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
      ResourceEntity.INGESTION_PIPELINE,
      'agentA'
    );
    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
      ResourceEntity.INGESTION_PIPELINE,
      'agentB'
    );
  });

  it('defaults resourceEntity to INGESTION_PIPELINE when not provided', async () => {
    renderHook(() => useAgentPermissions(['agentA']), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.INGESTION_PIPELINE,
        'agentA'
      )
    );
  });

  it('filters falsy fqns out of the fetch and the result map', async () => {
    const { result } = renderHook(
      () => useAgentPermissions(['agentA', '', 'agentB']),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(result.current.agentPermissions).toEqual({
        agentA: { trigger: true, edit: true, delete: true },
        agentB: { trigger: true, edit: true, delete: true },
      })
    );

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(2);
  });

  // Regression guard for the SSE-tick shape the old FQN_KEY_SEPARATOR
  // join/split machinery existed to handle: agent lists are re-mapped (a
  // brand-new array, same content) on every SSE progress tick, and that must
  // not cost a refetch. useBulkEntityPermissions keys its queries by
  // resource+fqn (not array identity) and PERMISSION_STALE_TIME covers the
  // rest, but nothing else in this suite pins that a NEW array with the SAME
  // fqns is actually a no-op fetch-wise — only that call args/counts are
  // correct for a single render.
  it('does not refetch on a new array literal with the same fqns (SSE-tick shape), but does on genuinely new fqns', async () => {
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ fqns }: { fqns: string[] }) => useAgentPermissions(fqns),
      { initialProps: { fqns: ['agentA', 'agentB'] }, wrapper }
    );

    await waitFor(() =>
      expect(result.current.agentPermissions).toEqual({
        agentA: { trigger: true, edit: true, delete: true },
        agentB: { trigger: true, edit: true, delete: true },
      })
    );

    const callsAfterFirstResolve =
      mockGetEntityPermissionByFqn.mock.calls.length;

    expect(callsAfterFirstResolve).toBe(2);

    // A brand-new array literal, same fqn content — the SSE-progress-tick
    // shape. Must not trigger any new fetch.
    rerender({ fqns: ['agentA', 'agentB'] });

    await waitFor(() =>
      expect(result.current.agentPermissions).toEqual({
        agentA: { trigger: true, edit: true, delete: true },
        agentB: { trigger: true, edit: true, delete: true },
      })
    );

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(
      callsAfterFirstResolve
    );

    // Genuinely different fqns must still fetch.
    rerender({ fqns: ['agentA', 'agentC'] });

    await waitFor(() =>
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.INGESTION_PIPELINE,
        'agentC'
      )
    );

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(
      callsAfterFirstResolve + 1
    );
  });
});
