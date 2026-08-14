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
import { useTableFilters } from './useTableFilters';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useTableFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Regression guard: consumers such as usePaging capture setFilters in the
  // dependency array of memoized callbacks (handlePageChange). If setFilters
  // gets a new identity on every render, those callbacks churn every render,
  // which silently cancels debounced work (e.g. the metrics list search box).
  it('keeps setFilters referentially stable across re-renders', () => {
    const { result, rerender } = renderHook(
      () => useTableFilters({ search: '' }),
      { wrapper }
    );

    const firstSetFilters = result.current.setFilters;

    rerender();

    expect(result.current.setFilters).toBe(firstSetFilters);
  });

  it('updates the url query params when setFilters is called', () => {
    const { result } = renderHook(() => useTableFilters({ search: '' }), {
      wrapper,
    });

    act(() => {
      result.current.setFilters({ search: 'sales' });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { search: expect.stringContaining('search=sales') },
      { replace: true }
    );
  });
});
