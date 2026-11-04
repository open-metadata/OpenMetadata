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
import { useIncidentPaging } from './useIncidentPaging';

describe('useIncidentPaging', () => {
  it('should start on the first page in the default size', () => {
    const { result } = renderHook(() => useIncidentPaging('query', 10));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
  });

  it('should go straight to any page asked for', () => {
    const { result } = renderHook(() => useIncidentPaging('query', 10));

    act(() => result.current.goToPage(7));

    expect(result.current.currentPage).toBe(7);

    act(() => result.current.goToPage(2));

    expect(result.current.currentPage).toBe(2);
  });

  it('should start over when the query changes', () => {
    const { result, rerender } = renderHook(
      ({ queryKey }) => useIncidentPaging(queryKey, 10),
      { initialProps: { queryKey: 'query' } }
    );

    act(() => result.current.goToPage(3));
    rerender({ queryKey: 'another query' });

    expect(result.current.currentPage).toBe(1);
  });

  it('should start over in the new size when the page size changes', () => {
    const { result } = renderHook(() => useIncidentPaging('query', 10));

    act(() => result.current.goToPage(3));
    act(() => result.current.setPageSize(25));

    expect(result.current.pageSize).toBe(25);
    expect(result.current.currentPage).toBe(1);
  });
});
