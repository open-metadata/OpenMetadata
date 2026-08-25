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
import { renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
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

describe('usePaging (integration)', () => {
  it('keeps handlePageChange and handlePageSizeChange stable across re-renders', () => {
    const { result, rerender } = renderHook(() => usePaging(), { wrapper });

    const firstHandlePageChange = result.current.handlePageChange;
    const firstHandlePageSizeChange = result.current.handlePageSizeChange;

    rerender();

    expect(result.current.handlePageChange).toBe(firstHandlePageChange);
    expect(result.current.handlePageSizeChange).toBe(firstHandlePageSizeChange);
  });
});
