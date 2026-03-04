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

import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUrlState } from './useUrlState';

// Mock react-router-dom
const mockSetSearchParams = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useUrlState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.delete('q');
    mockSearchParams.delete('page');
    mockSearchParams.delete('size');
  });

  describe('setPageSize', () => {
    it('should set pageSize in URL when size differs from default', () => {
      const { result } = renderHook(
        () =>
          useUrlState({
            filterKeys: [],
            defaultPageSize: 10,
          }),
        { wrapper }
      );

      act(() => {
        result.current.setPageSize(25);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();

      const updateFn = mockSetSearchParams.mock.calls[0][0];
      const currentParams = new URLSearchParams();
      const newParams = updateFn(currentParams);

      expect(newParams.get('size')).toBe('25');
      expect(newParams.get('page')).toBe('1');
    });

    it('should remove pageSize from URL when size equals default', () => {
      mockSearchParams.set('size', '25');
      mockSearchParams.set('page', '3');

      const { result } = renderHook(
        () =>
          useUrlState({
            filterKeys: [],
            defaultPageSize: 10,
          }),
        { wrapper }
      );

      act(() => {
        result.current.setPageSize(10);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();

      const updateFn = mockSetSearchParams.mock.calls[0][0];
      const currentParams = new URLSearchParams();
      currentParams.set('size', '25');
      currentParams.set('page', '3');
      const newParams = updateFn(currentParams);

      expect(newParams.get('size')).toBeNull();
      expect(newParams.get('page')).toBe('1');
    });

    it('should reset page to 1 when changing page size', () => {
      mockSearchParams.set('page', '5');
      mockSearchParams.set('size', '10');

      const { result } = renderHook(
        () =>
          useUrlState({
            filterKeys: [],
            defaultPageSize: 10,
          }),
        { wrapper }
      );

      act(() => {
        result.current.setPageSize(50);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();

      const updateFn = mockSetSearchParams.mock.calls[0][0];
      const currentParams = new URLSearchParams();
      currentParams.set('page', '5');
      currentParams.set('size', '10');
      const newParams = updateFn(currentParams);

      expect(newParams.get('page')).toBe('1');
      expect(newParams.get('size')).toBe('50');
    });

    it('should use custom pageSizeKey when provided', () => {
      const { result } = renderHook(
        () =>
          useUrlState({
            filterKeys: [],
            defaultPageSize: 10,
            pageSizeKey: 'limit',
          }),
        { wrapper }
      );

      act(() => {
        result.current.setPageSize(25);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();

      const updateFn = mockSetSearchParams.mock.calls[0][0];
      const currentParams = new URLSearchParams();
      const newParams = updateFn(currentParams);

      expect(newParams.get('limit')).toBe('25');
      expect(newParams.get('size')).toBeNull();
    });

    it('should handle multiple page size changes correctly', () => {
      const { result } = renderHook(
        () =>
          useUrlState({
            filterKeys: [],
            defaultPageSize: 10,
          }),
        { wrapper }
      );

      act(() => {
        result.current.setPageSize(25);
      });

      act(() => {
        result.current.setPageSize(50);
      });

      act(() => {
        result.current.setPageSize(10);
      });

      expect(mockSetSearchParams).toHaveBeenCalledTimes(3);

      const lastUpdateFn = mockSetSearchParams.mock.calls[2][0];
      const currentParams = new URLSearchParams();
      const newParams = lastUpdateFn(currentParams);

      expect(newParams.get('size')).toBeNull();
      expect(newParams.get('page')).toBe('1');
    });
  });
});
