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
import { GRID_PAGE_SIZE_OPTIONS } from '../../constants/constants';
import { usePersistentStorage } from '../currentUserStore/useCurrentUserStore';
import { usePageSizeState } from './usePageSizeState';

jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: { name: 'size-user' } })
  ),
}));

const savedPreferences = () =>
  usePersistentStorage.getState().preferences['size-user'];

describe('usePageSizeState', () => {
  beforeEach(() =>
    usePersistentStorage.getState().clearUserPreference('size-user')
  );

  it('starts from the size last saved on its scale', () => {
    usePersistentStorage
      .getState()
      .setUserPreference('size-user', { globalPageSize: 25 });

    const { result } = renderHook(() => usePageSizeState());

    expect(result.current[0]).toBe(25);
  });

  it('applies and saves a picked list size', () => {
    const { result } = renderHook(() => usePageSizeState());

    act(() => result.current[1](50));

    expect(result.current[0]).toBe(50);
    expect(savedPreferences().globalPageSize).toBe(50);
  });

  it('saves a picked grid size to the grid preference only', () => {
    const { result } = renderHook(() =>
      usePageSizeState(GRID_PAGE_SIZE_OPTIONS)
    );

    expect(result.current[0]).toBe(12);

    act(() => result.current[1](24));

    expect(result.current[0]).toBe(24);
    expect(savedPreferences().globalGridPageSize).toBe(24);
    expect(savedPreferences().globalPageSize).toBe(15);
  });
});
