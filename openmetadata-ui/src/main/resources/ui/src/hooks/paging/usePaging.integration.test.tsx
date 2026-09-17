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
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { usePersistentStorage } from '../currentUserStore/useCurrentUserStore';
import { usePaging } from './usePaging';

// This suite intentionally exercises the REAL useTableFilters and
// useCurrentUserPreferences (only the leaf useApplicationStore is mocked) so it
// guards the whole chain that broke the metrics list search: an unstable
// setFilters/setPreference used to give handlePageChange a fresh identity every
// render, which cancelled the debounced search before it could fire.
jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ currentUser: { name: 'paging-user' } })
  ),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

const wrapperAt = (entry: string) =>
  function RouteWrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
  };

// The connections grid's scale. Pages on the app-wide scale use 15/25/50.
const GRID_SIZES = [12, 24, 48];

describe('usePaging (integration)', () => {
  // handlePageSizeChange persists globalPageSize, so without this a case that picks a size
  // decides what the next case falls back to.
  beforeEach(() =>
    usePersistentStorage.getState().clearUserPreference('paging-user')
  );

  it('keeps handlePageChange and handlePageSizeChange stable across re-renders', () => {
    const { result, rerender } = renderHook(() => usePaging(), { wrapper });

    const firstHandlePageChange = result.current.handlePageChange;
    const firstHandlePageSizeChange = result.current.handlePageSizeChange;

    rerender();

    expect(result.current.handlePageChange).toBe(firstHandlePageChange);
    expect(result.current.handlePageSizeChange).toBe(firstHandlePageSizeChange);
  });

  it('ignores a page size from the URL that the caller has no option for', () => {
    const { result } = renderHook(() => usePaging(12, GRID_SIZES), {
      wrapper: wrapperAt('/connections?pageSize=15'),
    });

    // 15 reaches the Select as a selectedKey matching no item, so it renders as the placeholder —
    // a value in the control that the dropdown cannot offer back.
    expect(result.current.pageSize).toBe(12);
    expect(result.current.pagingCursor.pageSize).toBe(12);
  });

  it('keeps a size the caller does offer, even though the URL carried a foreign one', () => {
    const { result } = renderHook(() => usePaging(12, GRID_SIZES), {
      wrapper: wrapperAt('/connections?pageSize=15'),
    });

    act(() => result.current.handlePageSizeChange(24));

    expect(result.current.pageSize).toBe(24);
  });

  it('ignores a globalPageSize preference the caller has no option for', () => {
    // The other branch: with no `pageSize` in the URL the fallback is the app-wide preference,
    // which any page on another scale writes the moment its picker is used.
    const { result } = renderHook(() => usePaging(undefined, GRID_SIZES), {
      wrapper: wrapperAt('/connections'),
    });

    expect(result.current.pageSize).toBe(12);
  });

  it('takes the URL page size as-is when the caller declares no options', () => {
    const { result } = renderHook(() => usePaging(12), {
      wrapper: wrapperAt('/connections?pageSize=15'),
    });

    expect(result.current.pageSize).toBe(15);
  });
});
