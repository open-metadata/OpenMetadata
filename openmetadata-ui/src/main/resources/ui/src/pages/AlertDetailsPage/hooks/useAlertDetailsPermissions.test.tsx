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
import { useAlertDetailsPermissions } from './useAlertDetailsPermissions';

/**
 * Characterization suite (Task 9, Step 0). Two kinds of cases here:
 *
 * 1. PINNED behavior — originally written against the pre-fold
 *    implementation's own dependency (usePermissionProvider), confirmed to
 *    PASS on the old code. The hook is now folded onto useEntityPermissions,
 *    so the mock target moved to rest/permissionAPI's getEntityPermissionByFqn
 *    (react-query owned, the same seam useEntityPermissions.test.tsx mocks) —
 *    every pinned case below is unchanged in intent.
 * 2. INTENTIONAL CHANGE — editOwnersPermission/editDescriptionPermission move
 *    from a bare `EditAll || EditX` OR to prioritized derivation
 *    (field-explicit-deny wins over a blanket EditAll grant), matching the
 *    canViewBasic precedent documented in PermissionDerivation.ts. These
 *    cases assert the NEW intended behavior and were confirmed to FAIL (RED)
 *    against the old code (bare OR granted true) before the fold — that
 *    failure is the RED evidence for the change.
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

const toApiResponse = (flags: Record<string, boolean>) => ({
  resource: 'eventsubscription',
  permissions: Object.entries(flags).map(([operation, allow]) => ({
    operation,
    access: allow ? Access.Allow : Access.Deny,
  })),
});

const renderAlertPermissions = (fqn: string) =>
  renderHook(() => useAlertDetailsPermissions(fqn), {
    wrapper: createWrapper(),
  });

describe('useAlertDetailsPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEntityPermissionByFqn.mockResolvedValue(
      toApiResponse({
        ViewAll: true,
        ViewBasic: true,
        EditAll: true,
        EditOwners: true,
        EditDescription: true,
        Delete: true,
      })
    );
  });

  describe('pinned behavior', () => {
    it('grants view via bare ViewAll (unaffected by the fold — hasViewAccess is also a bare OR)', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ ViewAll: true, ViewBasic: false })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() => expect(result.current.viewPermission).toBe(true));
    });

    it('grants view via bare ViewBasic alone', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ ViewAll: false, ViewBasic: true })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() => expect(result.current.viewPermission).toBe(true));
    });

    it('denies view when neither ViewAll nor ViewBasic is granted', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ ViewAll: false, ViewBasic: false })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalled()
      );

      expect(result.current.viewPermission).toBe(false);
    });

    it('mirrors EditAll directly for editPermission', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ EditAll: false })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalled()
      );

      expect(result.current.editPermission).toBe(false);
    });

    it('mirrors Delete directly for deletePermission', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ Delete: true })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() => expect(result.current.deletePermission).toBe(true));
    });

    it('grants editOwnersPermission via EditAll fallback when EditOwners is not present', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ EditAll: true })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(result.current.editOwnersPermission).toBe(true)
      );
    });

    it('grants editDescriptionPermission via EditAll fallback when EditDescription is not present', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ EditAll: true })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(result.current.editDescriptionPermission).toBe(true)
      );
    });

    it('does not fetch and reports every permission false when fqn is empty', () => {
      const { result } = renderAlertPermissions('');

      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      expect(result.current.viewPermission).toBe(false);
      expect(result.current.editPermission).toBe(false);
      expect(result.current.deletePermission).toBe(false);
    });

    it('fetches against the EVENT_SUBSCRIPTION resource for the given fqn', async () => {
      renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          ResourceEntity.EVENT_SUBSCRIPTION,
          'alert.fqn'
        )
      );
    });

    it('settles loading to false once the fetch resolves', async () => {
      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() => expect(result.current.loading).toBe(false));
    });
  });

  // Not part of the OR-vs-prioritized change, but also RED against the old
  // code: the old fetchResourcePermission has a try/finally with no catch, so
  // a rejected fetch is an unhandled promise rejection (Jest fails the test
  // outright rather than reporting a wrong value). useEntityPermissions
  // (react-query) catches the rejection internally and degrades to
  // DEFAULT_ENTITY_PERMISSION — a fold-incidental robustness fix, called out
  // separately from the deny-wins behavior change above.
  describe('incidental fix: a rejected fetch no longer crashes the test', () => {
    it('degrades to no permission when the fetch rejects', async () => {
      mockGetEntityPermissionByFqn.mockRejectedValue(new Error('403'));

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.viewPermission).toBe(false);
      expect(result.current.editPermission).toBe(false);
      expect(result.current.deletePermission).toBe(false);
    });
  });

  describe('intentional change: explicit-deny-wins for editOwners/editDescription (RED on old code)', () => {
    it('denies editOwnersPermission when EditOwners is explicitly false, even with EditAll true', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ EditAll: true, EditOwners: false })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalled()
      );
      // Old code: `EditAll || EditOwners` — bare OR grants true here.
      // New code: prioritized derivation — an explicit per-field deny wins.
      await waitFor(() =>
        expect(result.current.editOwnersPermission).toBe(false)
      );
    });

    it('denies editDescriptionPermission when EditDescription is explicitly false, even with EditAll true', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue(
        toApiResponse({ EditAll: true, EditDescription: false })
      );

      const { result } = renderAlertPermissions('alert.fqn');

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalled()
      );
      // Old code: `EditAll || EditDescription` — bare OR grants true here.
      // New code: prioritized derivation — an explicit per-field deny wins.
      await waitFor(() =>
        expect(result.current.editDescriptionPermission).toBe(false)
      );
    });
  });
});
