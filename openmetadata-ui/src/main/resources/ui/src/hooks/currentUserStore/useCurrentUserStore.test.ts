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
import { renderHook, waitFor } from '@testing-library/react';
import { ApplicationStore } from '../../interface/store.interface';
import { deleteUserPreference, putUserPreference } from '../../rest/userAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { useApplicationStore } from '../useApplicationStore';
import {
  hydrateBackendSyncedPreferences,
  resetBackendSyncState,
  useCurrentUserPreferences,
  usePersistentStorage,
  UserPreferences,
} from './useCurrentUserStore';

// Mock the useApplicationStore
jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../constants/constants', () => ({
  PAGE_SIZE_BASE: 15,
}));

jest.mock('../../rest/userAPI', () => ({
  putUserPreference: jest.fn(),
  deleteUserPreference: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;

const putUserPreferenceMock = putUserPreference as jest.Mock;
const deleteUserPreferenceMock = deleteUserPreference as jest.Mock;
const showErrorToastMock = showErrorToast as jest.Mock;

// Test helper: seeds useApplicationStore's currentUser (id + name) and,
// optionally, the local persisted slice for that user — mirroring what a
// prior hydration/local write would have produced.
const seedCurrentUser = ({
  id,
  name,
  preferences,
}: {
  id: string;
  name: string;
  preferences?: Record<string, unknown>;
}) => {
  mockUseApplicationStore.mockImplementation((selector) => {
    const mockState = {
      currentUser: { id, name },
    } as unknown as ApplicationStore;

    return selector(mockState);
  });

  if (preferences) {
    usePersistentStorage.getState().setUserPreference(name, preferences);
  }
};

// Test helper: renders useCurrentUserPreferences and returns its current
// setPreference callback.
const renderUseCurrentUserPreferences = () => {
  const { result } = renderHook(() => useCurrentUserPreferences());

  return result.current;
};

describe('useCurrentUserStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Proper store reset
    usePersistentStorage.setState({ preferences: {} });
    resetBackendSyncState();

    // Set up the default mock implementation
    mockUseApplicationStore.mockImplementation((selector) => {
      // Default mock state with type assertion
      const mockState = {
        currentUser: null,
        // Add other properties as needed
      } as unknown as ApplicationStore;

      return selector(mockState);
    });
  });

  const defaultPreferences = {
    isSidebarCollapsed: false,
    selectedEntityTableColumns: {},
    globalPageSize: 15,
    recentlySearched: [],
    recentlyViewed: [],
    recentlyViewedQuickLinks: [],
    marketplaceRecentSearches: [],
    appMode: null,
  };

  describe('useCurrentUserPreferences', () => {
    it('should return default preferences when no current user', () => {
      const { result } = renderHook(() => useCurrentUserPreferences());

      expect(result.current.preferences).toEqual(defaultPreferences);
    });

    it('should handle setPreference when no current user', () => {
      const { result } = renderHook(() => useCurrentUserPreferences());

      result.current.setPreference({
        isSidebarCollapsed: true,
      });

      // Preferences should remain default since no user
      expect(result.current.preferences).toEqual({
        ...defaultPreferences,
        isSidebarCollapsed: false,
      });
    });

    it('should return user preferences when they exist', async () => {
      // Mock currentUser properly
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'testUser' },
        } as unknown as ApplicationStore;

        return selector(mockState);
      });

      const { result } = renderHook(() => useCurrentUserPreferences());

      // Set preferences directly through the setPreference method
      await waitFor(async () => {
        result.current.setPreference({
          isSidebarCollapsed: true,
        });
      });

      // Direct check without waitFor
      expect(result.current.preferences).toEqual({
        ...defaultPreferences,
        isSidebarCollapsed: true,
      });
    });

    it('should spread language key from defaultPreferences for existing user without language preference', async () => {
      // Mock currentUser properly
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'oldUser' },
        } as unknown as ApplicationStore;

        return selector(mockState);
      });

      // Simulate an old user who has some preferences but no language key
      // by directly setting the store state (bypassing setPreference which would add language)
      usePersistentStorage.setState({
        preferences: {
          oldUser: {
            isSidebarCollapsed: true,
            selectedEntityTableColumns: { table1: ['col1', 'col2'] },
            // Note: language key is missing - simulating old user data
          } as unknown as UserPreferences,
        },
      });

      const { result } = renderHook(() => useCurrentUserPreferences());

      // Should spread language from defaultPreferences since it's missing
      expect(result.current.preferences).toEqual({
        isSidebarCollapsed: true,
        selectedEntityTableColumns: { table1: ['col1', 'col2'] },
        globalPageSize: 15,
        recentlySearched: [],
        recentlyViewed: [],
        recentlyViewedQuickLinks: [],
        marketplaceRecentSearches: [],
        appMode: null,
      });
    });

    it('should preserve existing language preference when user has it', async () => {
      // Mock currentUser properly
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'userWithLanguage' },
        } as unknown as ApplicationStore;

        return selector(mockState);
      });

      // Simulate a user who already has language preference stored
      usePersistentStorage.setState({
        preferences: {
          userWithLanguage: {
            isSidebarCollapsed: false,
            selectedEntityTableColumns: {},
            globalPageSize: 15,
            recentlySearched: [],
            recentlyViewed: [],
            recentlyViewedQuickLinks: [],
            marketplaceRecentSearches: [],
            appMode: null,
          },
        },
      });

      const { result } = renderHook(() => useCurrentUserPreferences());

      // Should preserve the existing language preference
      expect(result.current.preferences).toEqual({
        isSidebarCollapsed: false,
        selectedEntityTableColumns: {},
        globalPageSize: 15,
        recentlySearched: [],
        recentlyViewed: [],
        recentlyViewedQuickLinks: [],
        marketplaceRecentSearches: [],
        appMode: null,
      });
    });

    // Regression guard: usePaging captures setPreference in the dependency
    // array of handlePageChange. An unstable setPreference identity recreates
    // handlePageChange every render, which silently cancels debounced work such
    // as the metrics list search box.
    it('keeps setPreference referentially stable across re-renders', () => {
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'stableUser' },
        } as unknown as ApplicationStore;

        return selector(mockState);
      });

      const { result, rerender } = renderHook(() =>
        useCurrentUserPreferences()
      );

      const firstSetPreference = result.current.setPreference;

      rerender();

      expect(result.current.setPreference).toBe(firstSetPreference);
    });
  });

  describe('backend-synced appMode', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('hydrates appMode from userPreferences on bootstrap (server wins)', () => {
      const userName = 'alice';
      usePersistentStorage
        .getState()
        .setUserPreference(userName, { appMode: 'classic' });

      hydrateBackendSyncedPreferences(
        { id: 'u1', name: userName },
        { preferences: [{ type: 'appMode', config: { value: 'ai' } }] }
      );

      const slice = usePersistentStorage.getState().preferences[userName];

      expect(slice.appMode).toBe('ai');
      expect(slice.isSidebarCollapsed).toBe(false); // local-only field untouched
    });

    it('does not touch appMode when neither server nor local has a value', () => {
      const userName = 'bob';
      // local slice default appMode is null

      hydrateBackendSyncedPreferences(
        { id: 'u1', name: userName },
        { preferences: [] }
      );

      const slice = usePersistentStorage.getState().preferences[userName];

      expect(slice?.appMode ?? null).toBeNull();
    });

    it('debounces a PUT when appMode is written', async () => {
      jest.useFakeTimers();
      seedCurrentUser({ id: 'u1', name: 'alice' });

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: 'ai' });

      expect(putUserPreferenceMock).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).toHaveBeenCalledTimes(1);
      expect(putUserPreferenceMock).toHaveBeenCalledWith('u1', 'appMode', {
        value: 'ai',
      });
    });

    it('coalesces rapid writes into a single PUT with the last value', async () => {
      jest.useFakeTimers();
      seedCurrentUser({ id: 'u1', name: 'alice' });

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: 'ai' });
      setPreference({ appMode: 'classic' });
      setPreference({ appMode: 'ai' });

      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).toHaveBeenCalledTimes(1);
      expect(putUserPreferenceMock).toHaveBeenCalledWith('u1', 'appMode', {
        value: 'ai',
      });
    });

    it('does not PUT when a non-whitelisted key is written', async () => {
      jest.useFakeTimers();
      seedCurrentUser({ id: 'u1', name: 'alice' });

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ isSidebarCollapsed: true });
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).not.toHaveBeenCalled();
      expect(
        usePersistentStorage.getState().preferences.alice.isSidebarCollapsed
      ).toBe(true);
    });

    it('emits a DELETE when appMode is set to null (and server had the key)', async () => {
      jest.useFakeTimers();
      seedCurrentUser({
        id: 'u1',
        name: 'alice',
        preferences: { appMode: 'ai' },
      });
      // Seed serverKnown so the DELETE is emitted — see the skip-remove test
      // below for the absent-key case.
      hydrateBackendSyncedPreferences(
        { id: 'u1', name: 'alice' },
        {
          preferences: [{ type: 'appMode', config: { value: 'ai' } }],
        }
      );

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: null });
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(deleteUserPreferenceMock).toHaveBeenCalledWith('u1', 'appMode');
      expect(putUserPreferenceMock).not.toHaveBeenCalled();
    });

    it('skips the request entirely when null is set on a key the server never had', async () => {
      // Regression: a DELETE on a key the server never persisted would be a
      // wasted round trip for what is semantically already a no-op.
      jest.useFakeTimers();
      // Seed hydration with an empty server-known state — no `appMode`.
      seedCurrentUser({
        id: 'u1',
        name: 'alice',
        preferences: {},
      });

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: null });
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).not.toHaveBeenCalled();
      expect(deleteUserPreferenceMock).not.toHaveBeenCalled();
    });

    it('rolls back local state and toasts when the PUT fails', async () => {
      jest.useFakeTimers();
      seedCurrentUser({
        id: 'u1',
        name: 'alice',
        preferences: { appMode: 'classic' },
      });
      putUserPreferenceMock.mockRejectedValue(new Error('boom'));

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: 'ai' });
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve(); // let the catch handler run

      expect(usePersistentStorage.getState().preferences.alice.appMode).toBe(
        'classic'
      );
      expect(showErrorToastMock).toHaveBeenCalledTimes(1);
    });

    it('migrates local appMode to backend when server has none', async () => {
      jest.useFakeTimers();
      usePersistentStorage
        .getState()
        .setUserPreference('alice', { appMode: 'ai' });
      putUserPreferenceMock.mockResolvedValue({
        preferences: [{ type: 'appMode', config: { value: 'ai' } }],
      });

      hydrateBackendSyncedPreferences(
        { id: 'u1', name: 'alice' },
        { preferences: [] }
      );
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).toHaveBeenCalledWith('u1', 'appMode', {
        value: 'ai',
      });
    });

    it('does not migrate when the server already has appMode', async () => {
      jest.useFakeTimers();
      usePersistentStorage
        .getState()
        .setUserPreference('alice', { appMode: 'ai' });

      hydrateBackendSyncedPreferences(
        { id: 'u1', name: 'alice' },
        { preferences: [{ type: 'appMode', config: { value: 'classic' } }] }
      );
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).not.toHaveBeenCalled();
      expect(usePersistentStorage.getState().preferences.alice.appMode).toBe(
        'classic'
      );
    });

    it('resetBackendSyncState clears pending patch state so a re-login with different user does not leak', async () => {
      jest.useFakeTimers();
      seedCurrentUser({ id: 'u1', name: 'alice' });
      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: 'ai' });

      // Simulate logout before the debounce fires.
      resetBackendSyncState();

      // Re-login as a different user; their write should get its own PUT.
      seedCurrentUser({ id: 'u2', name: 'bob' });
      const bobHook = renderUseCurrentUserPreferences();
      bobHook.setPreference({ appMode: 'classic' });

      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(putUserPreferenceMock).toHaveBeenCalledTimes(1);
      expect(putUserPreferenceMock).toHaveBeenCalledWith('u2', 'appMode', {
        value: 'classic',
      });
    });

    it('does not roll back a key whose local value has changed since the failed attempt', async () => {
      jest.useFakeTimers();
      seedCurrentUser({
        id: 'u1',
        name: 'alice',
        preferences: { appMode: 'classic' },
      });

      // First PUT will hang; capture its resolver so we can reject after a newer write.
      let rejectFirst: (e: Error) => void = () => {};
      putUserPreferenceMock.mockImplementationOnce(
        () =>
          new Promise((_res, rej) => {
            rejectFirst = rej;
          })
      );

      const { setPreference } = renderUseCurrentUserPreferences();
      setPreference({ appMode: 'ai' }); // triggers first flush at t=300ms
      jest.advanceTimersByTime(300);
      await Promise.resolve(); // let the flush await hit await

      expect(putUserPreferenceMock).toHaveBeenCalledTimes(1);

      // Newer optimistic write while the earlier PUT is still in flight.
      // Deliberately distinct from both the original seed ('classic') and the
      // in-flight attempt ('ai') so a naive rollback-to-pre-attempt-value is
      // observably wrong: it would clobber 'auto' with 'classic'.
      setPreference({ appMode: 'auto' });

      expect(usePersistentStorage.getState().preferences.alice.appMode).toBe(
        'auto'
      );

      // Now the earlier PUT rejects; rollback must NOT restore the
      // pre-attempt value ('classic') because the local value has diverged
      // from what we tried to write ('ai') — a newer write ('auto') landed.
      rejectFirst(new Error('boom'));
      await Promise.resolve();
      await Promise.resolve();

      expect(usePersistentStorage.getState().preferences.alice.appMode).toBe(
        'auto'
      );
      expect(showErrorToastMock).toHaveBeenCalledTimes(1);
    });
  });
});
