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
import { ReactNode, useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { RouteVisibilityProvider } from '../../context/RouteVisibilityProvider/RouteVisibilityProvider';
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

  it('saves a grid size to the grid preference, leaving the list one alone', () => {
    const { result } = renderHook(() => usePaging(undefined, GRID_SIZES), {
      wrapper: wrapperAt('/connections'),
    });

    act(() => result.current.handlePageSizeChange(24));

    // Saving 24 as the list size would hand it to list pages, whose pickers have no 24.
    const saved = usePersistentStorage.getState().preferences['paging-user'];

    expect(saved.globalGridPageSize).toBe(24);
    expect(saved.globalPageSize).toBe(15);
  });

  it('remembers the size last picked on each scale', () => {
    usePersistentStorage.getState().setUserPreference('paging-user', {
      globalGridPageSize: 24,
      globalPageSize: 25,
    });

    const grid = renderHook(() => usePaging(undefined, GRID_SIZES), {
      wrapper,
    });
    const list = renderHook(() => usePaging(), { wrapper });

    expect(grid.result.current.pageSize).toBe(24);
    expect(list.result.current.pageSize).toBe(25);
  });

  it('starts from the size the caller asked for, whatever the preference holds', () => {
    usePersistentStorage
      .getState()
      .setUserPreference('paging-user', { globalPageSize: 50 });

    const { result } = renderHook(() => usePaging(25), { wrapper });

    // A caller that names a default never consults globalPageSize, so what this page persists to
    // it can only ever reach other pages — never come back to this one.
    expect(result.current.pageSize).toBe(25);
  });

  it('still records a size the app-wide scale offers', () => {
    const { result } = renderHook(() => usePaging(), { wrapper });

    act(() => result.current.handlePageSizeChange(50));

    expect(
      usePersistentStorage.getState().preferences['paging-user'].globalPageSize
    ).toBe(50);
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

  it("never hands out the old scale's size in the render where the options change", () => {
    const seen: number[] = [];
    const { rerender } = renderHook(
      ({ options }: { options: number[] }) => {
        const { pageSize } = usePaging(undefined, options);
        seen.push(pageSize);

        return pageSize;
      },
      {
        initialProps: { options: [15, 25, 50] },
        wrapper: wrapperAt('/settings/services?pageSize=25'),
      }
    );
    seen.length = 0;

    rerender({ options: GRID_SIZES });

    // A caller fetches with whatever it gets on each render, so a single 25 here is a request for
    // 25 cards under a picker that says 12.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((size) => size === 12)).toBe(true);
  });

  it('keeps a list-scale URL page size when the caller declares no options', () => {
    const { result } = renderHook(() => usePaging(), {
      wrapper: wrapperAt('/settings/services?pageSize=25'),
    });

    expect(result.current.pageSize).toBe(25);
  });

  it('puts a caller that declares no options on the list scale, not a grid size in the URL', () => {
    // The connections grid writes 48 to the shared `pageSize` param; a list page offering
    // 15/25/50 must not adopt it.
    const { result } = renderHook(() => usePaging(), {
      wrapper: wrapperAt('/settings/services?pageSize=48'),
    });

    expect(result.current.pageSize).toBe(15);
  });

  it('ignores an off-scale globalPageSize an older build stored', () => {
    usePersistentStorage
      .getState()
      .setUserPreference('paging-user', { globalPageSize: 48 });

    const { result } = renderHook(() => usePaging(), { wrapper });

    expect(result.current.pageSize).toBe(15);
  });

  describe('a page size from an old link', () => {
    const renderAt = (entry: string, isVisible = true) =>
      renderHook(() => ({ paging: usePaging(), location: useLocation() }), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <MemoryRouter initialEntries={[entry]}>
            <RouteVisibilityProvider isVisible={isVisible}>
              {children}
            </RouteVisibilityProvider>
          </MemoryRouter>
        ),
      });

    it('opens on page 1 without its cursor and drops its paging from the URL', () => {
      const { result } = renderAt(
        '/schema?currentPage=3&pageSize=10&cursorType=after&cursorValue=abc'
      );

      expect(result.current.paging.currentPage).toBe(1);
      expect(result.current.paging.pageSize).toBe(15);
      expect(result.current.paging.pagingCursor.cursorValue).toBeUndefined();
      expect(result.current.location.search).toBe('');
    });

    it('keeps the page of a link whose size is on the scale', () => {
      const { result } = renderAt('/schema?currentPage=3&pageSize=25');

      expect(result.current.paging.currentPage).toBe(3);
      expect(result.current.paging.pageSize).toBe(25);
      expect(result.current.location.search).toBe('?currentPage=3&pageSize=25');
    });

    it('leaves the URL alone while its route is hidden', () => {
      const { result } = renderAt('/schema?currentPage=3&pageSize=10', false);

      expect(result.current.location.search).toBe('?currentPage=3&pageSize=10');
    });
  });

  describe('a change to the saved size while the page stays mounted', () => {
    const renderTracked = (entry: string) => {
      const seen: Array<[number, number]> = [];
      const view = renderHook(
        () => {
          const paging = usePaging();
          seen.push([paging.currentPage, paging.pageSize]);

          return { paging, location: useLocation() };
        },
        { wrapper: wrapperAt(entry) }
      );

      return { ...view, seen };
    };

    const saveListSize = (size: number) =>
      act(() => {
        usePersistentStorage
          .getState()
          .setUserPreference('paging-user', { globalPageSize: size });
      });

    it('returns to page 1 without pairing the old page with the new size', () => {
      saveListSize(15);
      const { result, seen } = renderTracked('/schema?currentPage=3');

      expect(result.current.paging.currentPage).toBe(3);

      saveListSize(50);

      expect(result.current.paging.currentPage).toBe(1);
      expect(result.current.paging.pageSize).toBe(50);
      expect(result.current.paging.pagingCursor.currentPage).toBe('1');
      expect(result.current.location.search).toBe('');
      expect(seen).not.toContainEqual([3, 50]);
    });

    it('hands out the new size in the same render as pagingCursor', () => {
      saveListSize(15);
      const fetches: number[] = [];
      const mismatches: Array<[number, number | undefined]> = [];
      renderHook(
        () => {
          const paging = usePaging();
          useEffect(() => {
            if (paging.pageSize !== paging.pagingCursor.pageSize) {
              mismatches.push([paging.pageSize, paging.pagingCursor.pageSize]);
            }
          });
          useEffect(() => {
            fetches.push(paging.pageSize);
          }, [paging.pagingCursor]);

          return paging;
        },
        { wrapper: wrapperAt('/service') }
      );

      saveListSize(50);

      expect(mismatches).toEqual([]);
      expect(fetches[fetches.length - 1]).toBe(50);
    });

    it('keeps the page when the URL carries its own size', () => {
      saveListSize(15);
      const { result } = renderTracked('/schema?currentPage=3&pageSize=25');

      saveListSize(50);

      expect(result.current.paging.currentPage).toBe(3);
      expect(result.current.paging.pageSize).toBe(25);
      expect(result.current.location.search).toBe('?currentPage=3&pageSize=25');
    });
  });
});
