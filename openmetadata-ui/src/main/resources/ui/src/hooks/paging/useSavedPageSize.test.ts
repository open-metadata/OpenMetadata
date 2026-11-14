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
import { act, renderHook } from '@testing-library/react';
import {
  GRID_PAGE_SIZE_OPTIONS,
  LIST_PAGE_SIZE_OPTIONS,
} from '../../constants/constants';
import { usePersistentStorage } from '../currentUserStore/useCurrentUserStore';
import { useSavedPageSize } from './useSavedPageSize';

// Exercises the real preferences store; only the current user is stubbed.
jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: { name: 'saved-size-user' } })
  ),
}));

const savePreference = (preference: {
  globalPageSize?: number;
  globalGridPageSize?: number;
}) =>
  usePersistentStorage
    .getState()
    .setUserPreference('saved-size-user', preference);

describe('useSavedPageSize', () => {
  beforeEach(() =>
    usePersistentStorage.getState().clearUserPreference('saved-size-user')
  );

  it('starts each scale at its first step when nothing is saved', () => {
    const list = renderHook(() => useSavedPageSize());
    const grid = renderHook(() => useSavedPageSize(GRID_PAGE_SIZE_OPTIONS));

    expect(list.result.current.savedPageSize).toBe(15);
    expect(grid.result.current.savedPageSize).toBe(12);
  });

  it('reads each scale from its own preference', () => {
    savePreference({ globalPageSize: 50, globalGridPageSize: 24 });

    const list = renderHook(() => useSavedPageSize(LIST_PAGE_SIZE_OPTIONS));
    const grid = renderHook(() => useSavedPageSize(GRID_PAGE_SIZE_OPTIONS));

    expect(list.result.current.savedPageSize).toBe(50);
    expect(grid.result.current.savedPageSize).toBe(24);
  });

  it('falls back to the first step when an older build saved an off-scale size', () => {
    savePreference({ globalPageSize: 10 });

    const { result } = renderHook(() => useSavedPageSize());

    expect(result.current.savedPageSize).toBe(15);
  });

  it('saves a pick to the preference of the scale it belongs to', () => {
    const { result } = renderHook(() => useSavedPageSize());

    act(() => result.current.savePageSize(24));
    act(() => result.current.savePageSize(50));

    const saved =
      usePersistentStorage.getState().preferences['saved-size-user'];

    expect(saved.globalGridPageSize).toBe(24);
    expect(saved.globalPageSize).toBe(50);
  });

  it('lets a size from the URL or hash win only when the picker offers it', () => {
    savePreference({ globalPageSize: 25 });

    const { result } = renderHook(() => useSavedPageSize());

    // A shared link's size is honoured...
    expect(result.current.resolvePageSize(50)).toBe(50);
    // ...but an old link's 10, a grid's 24, or no size at all use the saved size.
    expect(result.current.resolvePageSize(10)).toBe(25);
    expect(result.current.resolvePageSize(24)).toBe(25);
    expect(result.current.resolvePageSize(undefined)).toBe(25);
  });
});
