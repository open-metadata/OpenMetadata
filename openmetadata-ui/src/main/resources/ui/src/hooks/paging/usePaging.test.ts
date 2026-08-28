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
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { usePaging } from './usePaging';

const mockPageSize = PAGE_SIZE_BASE;
const mockSetPreference = jest.fn();
const mockSetFilters = jest.fn();
const mockUrlParams = {
  cursorType: undefined,
  cursorValue: undefined,
  currentPage: '1',
  pageSize: String(mockPageSize),
};

jest.mock('../currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn(() => ({
    preferences: {
      globalPageSize: mockPageSize,
    },
    setPreference: mockSetPreference,
  })),
}));

jest.mock('../useTableFilters', () => ({
  useTableFilters: jest.fn(() => ({
    filters: mockUrlParams,
    setFilters: mockSetFilters,
  })),
}));

describe('usePaging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUrlParams.currentPage = '1';
    mockUrlParams.pageSize = String(mockPageSize);
  });

  it('shows pagination when cursor paging is available without a total count', () => {
    const { result } = renderHook(() => usePaging());

    act(() => {
      result.current.handlePagingChange({
        after: 'next-cursor',
        total: 0,
      });
    });

    expect(result.current.showPagination).toBe(true);
  });

  it('syncs pagination state when url paging params are updated externally', () => {
    const { result, rerender } = renderHook(() => usePaging());

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(mockPageSize);

    mockUrlParams.currentPage = '3';
    mockUrlParams.pageSize = '25';

    rerender();

    expect(result.current.currentPage).toBe(3);
    expect(result.current.pageSize).toBe(25);
  });
});
