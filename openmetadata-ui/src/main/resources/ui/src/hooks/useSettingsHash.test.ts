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
import { useSettingsHash } from './useSettingsHash';

const mockNavigate = jest.fn();
let mockHash = '';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({
    hash: mockHash,
    pathname: '/',
    search: '',
    state: null,
    key: 'default',
  }),
  useNavigate: () => mockNavigate,
}));

describe('useSettingsHash', () => {
  beforeEach(() => {
    mockHash = '';
    mockNavigate.mockClear();
  });

  it('should return null tab when no hash', () => {
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBeNull();
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification correctly', () => {
    mockHash = '#notification';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification/subpath correctly', () => {
    mockHash = '#notification/alerts';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('alerts');
  });

  it('should parse hash with query params', () => {
    mockHash = '#notification?page=2&cursorType=after';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.params).toEqual({
      page: '2',
      cursorType: 'after',
    });
  });

  it('should set hash via setHash', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification', 'my-alert');
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { hash: 'notification/my-alert' },
      { replace: true }
    );
  });

  it('should set hash with params', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification', undefined, { page: '2' });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { hash: 'notification?page=2' },
      { replace: true }
    );
  });

  it('should clear hash via clearHash', () => {
    mockHash = '#notification';
    window.location.hash = '#notification';
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.clearHash();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      { pathname: '/', search: '', hash: '' },
      { replace: true }
    );
  });
});
